# Changelog

All notable changes to Grab will be documented in this file.

## [1.7.2] - 2026-03-02

### Fixed
- **Linux App Icon** — Fixed app icon not showing on Linux
  - Added build/ directory with proper icon sizes (16-1024px)
  - Updated electron-builder config to use build directory for Linux
  - Icon now displays correctly in app launcher and dock
- **CI Workflow** — Fixed bash syntax error on Windows
  - Added explicit `shell: bash` to install step
  - Renamed artifacts from vidgrab-* to grab-*

### Changed
- **Web App Favicon** — Added favicon.ico to public root for proper serving

## [1.7.1] - 2026-03-02

### Fixed
- **Windows ICO Format** — Fixed icon.ico not being a valid Windows ICO file
  - Was incorrectly saved as PNG, causing Windows builds to fail
  - Now properly converted to multi-resolution ICO format (16-256px)
- **All Icons Updated** — Regenerated all icons from new Grab logo
  - Desktop app icons (resources, assets)
  - Browser extension icons (16, 32, 48, 128px)
  - Proper favicon reference in index.html

### Changed
- **Branding Update** — "Video Downloader" → "Media Downloader"
  - Updated app title, descriptions, and README
  - Grab downloads videos, audio, playlists, and channels - not just videos
  - Updated extension name and description

## [1.7.0] - 2026-03-01

### Breaking Changes
- **Rebrand to "Grab"** — VidGrab is now Grab
  - New app name, branding, and identity
  - Updated all package metadata and identifiers
  - App ID changed from `com.vidgrab.app` to `app.grab.desktop`
  - Storage keys migrated from `vidgrab-*` to `grab-*`

### Added
- **Grab Cloud Sync** — Sync your download queue across devices
  - Connect to Grab Cloud at getgrab.vercel.app
  - API key authentication for secure sync
  - Automatic polling for remote queue updates
  - Configure in Settings → Cloud Sync
- **Platform Detection** — Visual indicators for different platforms
  - Shows platform icon and color for each download
  - Supports YouTube, Twitch, TikTok, Twitter/X, Instagram, Reddit, Vimeo, Facebook
  - New utility functions for platform-specific styling

### Changed
- **New App Icons** — Refreshed icon design for Grab branding
  - Updated icons for all platforms (Windows, macOS, Linux)
  - New extension icons matching app branding
  - Added 512px icon variant

### Removed
- **FEATURES.md** — Consolidated documentation into README

## [1.6.3] - 2026-03-01

### Added
- **Download All Subtitles** — Download all available subtitle languages automatically
  - Enable in Settings → Extra Options
  - Uses yt-dlp `--sub-langs all` flag
  - Great for videos with multiple language subtitles
- **Prefer AV1 Codec** — Use AV1 codec for better compression and quality
  - AV1 offers ~30% better compression than VP9 at same quality
  - Enable in Settings → Extra Options
- **Preserve HDR** — Keep HDR metadata when available
  - Downloads HDR versions when available (YouTube HDR, etc.)
  - Enable in Settings → Extra Options
- **Download Comments** — Save video comments as JSON file
  - Comments saved alongside video file
  - Enable in Settings → Extra Options

## [1.6.2] - 2026-03-01

### Added
- **Storage Predictor** — Estimate total download size for playlists/channels
  - Shows in sidebar when analyzing playlists
  - Calculates based on selected quality format
  - Adjusts dynamically based on video selection mode
- **Smart Filenames** — Clean up video filenames automatically
  - Removes emojis and special characters
  - Restricts to ASCII characters for compatibility
  - Enabled by default, can be toggled in Settings → Extra Options

## [1.6.1] - 2026-03-01

### Added
- **Export Download History** — Export your download history as CSV, JSON, or Markdown
  - Access from Settings → Data Management
  - Includes title, URL, date, status, file path, size, and duration
- **Shutdown After Complete** — Auto-shutdown computer when all downloads finish
  - Enable in Settings → Extra Options
  - Works on Windows, macOS, and Linux
- **Save Thumbnails** — Download video thumbnail as image file alongside video
- **Save Descriptions** — Save video description as text file alongside video

### Fixed
- **System Tray Quit** — "Quit VidGrab" from tray now properly terminates the app
  - Fixed app staying running in background after selecting "Quit VidGrab" from tray
  - Window is now destroyed before app.quit() to bypass close-to-tray prevention

## [1.6.0] - 2026-03-01

