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
- [ ] **Google Drive Backup** - Auto-backup queue and settings
- [ ] **Dropbox Sync** - Sync download folder to Dropbox
- [ ] **iCloud Sync** - Sync across Mac devices
- [ ] **Export Download List** - Export as CSV/JSON/Markdown
- [ ] **Import from Other Apps** - Import history from 4K Downloader, JDownloader

### ⏰ Scheduling
- [ ] **Download at Specific Time** - Schedule single download
- [ ] **Recurring Schedule** - Check channel every Monday at 9am
- [ ] **Wake Computer** - Wake from sleep to download
- [ ] **Shutdown After Complete** - Auto-shutdown when queue done
- [ ] **Pause During Work Hours** - Auto-pause 9am-5pm

### 📺 Video-Specific
- [ ] **Live Stream Recorder** - Auto-record when stream goes live
- [ ] **Premiere Downloader** - Download video right after premiere ends
- [ ] **Members-Only Support** - Download with YouTube membership
- [ ] **Age-Restricted Support** - Handle age-gated content
- [ ] **Shorts Filter** - Exclude/Include only YouTube Shorts

### 🎧 Audio/Podcast
- [ ] **Podcast RSS Generator** - Create RSS feed from playlist
- [ ] **Podcast Player** - Built-in audio player
- [ ] **Chapters Support** - Preserve YouTube chapters in audio
- [ ] **Silence Remover** - Remove silent parts from audio
- [ ] **Volume Normalizer** - Normalize audio across downloads

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
- [ ] **Chapter Markers** - Export chapters as JSON/timestamps
- [ ] **Video Info Card** - Generate info card with all metadata

### 🏠 Home Server
- [ ] **Headless Mode** - Run without GUI (server)
- [ ] **Web Interface** - Browser-based control panel
- [ ] **NAS Integration** - Direct save to network storage
- [ ] **Plex/Jellyfin Auto-Scan** - Trigger library refresh after download
- [ ] **Docker Image** - Official Docker container

### 🔋 Power & Battery
- [ ] **Battery Aware** - Pause downloads on low battery
- [ ] **Power Saver Mode** - Slower downloads, less CPU
- [ ] **UPS Detection** - Pause if on battery backup
- [ ] **Laptop Lid Close Action** - Configure behavior

### 🎯 Focus Mode
- [ ] **Distraction Free** - Minimal UI, no animations
- [ ] **Work Mode** - Pause downloads, hide notifications
- [ ] **Focus Timer** - Pomodoro-style download breaks

### 🧠 AI/ML Features
- [ ] **Auto Categorize** - AI detects video category (music, tutorial, vlog, news)
- [ ] **Content Summary** - Generate summary of video using AI
- [ ] **Smart Recommendations** - ML-based video suggestions
- [ ] **Auto Tagging** - AI-generated tags for organization
- [ ] **Sentiment Analysis** - Detect positive/negative content
- [ ] **Language Detection** - Auto-detect and filter by language
- [ ] **Scene Detection** - Split video by scenes automatically

### 🎓 Educational
- [ ] **Course Mode** - Organize playlists as courses with progress
- [ ] **Lecture Speed Up** - Auto-detect and speed up silent parts
- [ ] **Note Taking** - Add notes at specific timestamps
- [ ] **Flashcard Generator** - Create flashcards from video content
- [ ] **Quiz Mode** - Test knowledge from watched content
- [ ] **Citation Generator** - Generate academic citations for videos
- [ ] **Transcript Search** - Search within video transcripts

### 🛡️ Parental Controls
- [ ] **Content Filtering** - Block mature content
- [ ] **Time Limits** - Limit download times per day
- [ ] **Approved Channels Only** - Whitelist specific channels
- [ ] **Download Quotas** - Max downloads per day/week
- [ ] **Age-Based Profiles** - Different rules per profile
- [ ] **Activity Reports** - Weekly reports for parents

