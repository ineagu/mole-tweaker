# Mole Tweaker

A Chrome extension that allows you to modify Optimole image URL parameters for better control over image quality, format, and device pixel ratio.

## Features

- **Enable/Disable per page**: Toggle the extension on or off for specific domains
- **Quality Control**: Adjust image quality (q parameter) - set to auto, specific numbers (99, 90, 80, etc.)
- **Format Control**: Set format parameter (f) to "best" or remove it entirely
- **Image Format**: Remove image format conversion (ig parameter) like "avif"
- **Device Pixel Ratio**: Control DPR (dpr parameter) - set to 1x, 2x, 3x, or remove

## How it works

The extension detects Optimole URLs on web pages and modifies their parameters according to your settings. 

Example Optimole URL:
```
https://mlmn3tzhtmqy.i.optimole.com/w:551/h:426/q:mauto/ig:avif/https://www.example.com/image.png
```

The extension can modify parameters like:
- `q:mauto` → `q:99` (quality)
- `ig:avif` → removed (no format conversion)
- Add `dpr:2` (device pixel ratio)
- Add `f:best` (format optimization)

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The Mole Tweaker extension should now appear in your extensions

### Usage

1. Navigate to a page that uses Optimole images
2. Click the Mole Tweaker extension icon in your browser toolbar
3. Toggle "Enable for this page" to activate the extension
4. Adjust the parameters as desired:
   - **Quality**: Choose from auto, specific numbers, or keep original
   - **Format**: Set to "best", remove, or keep original
   - **Image Format**: Remove format conversion or keep original  
   - **Device Pixel Ratio**: Set to 1x, 2x, 3x, remove, or keep original
5. Click "Apply Changes" to update all Optimole images on the page
6. Use "Reset" to restore default settings

## Settings are saved per domain

The extension remembers your settings for each website domain, so you don't need to reconfigure every time you visit.

## Technical Details

- Uses Chrome Extension Manifest V3
- Content script processes images on page load and watches for dynamically added images
- Settings are stored locally using Chrome's storage API
- Non-invasive: only modifies Optimole URLs, leaves other images unchanged
- Restores original URLs when disabled

## Development

The extension consists of:
- `manifest.json` - Extension configuration
- `popup.html/js` - User interface for controlling settings
- `content.js` - Script that modifies images on web pages
- `background.js` - Background service worker for extension management

## License

MIT License