// Content script for Mole Tweaker extension
(function() {
  'use strict';
  
  let isEnabled = false;
  let currentSettings = {};
  let originalAttributes = new Map(); // Store original attribute/style values per element

  // Initialize on page load
  initialize();

  async function initialize() {
    try {
      const domain = window.location.hostname;
      // Load settings directly to minimize init latency at document_start
      const result = await chrome.storage.local.get([
        `enabled_${domain}`,
        `settings_${domain}`
      ]);

      isEnabled = result[`enabled_${domain}`] || false;
      currentSettings = result[`settings_${domain}`] || {};

      if (isEnabled) {
        processMedia();
      }
    } catch (error) {
      console.error('Mole Tweaker: Error initializing:', error);
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateSettings') {
      isEnabled = message.enabled;
      currentSettings = message.settings;
      
      if (isEnabled) {
        processMedia();
      } else {
        restoreOriginalMedia();
      }
      
      sendResponse({ success: true });
    }
  });

  // Process all media on the page (images, sources, backgrounds)
  function processMedia() {
    // Images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      processElementAttributes(img, ['src', 'srcset', 'data-src', 'data-srcset']);
    });

    // <source> elements (inside <picture>)
    const sources = document.querySelectorAll('source');
    sources.forEach(sourceEl => {
      processElementAttributes(sourceEl, ['srcset', 'data-srcset']);
    });

    // Inline background-image/background styles
    const bgStyleEls = document.querySelectorAll('[style*="background-image"], [style*="background:"]');
    bgStyleEls.forEach(processBackgroundElement);

    // Set up observer for dynamically added nodes and relevant attribute changes
    setupMediaObserver();
  }

  // Restore original media attributes/styles
  function restoreOriginalMedia() {
    originalAttributes.forEach((attrs, el) => {
      if (!el.parentNode) return;

      // Restore attributes
      ['src', 'srcset', 'data-src', 'data-srcset'].forEach((attr) => {
        if (attrs[attr] !== undefined) {
          if (attrs[attr] === null) {
            el.removeAttribute(attr);
          } else {
            el.setAttribute(attr, attrs[attr]);
          }
        }
      });

      // Restore inline style if modified
      if (attrs.__style !== undefined) {
        if (attrs.__style === null) {
          el.removeAttribute('style');
        } else {
          el.setAttribute('style', attrs.__style);
        }
      }

      el.removeAttribute('data-mole-tweaker-modified');
    });

    originalAttributes.clear();
  }

  // Check if URL is an Optimole URL
  function isOptimoleUrl(url) {
    return url && url.includes('.i.optimole.com/');
  }

  // Modify Optimole URL based on settings
  function modifyOptimoleUrl(url, settings) {
    try {
      // Parse Optimole URL structure
      // Format: https://subdomain.i.optimole.com/params/original-url
      // The original URL always starts with http:// or https://
      
      const optimoleMatch = url.match(/^(https?:\/\/[^\/]+\.i\.optimole\.com\/)(.*?)(https?:\/\/.+)$/);
      if (!optimoleMatch) {
        return url; // Not a valid Optimole URL
      }

      const [, baseUrl, paramsSection, originalUrl] = optimoleMatch;
      
      // Parse existing parameters
      const params = parseOptimoleParams(paramsSection);
      
      // Apply modifications based on settings
      if (settings.quality) {
        if (settings.quality === 'remove') {
          delete params.q;
        } else {
          params.q = settings.quality;
        }
      }
      
      if (settings.format) {
        if (settings.format === 'remove') {
          delete params.f;
        } else {
          params.f = settings.format;
        }
      }
      
      if (settings.imageFormat) {
        if (settings.imageFormat === 'remove') {
          delete params.ig;
        } else {
          params.ig = settings.imageFormat;
        }
      }
      
      if (settings.dpr) {
        if (settings.dpr === 'remove') {
          delete params.dpr;
        } else {
          params.dpr = settings.dpr;
        }
      }
      
      // Rebuild URL
      const newParamsSection = buildOptimoleParams(params);
      const modifiedUrl = baseUrl + newParamsSection + originalUrl;
      
      return modifiedUrl;
      
    } catch (error) {
      console.error('Mole Tweaker: Error modifying URL:', error);
      return url; // Return original URL on error
    }
  }

  // Parse Optimole parameters from URL
  function parseOptimoleParams(paramsSection) {
    const params = {};
    
    if (!paramsSection) {
      return params;
    }
    
    // Remove trailing slash and split by /
    const paramParts = paramsSection.replace(/\/$/, '').split('/').filter(part => part.length > 0);
    
    paramParts.forEach(part => {
      if (part.includes(':')) {
        const [key, value] = part.split(':', 2);
        params[key] = value;
      }
    });
    
    return params;
  }

  // Build Optimole parameters string
  function buildOptimoleParams(params) {
    const paramParts = [];
    
    // Define parameter order for consistency
    const paramOrder = ['w', 'h', 'q', 'f', 'dpr', 'ig'];
    
    // Add parameters in order
    paramOrder.forEach(key => {
      if (params[key] !== undefined) {
        paramParts.push(`${key}:${params[key]}`);
      }
    });
    
    // Add any other parameters not in the order list
    Object.keys(params).forEach(key => {
      if (!paramOrder.includes(key)) {
        paramParts.push(`${key}:${params[key]}`);
      }
    });
    
    return paramParts.length > 0 ? paramParts.join('/') + '/' : '';
  }

  // Modify Optimole URLs inside a srcset string
  function modifyOptimoleInSrcset(srcset, settings) {
    if (!srcset) return srcset;
    try {
      const parts = srcset.split(',');
      const modified = parts.map(part => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        const match = trimmed.match(/^(\S+)(\s+.+)?$/);
        if (!match) return trimmed;
        const url = match[1];
        const descriptor = match[2] || '';
        const newUrl = isOptimoleUrl(url) ? modifyOptimoleUrl(url, settings) : url;
        return newUrl + descriptor;
      });
      return modified.join(', ');
    } catch (e) {
      console.error('Mole Tweaker: Error modifying srcset:', e);
      return srcset;
    }
  }

  // Modify Optimole URLs inside inline CSS background declarations
  function modifyOptimoleInCss(cssText, settings) {
    if (!cssText || cssText.indexOf('url(') === -1) return cssText;
    try {
      return cssText.replace(/url\((['"]?)([^)]+?)\1\)/g, (m, quote, url) => {
        const cleanedUrl = url.replace(/^\s+|\s+$/g, '');
        if (!isOptimoleUrl(cleanedUrl)) return m;
        const newUrl = modifyOptimoleUrl(cleanedUrl, settings);
        const q = quote || '';
        return 'url(' + q + newUrl + q + ')';
      });
    } catch (e) {
      console.error('Mole Tweaker: Error modifying CSS background:', e);
      return cssText;
    }
  }

  // Ensure we store the original attribute/style value once per element
  function storeOriginal(el, key, value) {
    let rec = originalAttributes.get(el);
    if (!rec) {
      rec = {};
      originalAttributes.set(el, rec);
    }
    if (rec[key] === undefined) {
      rec[key] = value;
    }
  }

  // Process element attributes for Optimole modifications
  function processElementAttributes(el, attrs) {
    attrs.forEach(attr => {
      const hasAttr = el.hasAttribute(attr);
      const value = hasAttr ? el.getAttribute(attr) : null;
      if (!value) return;

      let newValue = value;
      if (attr.endsWith('srcset')) {
        newValue = modifyOptimoleInSrcset(value, currentSettings);
      } else {
        if (isOptimoleUrl(value)) {
          newValue = modifyOptimoleUrl(value, currentSettings);
        }
      }

      if (newValue !== value) {
        storeOriginal(el, attr, value);
        el.setAttribute(attr, newValue);
        el.setAttribute('data-mole-tweaker-modified', 'true');
      }
    });
  }

  // Process inline background-image/background styles for Optimole URLs
  function processBackgroundElement(el) {
    const originalStyle = el.getAttribute('style');
    if (originalStyle == null) return;
    const newStyle = modifyOptimoleInCss(originalStyle, currentSettings);
    if (newStyle !== originalStyle) {
      storeOriginal(el, '__style', originalStyle);
      el.setAttribute('style', newStyle);
      el.setAttribute('data-mole-tweaker-modified', 'true');
    }
  }

  // Set up mutation observer for dynamically added images
  function setupMediaObserver() {
    if (window.moleTweakerObserver) {
      window.moleTweakerObserver.disconnect();
    }

    window.moleTweakerObserver = new MutationObserver((mutations) => {
      if (!isEnabled) return;

      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const el = mutation.target;
          const attr = mutation.attributeName;
          if (!attr) return;
          if (attr === 'style') {
            processBackgroundElement(el);
          } else if (attr === 'src' || attr === 'srcset' || attr === 'data-src' || attr === 'data-srcset') {
            processElementAttributes(el, [attr]);
          }
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          // Direct node processing
          const tag = node.tagName;
          if (tag === 'IMG') {
            processElementAttributes(node, ['src', 'srcset', 'data-src', 'data-srcset']);
          } else if (tag === 'SOURCE') {
            processElementAttributes(node, ['srcset', 'data-srcset']);
          }
          processBackgroundElement(node);

          // Descendants
          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(img => {
              processElementAttributes(img, ['src', 'srcset', 'data-src', 'data-srcset']);
            });
            node.querySelectorAll('source').forEach(sourceEl => {
              processElementAttributes(sourceEl, ['srcset', 'data-srcset']);
            });
            node.querySelectorAll('[style*="background-image"], [style*="background:"]').forEach(processBackgroundElement);
          }
        });
      });
    });

    window.moleTweakerObserver.observe(document.body, {
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'style'],
      subtree: true
    });
  }

  // (Deprecated) kept for backwards compatibility if referenced elsewhere
  function processNewImage(img) {
    processElementAttributes(img, ['src', 'srcset', 'data-src', 'data-srcset']);
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (window.moleTweakerObserver) {
      window.moleTweakerObserver.disconnect();
    }
  });

})();