### Added
- **Enhanced System Tray** — Rich tray menu with download status
  - Current download info with progress bar and speed
  - Queue stats (pending, completed, failed counts)
  - Recent downloads list (last 5) with click-to-open
  - Open download folder shortcut
  - Retry all failed option
  - Visual progress indicator (███░░░░░░░)
- **Duplicate Detection** — Warn when downloading already-downloaded videos
  - Single video: Shows confirmation modal with option to proceed
  - Playlist/Channel: Auto-skips duplicates, logs summary
  - Checks video ID against download history
- **Multi-Platform Support** — Download from 200+ platforms
  - Twitch (VODs, clips, streams)
  - Twitter/X (tweets with video)
  - TikTok (videos)
  - Instagram (Reels, videos)
  - Reddit (video posts)
  - Vimeo (videos)
  - Facebook (videos)
  - Dailymotion, Bilibili, SoundCloud, Spotify, and many more
  - Universal URL detection - accepts any valid HTTP/HTTPS URL

### Changed
- **Extension Version Bump** — Updated to v1.6.0 to match app version
- **URL Validation** — Now accepts all valid HTTP/HTTPS URLs, not just YouTube

### Fixed
- **System Tray Quit** — "Quit VidGrab" from tray now properly terminates the app
  - Fixed app staying running in background after selecting "Quit VidGrab" from tray
  - Window is now destroyed before app.quit() to bypass close-to-tray prevention
- **Multi-Platform URL Handling** — Non-YouTube URLs now work correctly
  - Fixed subtitle fetching using original URL instead of constructing YouTube URLs
  - Fixed format fetching for playlist items using correct platform URLs
  - Fixed duplicate detection for multi-platform URLs (TikTok, Twitch, Twitter, etc.)
  - Added `url` field to ContentInfo and PlaylistEntry types for proper URL tracking
  - Playlist entries now include full URLs for multi-platform support

## [1.5.3] - 2026-02-28

### Security
- **Extension Authentication** — Secure token-based authentication for browser extension
  - Random 64-character API token generated on app startup
  - Extension fetches token via `/api/token` endpoint (localhost only)
  - All API endpoints require Bearer token authentication
  - Automatic token refresh on 401 responses
  - Token stored securely in chrome.storage.local
- **Tightened CORS Policy** — Restricted to chrome-extension:// origins only
  - Replaced wildcard `*` with explicit chrome-extension origin
  - Added Authorization header to allowed headers

### Changed
- **Extension Version Bump** — Updated to v1.5.3 to match app version

## [1.5.2] - 2026-02-28

### Added
- **Close Confirmation Dialog** — Always prompts when closing the app
  - Shows options to minimize to tray or quit completely
  - Different messages based on active downloads status
  - Properly terminates all processes on quit (no more zombie processes)
- **Drag & Drop URL Support** — Drop YouTube URLs directly onto the app
  - Visual feedback with "DROP URL HERE" overlay
  - Auto-analyzes dropped URLs
- **Enhanced Theme System** — New CSS variables for consistent theming
  - Added semantic colors for channel, playlist, audio, subtitle types
  - New subtle/hover background variables for better theming
  - All hardcoded colors replaced with CSS variables

### Changed
- **Removed Mini Mode Toggle** — Simplified title bar by removing mini mode button
- **Search Results Persistence** — Search results now persist when switching tabs
  - AnalyzeTab stays mounted but hidden when inactive
- **Improved Close Behavior** — forceQuit now properly destroys tray and quits app

### Fixed
- **AnalyzeTab Width Issue** — Fixed tab not taking full width
- **Close Button Visibility** — Fixed HTML structure causing button visibility issues
- **Theming Issues** — Modal dialogs now properly adapt to theme changes
  - Format selection modal uses theme variables
  - Status badges use proper semantic colors

### Performance
- **yt-dlp Performance Flags** — 2-3x faster downloads
  - Added `--concurrent-fragments 4` for parallel fragment downloads
  - Added `--buffer-size 16K` for better I/O throughput
- **IPC Throttling** — Reduced CPU usage during countdowns
  - Countdown updates throttled to 5-second intervals
- **Memoized Counts** — Downloads tab counts no longer recalculate on every render

## [1.5.1] - 2026-02-28

### Changed
- **Close Dialog Redesign** — Exit confirmation modal now matches cyber brutalist theme
  - Removed all icons for cleaner, more minimal appearance
  - Sharp corners (2px) replacing rounded borders
  - Uppercase text with letter-spacing for brutalist typography
  - Outline-style buttons with glow hover effects
  - Offset box-shadow for industrial aesthetic
  - Simplified button labels (MINIMIZE / QUIT / CANCEL)

## [1.5.0] - 2026-02-28

