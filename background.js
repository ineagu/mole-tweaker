// Background script for Mole Tweaker extension

// In-memory cache of per-domain settings for fast webRequest handling
const settingsCache = new Map(); // domain -> { enabled: boolean, settings: object }

// Utility: Load all saved settings into cache
async function loadAllSettingsIntoCache() {
  try {
    const all = await chrome.storage.local.get(null);
    const domains = new Set();
    Object.keys(all).forEach((key) => {
      if (key.startsWith('enabled_')) {
        domains.add(key.substring('enabled_'.length));
      }
      if (key.startsWith('settings_')) {
        domains.add(key.substring('settings_'.length));
      }
    });
    domains.forEach((domain) => {
      const enabled = !!all[`enabled_${domain}`];
      const settings = all[`settings_${domain}`] || {};
      settingsCache.set(domain, { enabled, settings });
    });
  } catch (e) {
    console.warn('Mole Tweaker: failed to preload settings cache', e);
  }
}

// Utility: Update cache entries when storage changes
function applyStorageChangesToCache(changes) {
  const touchedDomains = new Set();
  Object.keys(changes).forEach((key) => {
    if (key.startsWith('enabled_')) {
      touchedDomains.add(key.substring('enabled_'.length));
    } else if (key.startsWith('settings_')) {
      touchedDomains.add(key.substring('settings_'.length));
    }
  });
  touchedDomains.forEach((domain) => {
    const enabledChange = changes[`enabled_${domain}`];
    const settingsChange = changes[`settings_${domain}`];
    const existing = settingsCache.get(domain) || { enabled: false, settings: {} };
    const next = {
      enabled: enabledChange ? !!enabledChange.newValue : existing.enabled,
      settings: settingsChange ? (settingsChange.newValue || {}) : existing.settings
    };
    settingsCache.set(domain, next);
  });
}

// Install/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Mole Tweaker extension installed');
  } else if (details.reason === 'update') {
    console.log('Mole Tweaker extension updated');
  }
  // Warm cache after install/update
  loadAllSettingsIntoCache();
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    handleGetSettings(message.domain)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
});

// Get settings for a domain
async function handleGetSettings(domain) {
  try {
    const result = await chrome.storage.local.get([
      `enabled_${domain}`,
      `settings_${domain}`
    ]);

    return {
      success: true,
      enabled: result[`enabled_${domain}`] || false,
      settings: result[`settings_${domain}`] || {}
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { success: false, error: error.message };
  }
}

// Handle tab updates to ensure content script is aware of settings
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      // Get settings for this domain
      const result = await chrome.storage.local.get([
        `enabled_${domain}`,
        `settings_${domain}`
      ]);
      
      const isEnabled = result[`enabled_${domain}`] || false;
      const settings = result[`settings_${domain}`] || {};
      
      // Send settings to content script
      if (isEnabled) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'updateSettings',
            enabled: isEnabled,
            settings: settings
          });
        } catch (error) {
          // Content script might not be ready yet, ignore error
          console.log('Content script not ready for tab:', tabId);
        }
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }
});

// Clean up old settings periodically (optional)
chrome.runtime.onStartup.addListener(async () => {
  try {
    const allData = await chrome.storage.local.get();
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Clean up settings for domains that haven't been accessed in a week
    const keysToRemove = [];
    
    for (const key in allData) {
      if (key.startsWith('enabled_') || key.startsWith('settings_')) {
        const lastAccess = allData[`${key}_lastAccess`] || 0;
        if (lastAccess < oneWeekAgo && lastAccess > 0) {
          keysToRemove.push(key);
          keysToRemove.push(`${key}_lastAccess`);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log('Cleaned up old settings for', keysToRemove.length / 2, 'domains');
    }
    // Warm cache on startup
    await loadAllSettingsIntoCache();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

// Update last access time when settings are retrieved
chrome.storage.local.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    const now = Date.now();
    
    for (const key in changes) {
      if (key.startsWith('enabled_') || key.startsWith('settings_')) {
        // Update last access time
        chrome.storage.local.set({
          [`${key}_lastAccess`]: now
        });
      }
    }

    // Reflect changes in in-memory cache
    applyStorageChangesToCache(changes);
  }
});

// ===== Network-layer rewrite to avoid early/cancelled original requests =====

// Helpers to adjust Optimole URLs with current settings
function parseOptimoleParams(paramsSection) {
  const params = {};
  if (!paramsSection) return params;
  const parts = paramsSection.replace(/\/$/, '').split('/').filter(Boolean);
  parts.forEach((p) => {
    const idx = p.indexOf(':');
    if (idx > -1) params[p.substring(0, idx)] = p.substring(idx + 1);
  });
  return params;
}

function buildOptimoleParams(params) {
  const ordered = ['w', 'h', 'q', 'f', 'dpr', 'ig'];
  const out = [];
  ordered.forEach((k) => {
    if (params[k] !== undefined) out.push(`${k}:${params[k]}`);
  });
  Object.keys(params).forEach((k) => {
    if (!ordered.includes(k)) out.push(`${k}:${params[k]}`);
  });
  return out.length > 0 ? out.join('/') + '/' : '';
}

function modifyOptimoleUrl(url, settings) {
  try {
    const m = url.match(/^(https?:\/\/[^\/]+\.i\.optimole\.com\/)(.*?)(https?:\/\/.+)$/);
    if (!m) return url;
    const baseUrl = m[1];
    const paramsSection = m[2];
    const originalUrl = m[3];
    const params = parseOptimoleParams(paramsSection);

    if (settings.quality) {
      if (settings.quality === 'remove') delete params.q; else params.q = settings.quality;
    }
    if (settings.format) {
      if (settings.format === 'remove') delete params.f; else params.f = settings.format;
    }
    if (settings.imageFormat) {
      if (settings.imageFormat === 'remove') delete params.ig; else params.ig = settings.imageFormat;
    }
    if (settings.dpr) {
      if (settings.dpr === 'remove') delete params.dpr; else params.dpr = settings.dpr;
    }

    const newParams = buildOptimoleParams(params);
    return baseUrl + newParams + originalUrl;
  } catch (e) {
    return url;
  }
}

function isOptimole(url) {
  return typeof url === 'string' && url.includes('.i.optimole.com/');
}

// Faster, synchronous check of initiating domain from request details
function getInitiatorHostname(details) {
  try {
    if (details.initiator) {
      return new URL(details.initiator).hostname;
    }
    if (details.documentUrl) {
      return new URL(details.documentUrl).hostname;
    }
  } catch (e) {}
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const initiatorHost = getInitiatorHostname(details);
    if (!initiatorHost) return {};
    const cacheEntry = settingsCache.get(initiatorHost);
    if (!cacheEntry || !cacheEntry.enabled) return {};
    const originalUrl = details.url;
    if (!isOptimole(originalUrl)) return {};

    const redirected = modifyOptimoleUrl(originalUrl, cacheEntry.settings || {});
    if (redirected && redirected !== originalUrl) {
      return { redirectUrl: redirected };
    }
    return {};
  },
  { urls: [
      "https://*.i.optimole.com/*",
      "http://*.i.optimole.com/*"
    ] },
  ["blocking"]
);