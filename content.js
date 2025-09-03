// Content script for Mole Tweaker extension
(function() {
  'use strict';
  
  let isEnabled = false;
  let currentSettings = {};
  let originalSources = new Map(); // Store original sources

  // Initialize on page load
  initialize();

  async function initialize() {
    try {
      const domain = window.location.hostname;
      
      // Request settings from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getSettings',
        domain: domain
      });

      if (response && response.success) {
        isEnabled = response.enabled || false;
        currentSettings = response.settings || {};

        if (isEnabled) {
          processImages();
        }
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
        processImages();
      } else {
        restoreOriginalImages();
      }
      
      sendResponse({ success: true });
    }
  });

  // Process all images on the page
  function processImages() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      const src = img.src;
      
      if (isOptimoleUrl(src)) {
        // Store original source if not already stored
        if (!originalSources.has(img)) {
          originalSources.set(img, src);
        }
        
        const modifiedUrl = modifyOptimoleUrl(src, currentSettings);
        if (modifiedUrl !== src) {
          img.src = modifiedUrl;
          
          // Add data attribute to track modified images
          img.setAttribute('data-mole-tweaker-modified', 'true');
        }
      }
    });

    // Set up observer for dynamically added images
    setupImageObserver();
  }

  // Restore original image sources
  function restoreOriginalImages() {
    originalSources.forEach((originalSrc, img) => {
      if (img.parentNode) { // Check if image is still in DOM
        img.src = originalSrc;
        img.removeAttribute('data-mole-tweaker-modified');
      }
    });
    
    // Clean up the map
    originalSources.clear();
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

  // Set up mutation observer for dynamically added images
  function setupImageObserver() {
    if (window.moleTweakerObserver) {
      window.moleTweakerObserver.disconnect();
    }

    window.moleTweakerObserver = new MutationObserver((mutations) => {
      if (!isEnabled) return;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is an image
            if (node.tagName === 'IMG') {
              processNewImage(node);
            }
            
            // Check for images within the added node
            const images = node.querySelectorAll ? node.querySelectorAll('img') : [];
            images.forEach(processNewImage);
          }
        });
      });
    });

    window.moleTweakerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Process a newly added image
  function processNewImage(img) {
    const src = img.src;
    
    if (isOptimoleUrl(src) && !originalSources.has(img)) {
      originalSources.set(img, src);
      
      const modifiedUrl = modifyOptimoleUrl(src, currentSettings);
      if (modifiedUrl !== src) {
        img.src = modifiedUrl;
        img.setAttribute('data-mole-tweaker-modified', 'true');
      }
    }
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (window.moleTweakerObserver) {
      window.moleTweakerObserver.disconnect();
    }
  });

})();