# Mole Tweaker Chrome Extension

Mole Tweaker is a Chrome extension (Manifest v3) that modifies Optimole image URL parameters for better control over image quality, format, and device pixel ratio. This is a vanilla JavaScript extension with NO build process required.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Prerequisites and Installation
- Ensure Google Chrome (version 88+) is installed
- **NO package.json, npm install, or build process is required** - this is a vanilla JavaScript extension
- All files are ready to use directly without compilation or bundling

### Essential Commands for Development
- **Syntax validation**: `node -c *.js` -- validates all JavaScript files in ~0.04 seconds
- **Manifest validation**: `python3 -c "import json; json.load(open('manifest.json')); print('OK')"` -- validates manifest.json in ~0.02 seconds  
- **Install ESLint for code quality** (optional): `npm install --no-save eslint@latest` -- takes ~1-7 seconds depending on network
- **Lint code with ESLint**: Complete setup and linting takes ~2 seconds (see Validation section)
- **HTTP server for testing**: `python3 -m http.server 8000` -- starts immediately, runs indefinitely until stopped

### Loading and Testing the Extension
1. **Load extension in Chrome developer mode**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the entire repository directory
   - The Mole Tweaker extension should appear in your extensions list

2. **Test the extension functionality**:
   - Start local HTTP server: `python3 -m http.server 8000` (runs indefinitely)
   - Open `http://localhost:8000/test.html` in Chrome
   - Click the Mole Tweaker extension icon in the browser toolbar
   - Toggle "Enable for this page" to ON
   - Adjust parameters (quality, format, DPR, etc.)
   - Click "Apply Changes"
   - Use browser Developer Tools (F12) → Network tab to verify modified URLs are being requested

### Testing and Debugging
- **Test dynamic image loading**: Click "Add Dynamic Image" button on test page
- **Debug modified images**: In browser console, run `moleTweakerDebug.showModifiedImages()`
- **Check original vs modified URLs**: Modified images have `data-mole-tweaker-modified="true"` attribute
- **Expected behavior**: Only Optimole URLs (containing `.i.optimole.com`) should be modified
- **Settings persistence**: Settings are saved per domain and should persist on page reload

## Validation

### Code Quality Validation
Always run these validation steps before committing changes:

1. **JavaScript syntax check** (required):
   ```bash
   node -c *.js && echo "All JS files syntax validated"
   ```

2. **Manifest validation** (required):
   ```bash
   python3 -c "import json; json.load(open('manifest.json')); print('Manifest validation: OK')"
   ```

3. **ESLint validation** (recommended, ~2 seconds total):
   ```bash
   # Setup (one-time):
   npm install --no-save eslint@latest
   echo '{"name": "temp", "version": "1.0.0"}' > package.json
   
   # Create ESLint config:
   cat > eslint.config.mjs << 'EOF'
   export default [
     {
       languageOptions: {
         ecmaVersion: 2022,
         sourceType: "script",
         globals: {
           chrome: "readonly",
           window: "readonly", 
           document: "readonly",
           console: "readonly"
         }
       },
       rules: {
         "no-unused-vars": "warn",
         "no-console": "off"
       }
     }
   ];
   EOF
   
   # Run linting:
   npx eslint --config eslint.config.mjs *.js
   # Expected: 3 warnings about unused variables (these are acceptable)
   
   # Cleanup:
   rm package.json eslint.config.mjs
   rm -rf node_modules
   ```

### Manual Testing Scenarios
**ALWAYS test functionality after making code changes by running through these scenarios:**

1. **Basic URL modification test**:
   - Load extension in Chrome developer mode
   - Open `http://localhost:8000/test.html`
   - Enable extension for the page
   - Set quality to "99", format to "best", remove image format conversion
   - Apply changes and verify in Network tab that Optimole URLs contain `q:99` and `f:best`
   - Verify non-Optimole images remain unchanged

2. **Dynamic content test**:
   - Click "Add Dynamic Image" button multiple times
   - Verify newly added Optimole images are also modified
   - Check `moleTweakerDebug.showModifiedImages()` shows the modified images

3. **Settings persistence test**:
   - Configure extension settings
   - Reload the page
   - Verify settings are restored and images are still modified

4. **Disable/restore test**:
   - Disable extension for the page
   - Verify images revert to original Optimole URLs
   - Re-enable and verify modification resumes

## Common Tasks

### Repository Structure
```
.
├── README.md              # Project documentation
├── manifest.json          # Chrome extension configuration (Manifest v3)
├── background.js          # Background service worker
├── content.js             # Content script that modifies images on web pages
├── popup.html             # Extension popup UI
├── popup.js               # Popup UI logic
├── test.html              # Test page with sample Optimole images
├── icon16.png             # Extension icon (16x16)
├── icon48.png             # Extension icon (48x48)
└── icon128.png            # Extension icon (128x128)
```

### File Descriptions
- **manifest.json**: Defines extension permissions, content scripts, and metadata
- **background.js**: Handles extension lifecycle, storage, and message passing
- **content.js**: Runs on web pages to detect and modify Optimole image URLs
- **popup.html/js**: Provides user interface for configuring extension settings
- **test.html**: Contains sample Optimole images for testing functionality

### Key Functions to Know
- **URL modification logic**: Located in `content.js` - `buildOptimoleParams()` function
- **Settings storage**: Background script handles Chrome storage API
- **Dynamic image detection**: Content script uses MutationObserver to watch for new images
- **Debug functionality**: Test page provides `moleTweakerDebug` object for inspection

### Development Workflow
1. Make code changes
2. Run syntax validation (`node -c *.js`)
3. **ALWAYS reload extension in Chrome**: Go to `chrome://extensions/` and click reload button for Mole Tweaker
4. Test on `test.html` page with all scenarios
5. Verify no console errors in browser Developer Tools
6. Run ESLint if making significant changes
7. Test edge cases (disable/enable, page reload, different domains)

### Troubleshooting
- **Extension not loading**: Check manifest.json syntax and verify all referenced files exist
- **Images not being modified**: Verify extension is enabled for the domain and check browser console for errors
- **Settings not persisting**: Check Chrome storage permissions in manifest.json
- **Content script errors**: Use Developer Tools to debug, ensure Chrome extension context is available
- **"Cannot access chrome APIs"**: Ensure you're testing in actual Chrome browser, not other browsers or headless mode
- **Extension popup not opening**: Check popup.html syntax and referenced files; reload extension after changes
- **Changes not taking effect**: Always reload extension in `chrome://extensions/` after modifying any files
- **Network errors on test page**: Expected behavior - external images are blocked, focus on URL modification testing

### Performance Notes
- Extension has minimal performance impact - only processes Optimole URLs
- Settings are cached per domain to reduce storage API calls
- MutationObserver efficiently watches for dynamic content changes
- No network requests or external dependencies

## Critical Reminders
- This extension requires **NO build process** - files work directly
- **ALWAYS test in an actual Chrome browser** - extension APIs don't work in other contexts
- Settings are domain-specific and persist across page loads
- Only Optimole image URLs should be modified, other images must remain unchanged
- Extension uses Manifest v3 APIs (service worker, not background page)