### 🔗 Integrations
- [ ] **Notion Integration** - Save video info to Notion database
- [ ] **Obsidian Integration** - Create notes with video embeds
- [ ] **Todoist Integration** - Add videos as tasks
- [ ] **IFTTT/Zapier** - Connect to automation services
- [ ] **Slack Notifications** - Post to Slack on completion
- [ ] **Telegram Bot** - Control via Telegram
- [ ] **Email Reports** - Daily/weekly email summaries

### 🎮 Gaming/Streaming
- [ ] **Stream Recording** - Record specific streamers automatically
- [ ] **Chat Download** - Download Twitch/YouTube chat logs
- [ ] **Clip Creator** - Auto-create clips from highlights
- [ ] **Highlight Detection** - Find exciting moments automatically
- [ ] **Multi-Stream Monitor** - Watch multiple streams for going live

### 📊 Advanced Analytics
- [ ] **Download Heatmap** - Visualize when you download most
- [ ] **Category Breakdown** - Stats by video type
- [ ] **Cost Calculator** - Calculate bandwidth/storage costs
- [ ] **Trend Analysis** - Track downloading habits over time
- [ ] **Export Analytics** - Export stats to Excel/Google Sheets
- [ ] **Comparison View** - Compare month-to-month stats

### 🌍 Localization
- [ ] **Multi-Language UI** - Support 10+ languages
- [ ] **Auto Translate Titles** - Translate video titles to user language
- [ ] **Auto Translate Captions** - Download auto-translated subtitles
- [ ] **Regional Settings** - Date/time/number formats
- [ ] **RTL Support** - Right-to-left language support

### 🧪 Experimental
- [ ] **VR Video Support** - Download 360°/VR videos
- [ ] **3D Video Support** - Download 3D content
- [ ] **8K Support** - Ultra-high quality downloads
- [ ] **HDR Preservation** - Keep HDR metadata
- [ ] **Spatial Audio** - Download with spatial/ambisonics
- [ ] **AV1 Codec** - Next-gen codec support

### 🔐 Enterprise/Pro
- [ ] **Team Workspaces** - Shared download queues
- [ ] **Role-Based Access** - Admin/editor/viewer roles
- [ ] **Audit Logs** - Track all actions
- [ ] **SSO Integration** - Single sign-on for teams
- [ ] **Priority Support** - Dedicated support channel
- [ ] **Custom Branding** - White-label version
- [ ] **SLA Uptime** - Guaranteed uptime for API

### 🎵 Music Specific
- [ ] **Spotify Integration** - Sync with Spotify playlists
- [ ] **Apple Music Integration** - Sync with Apple Music
- [ ] **Album Art Downloader** - High-res album art
- [ ] **Artist Metadata** - Fetch artist info, genres
- [ ] **Lyrics Embed** - Embed lyrics in audio files
- [ ] **MusicBrainz Tagging** - Accurate music tagging
- [ ] **Playlist Sync** - Keep local in sync with streaming

### 📱 Mobile Features
- [ ] **iOS App** - Native iPhone app
- [ ] **Android App** - Native Android app
- [ ] **Mobile Sync** - Sync between desktop and mobile
- [ ] **Offline Mode** - Download directly to phone
- [ ] **Mobile Casting** - Cast to Chromecast/AirPlay
- [ ] **Wear OS App** - Control from smartwatch
- [ ] **Watch App** - Apple Watch control

### 🔄 Workflows
- [ ] **Rule Engine** - If/then rules for auto-actions
- [ ] **Workflow Builder** - Visual workflow creator
- [ ] **Folder Watch** - Auto-process new files in folder
- [ ] **Email Monitor** - Download from email links
- [ ] **RSS Monitor** - Download from RSS feeds
- [ ] **Calendar Integration** - Schedule from calendar events

### 🎨 Content Creation
- [ ] **GIF Creator** - Create GIFs from video segments
- [ ] **Meme Generator** - Create memes from frames
- [ ] **Video to Images** - Extract all frames
- [ ] **Audio to Video** - Create video from audio + image
- [ ] **Slideshow Creator** - Make slideshow from images
- [ ] **Quote Cards** - Generate quote images from captions

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