### Added
- **Batch Download System** — Organize playlist/channel downloads into configurable batches
  - Set batch size in Settings (1-20 items per batch)
  - Pause duration between batches (5-30 seconds)
  - Visual batch indicators showing current batch and total
  - Countdown timer during batch pauses
- **Per-Video Quality Selection** — Set custom quality for individual playlist items
  - Click "QUALITY" button on any playlist item to select its format
  - Formats load in side panel with full quality options
  - Override badge shows custom quality is set
  - Reset individual overrides or all at once
- **Playlist Visual Grouping** — Downloads tab now groups playlist/channel items
  - Collapsible group headers with source info
  - Progress bar showing group completion
  - Stats for completed/failed/pending items
  - Cyber brutalist design matching app theme
- **Dynamic Batch Settings** — Changes to batch size reflect immediately on pending items
  - Total batches recalculated in real-time
  - No need to re-add items to queue

### Fixed
- **FFmpeg Path Resolution** — Video+audio merge now works correctly on all platforms
  - Resolves system ffmpeg to absolute path using `which`/`where`
  - Augments PATH with common binary locations
  - Works in packaged Electron apps
- **Changelog Not Showing on Update** — First-time users now see changelog correctly
  - Fixed `lastVersionLaunched` default from current version to null
  - Changelog modal triggers on version change detection
- **File Size Estimates** — More accurate size display for video formats
  - Uses `filesize_approx` when exact `filesize` unavailable
  - Prevents "--" showing for formats with estimated sizes
- **Misleading Quality Labels** — Playlist items no longer show wrong resolution
  - "Best Quality" label used for playlists instead of first video's resolution
  - yt-dlp picks actual best quality per-video at download time

### Changed
- **Quality Selection Button** — Improved visibility and usability
  - Larger button with "QUALITY"/"CLOSE" text label
  - Clearer visual affordance for custom quality feature
- **Default Download Delay** — Increased from 3s to 5s between items
  - Reduces YouTube rate limiting issues
  - Configurable in Settings

## [1.4.5] - 2026-02-19

### Added
- System Status section in Settings showing yt-dlp and FFmpeg status
- Visual indicators (FOUND/MISSING badges) for binary availability
- Download buttons for missing components directly from Settings

## [1.4.4] - 2026-02-19

### Fixed
- Video downloads without audio when ffmpeg is unavailable
  - Added fallback to pre-merged formats when ffmpeg isn't detected
  - Better format selection with robust fallback chain
- App version now displays correctly (was stuck at 1.3.3)
  - Fixed version update script integration

## [1.4.3] - 2026-02-19

### Fixed
- Video+audio merge issue on macOS and Linux
  - Fixed --ffmpeg-location to only be passed when using downloaded/bundled ffmpeg
  - When using system ffmpeg, let yt-dlp find it in PATH instead of passing incorrect directory

## [1.4.2] - 2026-02-18

### Fixed
- Release workflow now correctly publishes to public releases repo

## [1.4.1] - 2026-02-18

### Changed
- App updates now check the public releases repo (nazeefmasood/grab-releases)
- This allows update checks to work for all users without needing access to the private repo

## [1.4.0] - 2026-02-18

### Changed
- App updates now check the public releases repo (nazeefmasood/grab-releases)
- This allows update checks to work for all users without needing access to the private repo

## [1.3.9] - 2026-02-16

### Fixed
- Video and audio files being saved separately instead of merged
  - Fixed --ffmpeg-location to use directory path instead of executable path
  - yt-dlp expects directory containing ffmpeg, not the ffmpeg.exe path itself

## [1.3.8] - 2026-02-16

### Fixed
- CHANGELOG.md not found error in production builds
  - Added more fallback paths for file discovery
  - Added logging to help debug path issues

## [1.3.7] - 2026-02-16

### Fixed
- Sidebar not scrollable on small screens
  - Removed fixed max-height from quality sections
  - Made whole sidebar scrollable instead
  - Users can now scroll to access audio, subtitle, and download button

## [1.3.6] - 2026-02-16

### Fixed
- Binary download verification failing on Windows and Linux
  - Changed from 'finish' to 'close' event for proper file sync
  - Added delays before extraction/verification (1-2 seconds)
  - Better logging for download stages

## [1.3.5] - 2026-02-16

### Fixed
- Binary verification failing on Linux after download
  - Added chmod before verification to ensure execute permission
  - Increased file flush delay from 500ms to 1000ms for slower systems

## [1.3.4] - 2026-02-16

