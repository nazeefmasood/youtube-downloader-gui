# VidGrab Browser Extension

This Chrome extension allows you to download YouTube videos directly to the VidGrab desktop app.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top right
3. Click "Load unpacked"
4. Select this `extension` folder
5. The VidGrab extension icon should appear in your browser toolbar

## Usage

1. **Make sure VidGrab desktop app is running** - The extension communicates with the app via a local HTTP server on port 3847
2. Navigate to any YouTube video
3. Click the green "Download" button below the video player, OR
4. Click the VidGrab extension icon in your browser toolbar
5. Select your preferred quality/format
6. Click "Add to Queue"
7. The download will start in the VidGrab app

## Features

- One-click download button on YouTube video pages
- Quality selection popup
- Downloads are queued in the VidGrab app
- Works with regular videos and YouTube Shorts

## Troubleshooting

### "VidGrab Not Running" message
- Make sure the VidGrab desktop app is open
- The app needs to be running before you can send downloads

### Download button not appearing
- Try refreshing the YouTube page
- The button appears in the action bar below the video (next to Like/Share)
- YouTube's interface may take a moment to load

### Extension icon shows disconnected
- Restart the VidGrab desktop app
- Make sure no firewall is blocking localhost connections on port 3847

## Permissions

This extension requires minimal permissions:
- `activeTab`: To detect when you're on a YouTube page
- `storage`: To store temporary data like the selected URL
- `http://127.0.0.1:3847/*`: To communicate with the VidGrab app

The extension only communicates with localhost and YouTube.
