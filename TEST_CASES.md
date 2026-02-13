# VidGrab Test Cases

Complete testing guide for the VidGrab YouTube Downloader application.

---

## Table of Contents

1. [URL Detection & Analysis](#1-url-detection--analysis)
2. [Single Video Download](#2-single-video-download)
3. [Playlist Download](#3-playlist-download)
4. [Channel Download](#4-channel-download)
5. [Quality & Format Selection](#5-quality--format-selection)
6. [Subtitle Downloads](#6-subtitle-downloads)
7. [Audio-Only Downloads](#7-audio-only-downloads)
8. [Queue Management](#8-queue-management)
9. [Settings & Configuration](#9-settings--configuration)
10. [History & Logging](#10-history--logging)
11. [Browser Extension Integration](#11-browser-extension-integration)
12. [Error Handling](#12-error-handling)
13. [Performance & Rate Limiting](#13-performance--rate-limiting)
14. [UI/UX Testing](#14-uiux-testing)

---

## Test URLs Reference

| Type | URL | Notes |
|------|-----|-------|
| Short Video | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | ~3 min, good for quick tests |
| Long Video | `https://www.youtube.com/watch?v=jNQXAC9IVRw` | First YouTube video |
| 4K Video | Search "4K nature video" | Test high quality |
| 8K Video | Search "8K video" | Test highest quality |
| Private Video | Any private link | Should show error |
| Age-restricted | Any age-restricted video | Test handling |
| Live Stream | Any live stream | Test handling |
| Short Video (<60s) | YouTube Shorts | Test shorts handling |
| Small Playlist | 5-10 videos | Quick playlist test |
| Large Playlist | 50+ videos | Test performance |
| Channel URL | `https://www.youtube.com/@MrBeast` | Test channel detection |

---

## 1. URL Detection & Analysis

### TC-1.1: Basic URL Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch app | Empty state shown with "Awaiting Input" |
| 2 | Paste valid YouTube URL | URL appears in input field |
| 3 | Click ANALYZE | Loading animation shows |
| 4 | Wait for completion | Video info displayed with thumbnail, title, duration |

**Test URLs:**
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://youtu.be/dQw4w9WgXcQ`
- `https://www.youtube.com/shorts/VIDEO_ID`

### TC-1.2: Playlist URL Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Paste playlist URL | URL appears in input |
| 2 | Click ANALYZE | Loading shows |
| 3 | Wait for completion | Playlist title, video count, and video list shown |
| 4 | Verify video list | All videos listed with thumbnails |

**Test URLs:**
- `https://www.youtube.com/playlist?list=PLAYLIST_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID`

### TC-1.3: Channel URL Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Paste channel URL | URL appears in input |
| 2 | Click ANALYZE | Loading shows |
| 3 | Wait for completion | Channel name and videos shown |

**Test URLs:**
- `https://www.youtube.com/@ChannelName`
- `https://www.youtube.com/c/ChannelName`
- `https://www.youtube.com/channel/CHANNEL_ID`

### TC-1.4: Invalid URL Handling
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter invalid URL | - |
| 2 | Click ANALYZE | Error message displayed |
| 3 | Verify error clarity | Error explains what went wrong |

**Test URLs:**
- `https://notyoutube.com/watch?v=123`
- `https://youtube.com/watch?v=` (empty ID)
- `random text`
- Empty input

### TC-1.5: Cancel Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Paste URL and click ANALYZE | Loading starts |
| 2 | Click ABORT button | Detection cancelled |
| 3 | Verify state | Returns to empty/input state |

### TC-1.6: Private/Deleted Video
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter private video URL | - |
| 2 | Click ANALYZE | Appropriate error shown |
| 3 | Verify message | Explains video is unavailable |

---

## 2. Single Video Download

### TC-2.1: Basic Video Download
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze single video | Video info displayed |
| 2 | Select quality (e.g., 1080p) | Quality option highlighted |
| 3 | Click ADD TO QUEUE | Item added to Downloads tab |
| 4 | Switch to Downloads tab | Item shows in queue with pending status |
| 5 | Wait for completion | Status changes to completed |
| 6 | Verify file | File exists in download folder, plays correctly |

### TC-2.2: Best Quality Download
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze 4K video | 4K badge shown |
| 2 | Select "Best Quality (4K)" | Option selected |
| 3 | Download and verify | File is 4K resolution |

### TC-2.3: Lower Quality Download
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze 4K video | Multiple quality options shown |
| 2 | Select 720p | Option selected |
| 3 | Download and verify | File is 720p, smaller size |

### TC-2.4: Video with Special Characters in Title
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video with special chars | Title displayed correctly |
| 2 | Download | File saved with sanitized filename |
| 3 | Verify filename | No invalid characters |

**Test:** Videos with emoji, quotes, slashes in title

### TC-2.5: Very Long Video (1hr+)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze long video | Duration shown correctly |
| 2 | Download | Progress updates regularly |
| 3 | Wait for completion | File downloads completely |
| 4 | Verify file | Full video, no corruption |

---

## 3. Playlist Download

### TC-3.1: Download All Playlist Videos
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze small playlist (5-10 videos) | All videos listed |
| 2 | Keep "all" selection | All videos selected by default |
| 3 | Click ADD ALL | All items added to queue |
| 4 | Verify queue | Correct number of items |
| 5 | Wait for downloads | All complete successfully |

### TC-3.2: Select Specific Videos
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze playlist | Video list shown |
| 2 | Click individual videos | Only clicked videos selected |
| 3 | Verify count | Shows "X/Y selected" |
| 4 | Click ADD | Only selected videos added |

### TC-3.3: Select All / Deselect All
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze playlist | Videos listed |
| 2 | Click SELECT ALL | All videos selected |
| 3 | Click DESELECT | All videos deselected |
| 4 | Verify button states | Buttons enable/disable appropriately |

### TC-3.4: Mixed Quality Playlist
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find playlist with varied quality videos | - |
| 2 | Select "Best Quality" | Each video gets its best quality |
| 3 | Download all | Verify each video has correct max quality |

### TC-3.5: Large Playlist (50+ videos)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze large playlist | All videos load |
| 2 | Scroll through list | Smooth scrolling, no lag |
| 3 | Download all | Queue handles all items |
| 4 | Verify performance | UI remains responsive |

### TC-3.6: Playlist with Unavailable Videos
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze playlist with some private/deleted | Available videos shown |
| 2 | Download | Skips unavailable videos gracefully |

---

## 4. Channel Download

### TC-4.1: Download from Channel
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Paste channel URL | Channel detected |
| 2 | Analyze | Channel videos listed |
| 3 | Select and download | Works same as playlist |

### TC-4.2: Channel vs Playlist
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze channel | Type badge shows "CHANNEL" |
| 2 | Analyze playlist | Type badge shows "PLAYLIST" |
| 3 | Compare behavior | Both work similarly |

---

## 5. Quality & Format Selection

### TC-5.1: Quality Options Display
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video | Quality section shows |
| 2 | Verify options | Shows: Best Quality, 8K, 4K, 1440p, 1080p, 720p, etc. |
| 3 | Check file sizes | Size estimates displayed |

### TC-5.2: Quality Limited to Available
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze 720p video | Only qualities up to 720p shown |
| 2 | Analyze 4K video | Shows up to 4K |
| 3 | Verify | No unavailable qualities listed |

### TC-5.3: Best Quality Adapts
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze 1080p video | "Best Quality (1080p)" |
| 2 | Analyze 4K video | "Best Quality (4K)" |
| 3 | Verify label | Shows actual max quality |

### TC-5.4: Format Selection (MP4/WebM)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video | Format shown in quality badge |
| 2 | Download | Correct format downloaded |

---

## 6. Subtitle Downloads

### TC-6.1: Subtitle Language Detection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video with subtitles | Subtitle section appears |
| 2 | Toggle subtitles ON | Languages load and display |
| 3 | Verify languages | English first, then alphabetically |

### TC-6.2: Select Single Subtitle Language
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable subtitles | Languages shown |
| 2 | Click "English" | Selected (highlighted) |
| 3 | Verify selection summary | Shows "Selected: English" |
| 4 | Download | English subtitle downloaded |

### TC-6.3: Select Multiple Subtitle Languages
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable subtitles | Languages shown |
| 2 | Click multiple languages | All selected |
| 3 | Verify summary | Shows "Selected: English + Spanish + ..." |
| 4 | Download | All selected subtitles downloaded |

### TC-6.4: Auto-Generated Subtitles
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable subtitles | Languages shown |
| 2 | Check "Include auto-generated" | Auto subs appear with "A" badge |
| 3 | Select auto-generated language | Works like manual subs |

### TC-6.5: Subtitle Format Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable subtitles | Format dropdown shown |
| 2 | Select SRT | Format set to SRT |
| 3 | Select VTT | Format set to VTT |
| 4 | Select ASS | Format set to ASS |
| 5 | Download | Correct format downloaded |

### TC-6.6: Embed Subtitles in Video
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable subtitles | Options shown |
| 2 | Check "Embed in video" | Option enabled |
| 3 | Download | Subtitles embedded in video file |
| 4 | Verify | Can toggle subtitles in video player |

### TC-6.7: Download Subtitles Only
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable subtitles | Languages load |
| 2 | Select languages | Languages selected |
| 3 | Click "DOWNLOAD SUBTITLES ONLY" | Only subtitles queued |
| 4 | Verify | No video downloaded, only subtitle files |

### TC-6.8: No Subtitles Available
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video without subtitles | - |
| 2 | Enable subtitles | Shows "No subtitles available" |

### TC-6.9: Subtitles for Playlists
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze playlist | Playlist shown |
| 2 | Enable subtitles | Shows playlist subtitle note |
| 3 | Download | Subtitles downloaded for all videos |

---

## 7. Audio-Only Downloads

### TC-7.1: MP3 Download
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video | Quality options shown |
| 2 | Scroll to "AUDIO ONLY" section | MP3, M4A options shown |
| 3 | Select "MP3 (Best)" | Option selected |
| 4 | Download | MP3 file created |
| 5 | Verify | Audio plays correctly, no video |

### TC-7.2: M4A Download
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "M4A (Best)" | Option selected |
| 2 | Download | M4A file created |
| 3 | Verify | Audio plays correctly |

### TC-7.3: Audio Quality
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Download audio | - |
| 2 | Check file size | Reasonable size for audio |
| 3 | Check bitrate | Best quality selected |

---

## 8. Queue Management

### TC-8.1: Add to Queue
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze video | Video info shown |
| 2 | Click ADD TO QUEUE | Item added |
| 3 | Switch to Downloads tab | Item visible in queue |
| 4 | Verify status | Shows "pending" |

### TC-8.2: Queue Auto-Start
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to queue | Item added |
| 2 | Observe | Download starts automatically |
| 3 | Verify progress | Progress bar updates |

### TC-8.3: Multiple Items in Queue
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add multiple items | All items visible |
| 2 | Observe processing | Items processed one by one |
| 3 | Verify completion | All items complete |

### TC-8.4: Pause/Resume Queue
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start downloads | Downloads in progress |
| 2 | Click PAUSE | Queue paused, current item finishes |
| 3 | Add more items | Items added but not started |
| 4 | Click RESUME | Downloads continue |

### TC-8.5: Cancel Single Item
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start download | Download in progress |
| 2 | Click cancel (X) on item | Item cancelled |
| 3 | Verify | Item shows cancelled status |
| 4 | Next item starts | Queue continues |

### TC-8.6: Remove from Queue
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item to queue | Item in queue |
| 2 | Click remove | Item removed from queue |
| 3 | Verify | Item no longer visible |

### TC-8.7: Retry Failed Item
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have a failed item | Item shows failed status |
| 2 | Click retry button | Item retries |
| 3 | Verify | Download attempts again |

### TC-8.8: Retry All Failed
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have multiple failed items | RETRY FAILED button visible |
| 2 | Click RETRY FAILED | All failed items retry |

### TC-8.9: Clear Completed
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have completed items | Items show completed |
| 2 | Click CLEAR dropdown | Menu shows |
| 3 | Click "COMPLETED" | Completed items removed |
| 4 | Active items remain | Pending/downloading items still there |

### TC-8.10: Clear All
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have items in queue | Various statuses |
| 2 | Click CLEAR → EVERYTHING | All items removed |
| 3 | Verify | Queue is empty |

### TC-8.11: Filter Queue
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have items with various statuses | - |
| 2 | Click "ACTIVE" tab | Only downloading items shown |
| 3 | Click "PENDING" tab | Only pending items shown |
| 4 | Click "COMPLETED" tab | Completed + failed items shown |
| 5 | Click "ALL" tab | All items shown |

---

## 9. Settings & Configuration

### TC-9.1: Change Download Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to Settings tab | Settings displayed |
| 2 | Click folder icon | Folder picker opens |
| 3 | Select new folder | Path updated |
| 4 | Download something | File saves to new location |

### TC-9.2: Organize by Type
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable "Organize by type" | Toggle on |
| 2 | Download video | Saved in /Videos/ subfolder |
| 3 | Download audio | Saved in /Audio/ subfolder |
| 4 | Download subtitles | Saved in /Subtitles/ subfolder |

### TC-9.3: Default Quality Setting
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set default quality to "Best Quality" | Setting saved |
| 2 | Analyze new video | Best Quality pre-selected |

### TC-9.4: Delay Between Downloads
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set delay to 5 seconds | Setting saved |
| 2 | Download playlist | ~5 second delay between items |

### TC-9.5: Theme Switching
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set theme to "Light" | UI switches to light mode |
| 2 | Set theme to "Dark" | UI switches to dark mode |
| 3 | Set theme to "System" | Follows system preference |

### TC-9.6: Font Size
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set font size to "Small" | UI text smaller |
| 2 | Set font size to "Large" | UI text larger |
| 3 | Set font size to "X-Large" | UI text largest |

### TC-9.7: Settings Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change settings | Settings updated |
| 2 | Restart app | Settings retained |

---

## 10. History & Logging

### TC-10.1: View History
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to History tab | History displayed |
| 2 | Verify entries | Previous downloads shown |
| 3 | Check details | Title, date, file path shown |

### TC-10.2: Open File from History
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have completed downloads | History has entries |
| 2 | Click on entry | File opens in default player |

### TC-10.3: Open Folder from History
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click folder icon on entry | Folder opens in file manager |
| 2 | Verify location | Correct folder shown |

### TC-10.4: Clear History
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click CLEAR ALL | History cleared |
| 2 | Verify | No entries shown |

### TC-10.5: History Limit
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Download 100+ items | History grows |
| 2 | Check history | Limited to 100 entries |

---

## 11. Browser Extension Integration

### TC-11.1: Extension Sends URL
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send URL from extension | URL received by app |
| 2 | Verify auto-analysis | Video auto-analyzed |
| 3 | Verify queue | Item in queue with "extension" source |

### TC-11.2: Extension with Quality
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Extension sends URL + quality | Specified quality used |
| 2 | Download | Correct quality downloaded |

### TC-11.3: Multiple Extension Requests
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send multiple URLs quickly | All received and queued |
| 2 | Verify rate limiting | No 429 errors |

---

## 12. Error Handling

### TC-12.1: Network Error
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disconnect internet | - |
| 2 | Try to analyze | Error shown |
| 3 | Reconnect | Works again |

### TC-12.2: Invalid YouTube URL
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter non-YouTube URL | Error shown |
| 2 | Verify message | Clear error explanation |

### TC-12.3: Video Not Available
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze deleted video | Error shown |
| 2 | Verify message | Explains unavailability |

### TC-12.4: Download Failure Recovery
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have download fail | Shows failed status |
| 2 | Queue continues | Next item starts |
| 3 | Can retry | Retry button works |

### TC-12.5: Disk Full
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill disk (test scenario) | - |
| 2 | Try to download | Error shown |
| 3 | Verify message | Explains disk issue |

### TC-12.6: ffmpeg Not Found
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Remove ffmpeg | - |
| 2 | Try to download | Warning or error |
| 3 | Verify behavior | Graceful handling |

---

## 13. Performance & Rate Limiting

### TC-13.1: Rate Limit Handling (429)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Download many videos quickly | Some may hit 429 |
| 2 | Verify handling | Retries with backoff |
| 3 | Verify no crashes | App continues working |

### TC-13.2: Memory Usage
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Monitor memory before | Note baseline |
| 2 | Download 50 videos | Memory usage |
| 3 | Complete downloads | Memory released |
| 4 | Verify | No memory leak |

### TC-13.3: Large Playlist Performance
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze 200+ video playlist | Loads in reasonable time |
| 2 | Scroll through list | Smooth scrolling |
| 3 | Select all | UI responsive |

### TC-13.4: Concurrent Downloads (if supported)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set max concurrent to 2 | Setting applied |
| 2 | Add 10 items | 2 download at once |
| 3 | Verify | No more than 2 active |

---

## 14. UI/UX Testing

### TC-14.1: Window Controls
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click minimize | Window minimizes |
| 2 | Click maximize | Window maximizes |
| 3 | Click maximize again | Window restores |
| 4 | Click close | App closes |

### TC-14.2: Tab Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click ANALYZE tab | Tab shows |
| 2 | Click DOWNLOADS tab | Tab shows |
| 3 | Click SETTINGS tab | Tab shows |
| 4 | Click HISTORY tab | Tab shows |

### TC-14.3: Keyboard Shortcuts
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter URL, press Enter | Analysis starts |
| 2 | Tab through elements | Focus moves correctly |

### TC-14.4: Responsive UI
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize window smaller | UI adapts |
| 2 | Resize window larger | UI adapts |
| 3 | Very small window | No breakage |

### TC-14.5: Progress Indicators
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start download | Progress bar shows |
| 2 | Observe updates | Percentage updates |
| 3 | Speed/ETA shown | Information displayed |

### TC-14.6: Animations
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Analyze URL | Loading animation plays |
| 2 | Add to queue | Slide animation |
| 3 | Complete download | Success animation |

### TC-14.7: Dark/Light Theme Visual
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Dark theme | All elements visible |
| 2 | Light theme | All elements visible |
| 3 | Verify contrast | Text readable in both |

---

## Test Execution Checklist

### Before Testing
- [ ] App built with latest code
- [ ] yt-dlp binary available
- [ ] ffmpeg available
- [ ] Internet connection stable
- [ ] Test URLs prepared

### Test Categories Priority

| Priority | Category | Reason |
|----------|----------|--------|
| P0 | Single Video Download | Core functionality |
| P0 | Queue Management | Core functionality |
| P1 | Quality Selection | Important feature |
| P1 | Playlist Download | Important feature |
| P1 | Subtitle Download | Important feature |
| P2 | Channel Download | Less common |
| P2 | Settings | Configuration |
| P2 | History | Nice to have |
| P3 | Extension Integration | Requires setup |
| P3 | Error Handling | Edge cases |
| P3 | Performance | Stress testing |

### Bug Reporting Template

```
**Title:** [Short description]

**Category:** [Analysis/Download/Queue/UI/etc]

**Severity:** [Critical/High/Medium/Low]

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**


**Actual Result:**


**Environment:**
- OS:
- App Version:
- yt-dlp Version:

**Screenshots/Logs:**

```

---

## Automated Test Script

Run basic automated tests:

```bash
# Check if yt-dlp is working
yt-dlp --version

# Check if ffmpeg is available
ffmpeg -version

# Test URL analysis
yt-dlp --simulate "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Test format listing
yt-dlp -F "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Test subtitle listing
yt-dlp --list-subs "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## Regression Test Suite

Run these after any code changes:

1. [ ] Launch app successfully
2. [ ] Analyze single video
3. [ ] Download single video (1080p)
4. [ ] Download single video (audio only)
5. [ ] Analyze playlist
6. [ ] Download from playlist
7. [ ] Enable and download subtitles
8. [ ] Add multiple items to queue
9. [ ] Pause and resume queue
10. [ ] Clear completed items
11. [ ] Change settings
12. [ ] View history
13. [ ] Switch themes
14. [ ] Close and reopen app (settings persist)
