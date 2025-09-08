# Mole Tweaker Chrome Extension

Mole Tweaker is a Chrome Extension (Manifest V3) that modifies Optimole image URL parameters on web pages to give users control over image quality, format, and device pixel ratio.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Development Setup
- **NO BUILD PROCESS REQUIRED** - This is a pure HTML/CSS/JavaScript Chrome extension
- Load extension directly into Chrome using developer mode:
  1. Open Chrome and navigate to `chrome://extensions/`
  2. Enable "Developer mode" toggle in top right
  3. Click "Load unpacked" and select the repository root directory
  4. Extension will appear in extensions list and browser toolbar
- **CRITICAL**: Extension loading is instant - no compilation or build time

### Code Validation
- Check JavaScript syntax: `node -c content.js && node -c popup.js && node -c background.js`
- Validate manifest.json: `python3 -m json.tool manifest.json > /dev/null`
- **NO LINTING OR BUILD TOOLS** - Syntax checking is manual using Node.js
- **NEVER CANCEL**: All validation commands complete in under 5 seconds

### Testing and Validation
- **MANUAL TESTING REQUIRED** - No automated test suite exists
- Load `test.html` in Chrome browser to test extension functionality:
  1. Load extension in developer mode (see Development Setup)
  2. Open `test.html` in a new Chrome tab
  3. Click extension icon in browser toolbar
  4. Enable "Enable for this page" toggle
  5. Adjust parameters (quality, format, DPR, image format)
  6. Click "Apply Changes"
  7. Use Chrome DevTools Network tab to verify modified Optimole URLs
  8. Inspect img elements to see modified src attributes and `data-mole-tweaker-modified="true"`

### **VALIDATION SCENARIOS**
Always test these complete user scenarios after making changes:
1. **Extension Loading**: Load extension → no console errors → icon appears in toolbar
2. **URL Modification**: Enable extension on test.html → modify parameters → verify Optimole URLs change in Network tab
3. **Settings Persistence**: Set parameters → reload page → verify settings remembered
4. **Disable/Enable**: Toggle extension off → verify original URLs restored → toggle on → verify modifications reapplied
5. **Dynamic Images**: Use "Add Dynamic Image" button in test.html → verify new images also get modified

## Validation Requirements

### **CRITICAL TESTING STEPS**
When making ANY changes to the extension:
1. **Load Extension**: Must successfully load in `chrome://extensions/` without errors
2. **Test Page Validation**: Open test.html → enable extension → apply settings → verify in DevTools that:
   - Only Optimole URLs (containing `.i.optimole.com`) are modified
   - Regular images remain unchanged
   - Modified images have `data-mole-tweaker-modified="true"` attribute
   - Original URLs are restored when extension is disabled
3. **Console Check**: No JavaScript errors in browser console
4. **Settings Persistence**: Settings must persist after page reload

### **MANUAL VALIDATION REQUIREMENT**
Simply loading the extension is NOT sufficient. You MUST:
- Open test.html in Chrome
- Enable the extension for the page
- Modify at least one parameter (quality, format, etc.)
- Click "Apply Changes"
- Verify in Chrome DevTools Network tab that Optimole URLs are being requested with modified parameters
- Check that `moleTweakerDebug.showModifiedImages()` in browser console shows modified images

## Development Workflow

### File Structure and Navigation
```
/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and settings management
├── content.js            # Content script that modifies images on web pages
├── background.js         # Service worker for extension management and storage
├── test.html             # Manual testing page with Optimole images
├── icon*.png             # Extension icons (currently placeholder text files)
└── README.md             # Documentation
```

### Key Files to Modify
- **content.js**: Image URL modification logic, Optimole URL detection and parameter manipulation
- **popup.js**: User interface logic, settings storage/retrieval
- **background.js**: Extension lifecycle, cross-tab communication, storage cleanup
- **popup.html**: User interface layout and styling
- **manifest.json**: Extension permissions, content script configuration

### Common Development Tasks

#### Adding New URL Parameters
1. Modify parameter detection/modification logic in `content.js` (function `modifyOptimoleUrl`)
2. Add UI controls in `popup.html`
3. Add event handlers and storage logic in `popup.js`
4. Test with various Optimole URL formats in `test.html`

#### Debugging Extension Issues
1. Open Chrome DevTools on any page where extension is active
2. Check Console tab for JavaScript errors
3. Use `moleTweakerDebug.showModifiedImages()` to inspect modified images
4. Use `moleTweakerDebug.showOriginalSources()` to see original URL mappings
5. Check Network tab to see actual HTTP requests being made
6. Inspect extension in `chrome://extensions/` → "Errors" button for extension-specific errors

#### Testing Settings Storage
1. Enable extension on test page
2. Set specific parameters
3. Reload page
4. Verify settings are remembered
5. Test with different domains to verify per-domain storage

## Troubleshooting

### Common Issues
- **Extension not loading**: Check manifest.json syntax with `python3 -m json.tool manifest.json`
- **JavaScript errors**: Check syntax with `node -c filename.js`
- **Images not being modified**: Verify URLs contain `.i.optimole.com` and check console for errors
- **Settings not persisting**: Check Chrome storage permissions in manifest.json

### Known Limitations
- Icons are placeholder text files, not actual PNG images - this does not affect functionality
- No automated testing - all validation must be manual
- Extension only works with Optimole URLs containing `.i.optimole.com`
- Requires Chrome browser with developer mode enabled for development

## Quick Reference Commands

### File Validation
```bash
# Check JavaScript syntax
node -c content.js && node -c popup.js && node -c background.js

# Validate manifest
python3 -m json.tool manifest.json > /dev/null && echo "Valid JSON"

# List all files
ls -la
```

### Browser Testing
1. Load extension: `chrome://extensions/` → Enable Developer mode → Load unpacked
2. Test page: Open `test.html` in new tab
3. Debug: F12 → Console tab → `moleTweakerDebug.showModifiedImages()`

**NEVER CANCEL**: All commands complete in under 5 seconds. No long-running builds or tests exist.