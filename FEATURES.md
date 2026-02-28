# VidGrab Feature Roadmap

> Track planned and implemented features. Check the box when complete.

---

## High Priority Features

- [x] **Batch URL Paste** - Paste multiple URLs at once, auto-detect and add to queue
- [x] **Speed Limiter** - Throttle bandwidth per download or globally
- [x] **Watch Folder** - Auto-download new videos from subscribed channels (checks on launch + every 2 hours)

---

## Quality of Life

- [x] **Keyboard Shortcuts** - Global hotkeys for common actions (add URL, pause all, settings)
- [x] **Drag & Drop URLs** - Drop URLs directly onto app window to add to queue
- [ ] **Search History** - Search through past downloads by title, channel, URL
- [ ] **Export/Import Queue** - Save and restore download queues as JSON files
- [x] **Notification Sounds** - Audio feedback on download completion/failure

---

## Analytics & Monitoring

- [ ] **Download Stats Dashboard** - Total downloaded (size/count), bandwidth used, time saved
- [ ] **Bandwidth Graph** - Real-time network usage visualization (chart)
- [ ] **Failed Download Retry** - Auto-retry with exponential backoff, max attempts config

---

## UI/UX Enhancements

- [ ] **Mini Mode** - Compact always-on-top window for monitoring downloads
- [ ] **System Tray** - Minimize to tray, continue downloads in background
- [x] **Dark/Light Theme Toggle** - Theme switcher in settings (Ctrl+L)
- [ ] **Custom Themes** - User-defined color schemes with preset options
- [x] **Cyber Brutalist Close Dialog** - Exit confirmation modal redesigned to match app theme

---

## Integration

- [ ] **Send to Phone** - Transfer downloads to mobile device via QR code / WiFi Direct

---

## Additional Ideas (Backlog)

### 🤖 Smart Features

- [ ] **Duplicate Detector** - Warn if video already downloaded (by title/ID)
- [ ] **Broken Link Checker** - Check if saved URLs are still valid
- [ ] **Storage Predictor** - Estimate required space before downloading playlist
- [ ] **Smart Filename** - Auto-rename based on rules (remove emojis, fix encoding)
- [ ] **Dead Video Alert** - Notify if a saved video gets deleted from YouTube

### 📁 Organization

- [ ] **Auto Folder by Date** - Organize into Year/Month folders
- [ ] **Auto Folder by Channel** - Create folder per channel name
- [ ] **Auto Folder by Type** - Music vs Video vs Podcast folders
- [ ] **Custom Naming Rules** - Pattern-based filenames with variables
- [ ] **File Tags** - Add tags to downloads for filtering

### 🔄 Sync & Backup

- [ ] **Export Download List** - Export as CSV/JSON/Markdown

### ⏰ Scheduling

- [ ] **Download at Specific Time** - Schedule single download
- [ ] **Recurring Schedule** - Check channel every Monday at 9am
- [ ] **Wake Computer** - Wake from sleep to download
- [ ] **Shutdown After Complete** - Auto-shutdown when queue done
- [ ] **Pause During Work Hours** - Auto-pause 9am-5pm

### 🌐 Multi-Platform

- [ ] **Twitch Support** - Download Twitch VODs/clips
- [ ] **Twitter/X Support** - Download videos from tweets
- [ ] **TikTok Support** - Download TikTok videos
- [ ] **Instagram Support** - Download Reels/Stories
- [ ] **Reddit Support** - Download videos from Reddit
- [ ] **Vimeo Support** - Download Vimeo videos
- [ ] **Universal URL Detection** - Auto-detect any supported platform

### 👨‍💻 Creator Tools

- [ ] **Thumbnail Grabber** - Download all video thumbnails
- [ ] **Description Saver** - Save video descriptions as text files
- [ ] **Comment Downloader** - Export comments to JSON
- [ ] **Caption Export** - Export all subtitle languages

### 🔋 Power & Battery

- [ ] **Battery Aware** - Pause downloads on low battery
- [ ] **Power Saver Mode** - Slower downloads, less CPU
- [ ] **UPS Detection** - Pause if on battery backup
- [ ] **Laptop Lid Close Action** - Configure behavior

### 🔗 Integrations

- [ ] **Telegram Bot** - Control via Telegram
- [ ] **Email Reports** - Daily/weekly email summaries

### 🧪 Experimental

- [ ] **8K Support** - Ultra-high quality downloads
- [ ] **HDR Preservation** - Keep HDR metadata
- [ ] **Spatial Audio** - Download with spatial/ambisonics
- [ ] **AV1 Codec** - Next-gen codec support

### 📱 Mobile Features

- [ ] **Android App** - Native Android app

---

## Completed Features (v1.0 - v1.5)

### v1.5.2
- [x] Close Confirmation Dialog — Always prompts on close with minimize/quit options
- [x] Drag & Drop URL Support — Drop YouTube URLs directly onto the app
- [x] Search Results Persistence — Results stay when switching tabs
- [x] Performance Optimizations — yt-dlp flags, IPC throttling, memoized counts
- [x] Enhanced Theme System — Full CSS variable support for all UI elements
- [x] Removed Mini Mode Toggle — Simplified title bar

### v1.5.1
- [x] Cyber Brutalist Close Dialog — Exit confirmation modal redesigned to match app theme

### v1.5.0
- [x] Batch Download System with configurable batch size
- [x] Per-Video Quality Selection for playlists
- [x] Playlist Visual Grouping in Downloads tab
- [x] YouTube Search integration
- [x] Changelog auto-display on updates

### v1.0 - v1.4
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
- [x] FFmpeg auto-download
- [x] Binary status indicators

---

## Implementation Notes

### Batch URL Paste ✅ Implemented

- Detect multiple URLs in clipboard (newline or comma separated)
- Show preview modal with select/deselect functionality
- Support YouTube videos, playlists, and channels
- Batch add to queue with grouping

### Speed Limiter ✅ Implemented

- Use yt-dlp `--limit-rate` flag
- Global setting in Settings panel
- Presets: Unlimited, 1MB/s, 2MB/s, 5MB/s, 10MB/s, 20MB/s, 50MB/s

### Watch Folder ✅ Implemented

- Store channel/playlist subscriptions in JSON
- Check on app launch (5 seconds after)
- Periodic check every 2 hours
- Notify user of new videos via IPC event
- Backend ready for UI integration

### Keyboard Shortcuts ✅ Implemented

```
Ctrl+O        - Open download folder
Ctrl+N        - New download (reset)
Ctrl+1        - Switch to Analyze view
Ctrl+2        - Switch to Downloads view
Ctrl+3        - Switch to History view
Ctrl+4        - Switch to Settings view
Ctrl+L        - Toggle theme (dark/light)
Esc           - Close modal
```

### Mini Mode

- 300x400px compact window
- Show current download + queue count
- Progress bar only
- Always on top option

### System Tray

- Icon with download indicator, and progress and list of active downloads
- Right-click menu: Pause all, Resume all, Open window, Quit
- Notification on download complete

### Send to Phone

- Generate local HTTP server with QR code
- Phone scans QR, connects to same WiFi
- Transfer via HTTP download on phone
- Show transfer progress

---

_Last updated: 2026-02-28_
_Version: v1.5.2_
