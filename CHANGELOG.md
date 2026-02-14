# Changelog

All notable changes to VidGrab will be documented in this file.

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
