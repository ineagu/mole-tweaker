// Background script for Mole Tweaker extension

// Install/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Mole Tweaker extension installed');
  } else if (details.reason === 'update') {
    console.log('Mole Tweaker extension updated');
  }
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
  }
});