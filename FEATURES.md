# VidGrab Feature Roadmap

> Track planned and implemented features. Check the box when complete.

---

## High Priority Features

- [ ] **Batch URL Paste** - Paste multiple URLs at once, auto-detect and add to queue
- [ ] **Speed Limiter** - Throttle bandwidth per download or globally
- [ ] **Watch Folder** - Auto-download new videos from subscribed channels

---

## Quality of Life

- [ ] **Keyboard Shortcuts** - Global hotkeys for common actions (add URL, pause all, settings)
- [ ] **Drag & Drop URLs** - Drop URLs directly onto app window to add to queue
- [ ] **Search History** - Search through past downloads by title, channel, URL
- [ ] **Export/Import Queue** - Save and restore download queues as JSON files
- [ ] **Notification Sounds** - Audio feedback on download completion/failure

---

## Analytics & Monitoring

- [ ] **Download Stats Dashboard** - Total downloaded (size/count), bandwidth used, time saved
- [ ] **Bandwidth Graph** - Real-time network usage visualization (chart)
- [ ] **Failed Download Retry** - Auto-retry with exponential backoff, max attempts config

---

## UI/UX Enhancements

- [ ] **Mini Mode** - Compact always-on-top window for monitoring downloads
- [ ] **System Tray** - Minimize to tray, continue downloads in background
- [ ] **Dark/Light Theme Toggle** - Theme switcher in settings
- [ ] **Custom Themes** - User-defined color schemes with preset options

---

## Integration

- [ ] **Send to Phone** - Transfer downloads to mobile device via QR code / WiFi Direct

---

## Additional Ideas (Backlog)

### 🎬 Video Processing
- [ ] **Trim/Cut Video** - Download only a portion (start time - end time)
- [ ] **Video Converter** - Convert to MP4, MKV, AVI, WebM after download
- [ ] **Audio Converter** - Convert to MP3, AAC, FLAC, OPUS
- [ ] **Video Compressor** - Reduce file size with quality presets
- [ ] **Merge Videos** - Combine multiple downloads into one file
- [ ] **Extract Frames** - Save video frames as images (PNG/JPG)

### 🎵 Audio Features
- [ ] **Audio-only Mode** - Dedicated tab for music/podcasts
- [ ] **Metadata Editor** - Edit ID3 tags (artist, album, cover art)
- [ ] **Lyrics Downloader** - Fetch and embed lyrics
- [ ] **Playlist to Album** - Convert playlists to properly tagged albums

### 🔍 Discovery & Search
- [ ] **In-App YouTube Search** - Search YouTube without opening browser
- [ ] **Trending Videos** - Show trending content by region
- [ ] **Recommended Videos** - Suggestions based on download history
- [ ] **Channel Browser** - Browse channels within the app

### ⚡ Performance
- [ ] **Multi-threaded Downloads** - Split files into chunks for faster speeds
- [ ] **Proxy Support** - SOCKS5/HTTP proxy configuration
- [ ] **VPN Integration** - Kill switch if VPN disconnects
- [ ] **Concurrent Downloads** - Download multiple files simultaneously

### 🔐 Privacy & Security
- [ ] **Private Mode** - Don't save history, clear on exit
- [ ] **Password Protection** - Lock app with password/PIN
- [ ] **Encrypted Storage** - Encrypt downloaded files
- [ ] **Incognito Downloads** - Download without cookies/auth

### 🎮 Fun & Social
- [ ] **Download Achievements** - Gamify downloads (100 videos, 10GB, etc.)
- [ ] **Share Statistics** - Generate shareable download stats image
- [ ] **Discord Rich Presence** - Show current download on Discord
- [ ] **Download Battles** - Compare stats with friends

### 📱 Mobile Companion
- [ ] **Remote Control App** - Control desktop app from phone
- [ ] **Sync Queue** - Sync downloads between devices
- [ ] **Push Notifications** - Get notified on phone when done

### 🛠️ Advanced
- [ ] **Custom yt-dlp Arguments** - Advanced users can add custom flags
- [ ] **Post-Download Scripts** - Run shell commands after download
- [ ] **Webhook Notifications** - Send HTTP webhook on events
- [ ] **CLI Mode** - Command-line interface for automation
- [ ] **API Server** - REST API for programmatic control

### 🌍 Accessibility
- [ ] **High Contrast Mode** - For visually impaired users
- [ ] **Screen Reader Support** - Full ARIA labels
- [ ] **Font Size Scaling** - Adjustable text size

### 🎨 Personalization
- [ ] **Custom Window Frame** - Remove OS chrome, custom titlebar
- [ ] **Download Sounds** - Custom sound packs
- [ ] **Avatar/Profile** - User profile with stats badge
- [ ] **Desktop Widgets** - Floating download progress widget

---

## Completed Features (v1.0 - v1.3)

- [x] Core video download with yt-dlp
- [x] Playlist support
- [x] Channel support
- [x] Format selection (video/audio quality)
- [x] Download queue management
- [x] Browser extension integration
- [x] Auto-update system
- [x] Cross-platform builds (Win/Mac/Linux)
- [x] PO Token support for YouTube bot protection
- [x] Dynamic rate-limit delays
- [x] PO token status UI

---

## Implementation Notes

### Batch URL Paste
- Detect multiple URLs in clipboard (newline or comma separated)
- Show preview modal before adding to queue
- Support YouTube URLs only initially

### Speed Limiter
- Use yt-dlp `--limit-rate` flag
- Add global setting + per-download override
- Presets: 1MB/s, 5MB/s, 10MB/s, Unlimited

### Watch Folder
- Store channel/playlist subscriptions in JSON
- Background check on startup + interval (configurable)
- Notify user of new videos available
- Option to auto-add to queue or manual approve

### Keyboard Shortcuts
```
Ctrl+V        - Paste and analyze URL
Ctrl+A        - Add to queue
Space         - Pause/Resume selected
Ctrl+P        - Pause all downloads
Ctrl+S        - Settings
Ctrl+H        - Toggle history
Esc           - Clear selection
```

### Mini Mode
- 300x400px compact window
- Show current download + queue count
- Progress bar only
- Always on top option

### System Tray
- Icon with download indicator
- Right-click menu: Pause all, Resume all, Open window, Quit
- Notification on download complete

### Send to Phone
- Generate local HTTP server with QR code
- Phone scans QR, connects to same WiFi
- Transfer via HTTP download on phone
- Show transfer progress

---

*Last updated: 2026-02-14*
*Version: v1.3.0-beta*
