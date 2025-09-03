// Popup script for Mole Tweaker extension
document.addEventListener('DOMContentLoaded', function() {
  const enableToggle = document.getElementById('enableToggle');
  const qualitySelect = document.getElementById('quality');
  const formatSelect = document.getElementById('format');
  const imageFormatSelect = document.getElementById('imageFormat');
  const dprSelect = document.getElementById('dpr');
  const applyBtn = document.getElementById('applyBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusDiv = document.getElementById('status');

  // Load saved settings when popup opens
  loadSettings();

  // Event listeners
  enableToggle.addEventListener('change', function() {
    saveSettings();
    updateContentScript();
  });

  applyBtn.addEventListener('click', function() {
    saveSettings();
    updateContentScript();
    showStatus('Settings applied successfully!', 'success');
  });

  resetBtn.addEventListener('click', function() {
    resetSettings();
    showStatus('Settings reset to defaults', 'success');
  });

  // Load settings from storage
  async function loadSettings() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab.id;
      const url = new URL(tab.url);
      const domain = url.hostname;

      const result = await chrome.storage.local.get([
        `enabled_${domain}`,
        `settings_${domain}`
      ]);

      // Load enable state
      enableToggle.checked = result[`enabled_${domain}`] || false;

      // Load parameter settings
      const settings = result[`settings_${domain}`] || {};
      qualitySelect.value = settings.quality || '';
      formatSelect.value = settings.format || '';
      imageFormatSelect.value = settings.imageFormat || '';
      dprSelect.value = settings.dpr || '';

    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus('Error loading settings', 'error');
    }
  }

  // Save settings to storage
  async function saveSettings() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab.id;
      const url = new URL(tab.url);
      const domain = url.hostname;

      const settings = {
        quality: qualitySelect.value,
        format: formatSelect.value,
        imageFormat: imageFormatSelect.value,
        dpr: dprSelect.value
      };

      await chrome.storage.local.set({
        [`enabled_${domain}`]: enableToggle.checked,
        [`settings_${domain}`]: settings
      });

    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings', 'error');
    }
  }

  // Reset settings to defaults
  async function resetSettings() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const domain = url.hostname;

      await chrome.storage.local.remove([
        `enabled_${domain}`,
        `settings_${domain}`
      ]);

      // Reset UI
      enableToggle.checked = false;
      qualitySelect.value = '';
      formatSelect.value = '';
      imageFormatSelect.value = '';
      dprSelect.value = '';

      updateContentScript();

    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus('Error resetting settings', 'error');
    }
  }

  // Update content script with new settings
  async function updateContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab.id;
      const url = new URL(tab.url);
      const domain = url.hostname;

      const result = await chrome.storage.local.get([
        `enabled_${domain}`,
        `settings_${domain}`
      ]);

      const isEnabled = result[`enabled_${domain}`] || false;
      const settings = result[`settings_${domain}`] || {};

      // Send message to content script
      chrome.tabs.sendMessage(tabId, {
        action: 'updateSettings',
        enabled: isEnabled,
        settings: settings
      });

    } catch (error) {
      console.error('Error updating content script:', error);
      showStatus('Error applying changes', 'error');
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});