### Added
- GitHub Releases as primary binary source for yt-dlp and FFmpeg
  - Downloads from our own `vidgrab-binaries` repo first
  - Falls back to official sources if GitHub fails
  - Eliminates HTTP 303 redirect issues on Windows

### Changed
- Improved download source fallback system
  - Automatically tries next source on failure
  - Better error logging for download issues
  - More robust redirect handling

### Fixed
- HTTP 303 error when downloading FFmpeg on Windows
  - gyan.dev redirect was not being handled correctly
  - Now uses direct versioned URLs as fallback
- Binary download failures now properly retry with alternative sources

## [1.3.3] - 2026-02-14

### Fixed
- Handle all HTTP redirect types (301-308) for binary downloads
  - Previously only 301/302 were handled, causing 303 redirect failures
  - Affects yt-dlp, ffmpeg, and app update downloads

## [1.3.2] - 2026-02-14

### Removed
- ffmpeg-static dependency (was causing build failures with 502 errors)
  - Now using our own ffmpeg download system exclusively

## [1.3.1] - 2026-02-14

### Fixed
- ENAMETOOLONG error when downloading updates on Linux
  - Azure blob storage redirect URLs have long query parameters
  - Now properly extracts filename from query params instead of using full URL

## [1.3.0] - 2026-02-14

### Added
- FFmpeg auto-download system with platform-specific handling
  - Downloads from official sources (gyan.dev, evermeet.cx, johnvansickle.com)
  - Automatic extraction and installation
  - Progress tracking in UI
- FFmpeg download modal with status indicators
- GitHub API token fallback system for private/public repo switching
  - Primary token from environment variable
  - Fallback token for redundancy
  - Automatic retry on 404/401/403 errors
- Simple update notification UI with minimal design
- Queue completion success overlay
  - Shows celebration UI when all downloads finish
  - Tracks queue state transitions

### Changed
- Redesigned update notification to simple minimal style
- Improved changelog fetching with token authentication
- FFmpeg path now refreshes automatically after download

### Fixed
- FFmpeg not found after download (path not refreshing)
- Video/audio files saved separately when FFmpeg downloaded mid-session
- Changelog fetch failing for private repositories
- "Changelog not found" errors in logs (now returns graceful fallback)
- Queue completion not showing success overlay

## [1.2.0] - 2026-02-13

### Added
- Auto-update system with automatic checking on app launch
- Manual "Check for Updates" button in Settings
- UpdateModal component with download progress tracking
- ChangelogModal with brutalist cyber UI design
- Toast notifications for update status feedback
- Platform-specific update handling (Windows NSIS, macOS ZIP, Linux AppImage/DEB)
- GitHub API integration for release checking
- Update status indicators in status bar
- IPC handlers for update operations (check, download, install, cancel)
- fetchChangelogFromMain IPC to bypass CORS restrictions
- PO Token support for YouTube authentication
- Dynamic rate limiting system
- PO Token server on port 4416
- Batch download with pause/resume functionality

### Changed
- Improved update check timing to wait for page load (did-finish-load event)
- Enhanced status bar to show update checking/downloading progress
- Updated Settings with new UPDATES section
- PO Token status indicator in status bar

### Fixed
- Fixed CORS issues by fetching changelog from main process instead of renderer
- Fixed update check not showing on launch due to timing issues
- Fixed "Check for Updates" button not providing feedback
- Fixed changelog modal not fetching data properly
- Increased GitHub API timeout from 15s to 30s for slower connections

## [1.1.1] - 2026-02-10

### Added
- Comprehensive TEST_CASES.md with 14 test categories
- TEST_REPORT.md with automated test results
- Subtitle display names shown in download items
- Rounded app icons (PNG and ICO)
- Clear dropdown with multiple options (Completed, Failed, Everything)

### Changed
- Removed ffprobe-static dependency (~336MB size reduction)
- Redesigned AnalyzeTab with cyber brutalism aesthetic
- Redesigned DownloadsTab clear button with dropdown menu
- Default quality changed to "Best Quality" instead of 1080p
- Maximum compression enabled in electron-builder

### Performance
- Fixed rate limit map memory leak with periodic cleanup
- Limited history array to 100 items in memory
- Debounced queue saves (1 second) to reduce disk I/O
- Added virtual scrolling for large queue lists
- Vite production build optimizations with esbuild minification

### Fixed
- Fixed 429 rate limiting errors with --sleep-requests and --sleep-interval
- Subtitle state now persists across tab switches
- Added language name mapping for 100+ subtitle languages

### UI
- Cyber brutalism design with terminal-style input
- Loading grid animation with staggered delays
- Improved empty state designs
