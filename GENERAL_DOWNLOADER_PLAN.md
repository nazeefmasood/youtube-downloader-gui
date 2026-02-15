# Grab - Cloud-Enhanced Downloader Architecture Plan

> This document tracks the discussion and planning for Grab, a general-purpose cloud-connected downloader.

---

## User's Original Vision

### The Problem
- Wanted iOS/Android app but abandoned due to Apple Developer Program ($99/year)
- Often finds things to download while on phone but forgets links
- Wants to save links on mobile and have files ready when back at desktop

### The Core Idea
- Build a web app (Next.js) accessible on iPhone
- User logs in, adds links → saved to cloud database
- When desktop app (VidGrab) launches, it detects pending links and downloads them
- User gets notified of completed downloads
- **Share Sheet Integration** - Directly share links from other apps without opening/pasting

### Requirements
- Proper session management and validation
- Real-time notifications (what was downloaded)
- iOS Share Sheet integration to quickly add links

---

## Confirmed Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Neon DB                            │
│           (Users, Queue Items, History)                 │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────┴─────────────────────────────┐
│              Next.js App (Deploy on Vercel)            │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │  NextAuth   │  │   Prisma    │  │  API Routes   │  │
│  │  (Auth)     │  │   (ORM)     │  │  (CRUD)       │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │  PWA UI     │  │  WebSocket  │  │  Share Target │  │
│  │  (Mobile)   │  │  (Realtime) │  │  (iOS Share)  │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ HTTP / WebSocket
          ┌───────────────┴───────────────┐
          │                               │
   ┌──────┴──────┐                 ┌──────┴──────┐
   │   Phone     │                 │   VidGrab   │
   │   (PWA)     │                 │  (Desktop)  │
   │             │                 │             │
   │ - Add links │                 │ - Polls API │
   │ - View queue│                 │ - Downloads │
   │ - Get notify│                 │ - Updates DB│
   └─────────────┘                 └─────────────┘
```

### Confirmed Stack
| Component | Technology |
|-----------|------------|
| Frontend | Next.js + PWA |
| Auth | NextAuth.js + Google OAuth |
| Database | Neon (PostgreSQL) |
| ORM | Prisma |
| Real-time | WebSocket (or Pusher) |
| Notifications | WebSocket + Telegram (backup) |
| File Storage (Permanent) | Google Drive (user's account) |
| File Storage (Temporary) | Cloudflare R2 (10GB free) |
| Error Tracking | Sentry (free tier) |
| Email Service | Resend (3,000 emails/mo free) |
| Deploy | Vercel (free tier) |

### Free Tier Limits (Personal Use)
| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth, unlimited deploys |
| Neon | 0.5GB storage, 100 hours compute/month |
| Cloudflare R2 | 10GB storage, 10GB egress/month |
| Sentry | 5,000 errors/month, 10,000 transactions |
| Resend | 3,000 emails/month |
| Pusher (if used) | 200k messages/day |
| Telegram Bot | Free, unlimited |

---

## Areas Identified for Improvement

### 1. How Do You Get the Files? ✅ CONFIRMED

**Confirmed Solution: Multiple Options**

| Method | When to Use | Status |
|--------|-------------|--------|
| **HTTP Server (Same WiFi)** | Phone on same network as PC | ✅ Confirmed |
| **Google Drive Upload** | Want to access from anywhere | ✅ Confirmed |

#### File Access Flow

**Method 1: Quick Share (via Share Sheet)**
```
[Phone] Share link → [PWA] → Save to queue → Download to computer
```
- No questions asked
- Just adds to queue
- File stays on computer

**Method 2: Manual Add (Copy & Paste)**
```
[Phone] Open PWA → Paste link → Show options
```

| Option | What Happens |
|--------|--------------|
| Just Download | File saved to computer only |
| Transfer to Phone | Download → Transfer via HTTP when on same WiFi |
| Upload to Google Drive | Download → Upload to user's Google Drive |

#### HTTP Transfer (Same WiFi) - ✅ Confirmed
- VidGrab serves files via existing HTTP server (port 3847)
- Phone detects same network (check if PC IP reachable)
- Notify: "File ready - Download to phone?"
- Phone opens `http://[PC-IP]:3847/download/[file-id]`
- Browser download - fast, reliable, no extra setup

#### Google Drive Integration - ✅ Confirmed
- User connects their own Google Drive account (OAuth)
- **Subfolder organization:**
```
Google Drive/
└── VidGrab/
    ├── YouTube/
    ├── Music/
    ├── Twitch/
    ├── TikTok/
    └── [Other platforms]/
```
- User can access files from Google Drive app on phone

### 2. Multiple Desktop Devices
What if you have desktop at home + laptop for travel?

**Solution:** Device registration concept
- Each VidGrab instance registers as a device
- Queue items can be assigned to specific devices
- Or any available device can pick up pending items

### 3. Extension → Cloud Integration
Browser extension currently talks to localhost. Could also talk to cloud API:
```
Current:  Extension → localhost:3847 → VidGrab
New:      Extension → Vercel API → Neon DB
```
This means:
- Add links from any browser (work, friend's computer)
- Even if home PC is off, links are saved
- Download when you get home

### 4. Offline PWA Support ✅ CONFIRMED
Phone has no internet? No problem.
- Add links while offline
- Stored in IndexedDB
- Auto-syncs when back online

### 5. Duplicate Detection ✅ CONFIRMED
Check if URL already exists in queue/history before saving.

### How It Works

```
User adds URL
    ↓
Check Neon DB for existing URL
    ↓
If found → Show warning:
    "Already downloaded on 2024-01-15"
    [Download Anyway] [Cancel]
    ↓
If not found → Add to queue
```

### Implementation

```javascript
async function checkDuplicate(url, userId) {
  const existing = await prisma.queueItem.findFirst({
    where: {
      userId,
      url: normalizeUrl(url), // Normalize for comparison
      status: { in: ['COMPLETED', 'DOWNLOADING', 'PENDING'] }
    }
  });

  if (existing) {
    return {
      isDuplicate: true,
      downloadedAt: existing.completedAt,
      title: existing.title
    };
  }

  return { isDuplicate: false };
}
```

### URL Normalization

```javascript
function normalizeUrl(url) {
  // Remove tracking params, normalize YouTube URLs, etc.
  const parsed = new URL(url);

  // YouTube: extract just the video ID
  if (parsed.hostname.includes('youtube.com')) {
    const videoId = parsed.searchParams.get('v');
    return `youtube.com/watch?v=${videoId}`;
  }

  // Other platforms...
  return parsed.origin + parsed.pathname;
}
```

### 6. Smart Metadata Fetch ❌ SKIPPED
Skipping this feature - web app cannot directly fetch metadata from URLs due to CORS/API restrictions.
Metadata will only appear after desktop app processes the download (acceptable behavior).

### 7. Notification Channels ✅ CONFIRMED

### Platform-Specific Strategy

| Platform | In-App | Background | Push Notifications |
|----------|--------|------------|-------------------|
| iOS | ✅ Pusher | ❌ Not possible | ❌ Limited |
| Android | ✅ Pusher | ✅ Yes | ✅ Yes |
| Desktop Web | ✅ Pusher | ✅ Yes | ✅ Yes |

### iOS Flow
```
User opens PWA → Pusher connects → Real-time progress
User closes PWA → No notifications
User reopens PWA → Reconnects → Gets updated status
```

### Android Flow
```
User opens PWA → Pusher connects → Real-time progress
User closes PWA → Background Push still works
Download complete → Android notification shows
User taps → Opens PWA with updated state
```

### Android Background Features
| Feature | Support |
|---------|---------|
| Background Sync | ✅ Yes |
| Push API | ✅ Yes |
| Periodic Background Sync | ✅ Yes |
| Notifications (app closed) | ✅ Yes |

### 8. Folder/Rules Automation ✅ CONFIRMED
Auto-organize downloads into folders based on rules.

### Default Folder Structure
```
Downloads/
└── VidGrab/
    ├── YouTube/
    │   ├── [ChannelName]/
    │   └── Other/
    ├── Twitch/
    │   └── [StreamerName]/
    ├── TikTok/
    ├── Twitter/
    ├── Music/
    └── Playlists/
        └── [PlaylistName]/
```

### Rule Types
| Rule | Condition | Action |
|------|-----------|--------|
| Platform folders | YouTube video | Save to `/VidGrab/YouTube/` |
| Channel folders | YouTube channel "XYZ" | Save to `/VidGrab/YouTube/XYZ/` |
| Content type | Audio only | Save to `/VidGrab/Music/` |
| Playlist | Playlist named "X" | Save to `/VidGrab/Playlists/X/` |

### Default Rules (Built-in)
| Platform | Default Folder |
|----------|----------------|
| YouTube | `/VidGrab/YouTube/` |
| Twitch | `/VidGrab/Twitch/` |
| TikTok | `/VidGrab/TikTok/` |
| Twitter/X | `/VidGrab/Twitter/` |
| Audio-only | `/VidGrab/Music/` |

### Custom Rules
- Users can add custom rules via PWA settings
- Rules stored in Neon DB (synced across devices)
- Desktop app reads rules and organizes files

### Settings UI
```
┌────────────────────────────────┐
│  Folder Rules                  │
│                                │
│  [+] Add Rule                  │
│                                │
│  Rule 1:                       │
│  If platform is [YouTube ▼]    │
│  And channel is [MrBeast]      │
│  Save to [/MrBeast/Videos]     │
│  [Delete]                      │
└────────────────────────────────┘
```

### 9. Rate Limiting & Security ✅ CONFIRMED

### Security Measures

| Feature | Description |
|---------|-------------|
| **Rate Limiting** | 100 requests/hour per user |
| **API Key for Desktop** | Desktop app uses API key, not just session |
| **CSRF Protection** | Built into NextAuth.js |
| **Input Validation** | Validate URLs, sanitize inputs |
| **CORS** | Configure allowed origins |
| **Helmet.js** | Security headers |
| **Environment Variables** | Secrets never in code |

### Rate Limiting Implementation

```javascript
// Using Upstash Redis (free tier) or in-memory
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  message: 'Too many requests, try again later'
});
```

### API Authentication

| Client | Auth Method |
|--------|-------------|
| PWA (Web) | NextAuth.js session |
| Desktop App | API Key (stored securely) |
| Extension | OAuth token or API key |

### Input Validation

```javascript
import { z } from 'zod';

const urlSchema = z.string().url().refine((url) => {
  // Check if URL is from supported platform
  return isValidDownloadUrl(url);
});
```

---

## Confirmed: Advanced Extension ✅

### Extension Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Extension                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │ Media       │  │ Network     │  │ Content       │   │
│  │ Sniffer     │  │ Monitor     │  │ Detection     │   │
│  └─────────────┘  └─────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │  Local Service  │     │   Cloud API     │
    │  (port 3847)    │     │  (Vercel)       │
    └─────────────────┘     └─────────────────┘
              │                       │
              ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │  VidGrab App    │     │   Neon DB       │
    │  (Desktop)      │     │   (Queue)       │
    └─────────────────┘     └─────────────────┘
```

### Extension Features

| Feature | Description | Status |
|---------|-------------|--------|
| Media Sniffer | Detect video/audio on any page | ✅ Confirmed |
| Network Monitor | Catch media requests | ✅ Confirmed |
| Local Service | Communicate with VidGrab on port 3847 | ✅ Confirmed |
| Cloud Fallback | Send to cloud queue if local unavailable | ✅ Confirmed |
| Extension Login | OAuth login for cloud access | ✅ Confirmed |

### Extension Flow

```
User visits page with video
        ↓
Extension sniffs media
        ↓
Show download button
        ↓
User clicks download
        ↓
Try local service (port 3847)
        ├── Success → Send to local VidGrab
        └── Fail → Check if logged in
                    ├── Logged in → Send to Cloud API
                    └── Not logged in → Prompt to login
```

### Background Service (Desktop App)

- Launches on app start
- Runs on port 3847
- Works even when main window is minimized/closed
- Tray icon shows it's running

---

## Confirmed: Error Tracking & Reporting System ✅

### Overview

| Feature | Tool/Approach | Cost |
|---------|---------------|------|
| Auto Error Tracking | Sentry | Free (5k errors/mo) |
| Bug Reports | In-app form → Email + Admin Panel | Free |
| Feature Requests | In-app form → Email + Admin Panel | Free |
| Email Service | Resend | Free (3,000 emails/mo) |
| Admin Panel | Custom dashboard | Free |

### Sentry Integration

| Platform | Package |
|----------|---------|
| Electron (Desktop) | `@sentry/electron` |
| Next.js (Web/PWA) | `@sentry/nextjs` |
| Browser Extension | `@sentry/browser` |

### Report Types

| Type | Description |
|------|-------------|
| 🐛 Bug | Something broken |
| ✨ Feature Request | New feature idea |
| 💬 Other | General feedback |

### Database Model

```prisma
model Report {
  id          String      @id @default(cuid())
  type        ReportType
  title       String
  description String
  userId      String?
  userEmail   String?
  status      ReportStatus @default(OPEN)
  screenshot  String?
  logs        String?
  createdAt   DateTime    @default(now())
  resolvedAt  DateTime?
}

enum ReportType {
  BUG
  FEATURE_REQUEST
  OTHER
}

enum ReportStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

### Admin Panel Features

- View all reports (bugs, feature requests, other)
- Filter by type, status, date
- View report details with screenshot
- Respond via email
- Mark as resolved/in progress
- Add internal notes

---

## Confirmed: Multi-Device (Simple) ✅

| Approach | Details |
|----------|---------|
| Any device picks up | First device to check queue downloads it |
| Files stay where downloaded | No auto-sync between devices |
| Manual management | Move files manually if needed |

**Complex multi-device features deferred for future.**

### 10. Sharing With Family/Friends ✅ CONFIRMED

**In-App Contact System (Friends & Family Only)**

| Feature | Status |
|---------|--------|
| Find users by username | ✅ Confirmed |
| Send/accept contact requests | ✅ Confirmed |
| Share link to contact's queue | ✅ Confirmed |
| Share file link to contact | ✅ Confirmed |
| Friends/family only (not public social) | ✅ Confirmed |

#### How It Works

**Adding a Contact:**
```
1. Search by username (e.g., @mom, @dad, @john)
2. Send contact request
3. They accept → Now contacts
```

**Sharing:**
```
Share modal shows your contact list:
- @mom
- @dad
- @sister

Choose how to share:
○ Add to their queue (appears in their downloads)
○ Send file link (after download completes)
```

#### Database Model

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique
  displayName  String?
  contacts     Contact[]
  sharedFrom   SharedItem[] @relation("From")
  sharedTo     SharedItem[] @relation("To")
}

model Contact {
  id         String   @id @default(cuid())
  userId     String
  contactId  String
  status     Status   @default(PENDING)
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId])
  contact    User     @relation(fields: [contactId])

  @@unique([userId, contactId])
}

model SharedItem {
  id          String   @id @default(cuid())
  fromUserId  String
  toUserId    String
  url         String
  title       String?
  type        ShareType
  status      ItemStatus @default(PENDING)
  createdAt   DateTime  @default(now())
  fromUser    User      @relation("From", fields: [fromUserId])
  toUser      User      @relation("To", fields: [toUserId])
}

enum Status {
  PENDING
  ACCEPTED
  DECLINED
}

enum ShareType {
  TO_QUEUE    // Add to their download queue
  FILE_LINK   // Send file URL after download
}

enum ItemStatus {
  PENDING
  DOWNLOADED
  VIEWED
}
```

#### Notification Flow

```
User A shares with User B:
    ↓
User B gets notification:
    "John shared 'Funny Cat Video' with you"
    [Add to Queue] [View Link] [Dismiss]
```

---

## Confirmed: Share Sheet Popup

When user shares via iOS Share Sheet, PWA opens with options modal:

```
┌────────────────────────────────┐
│  What do you want to do?       │
│                                │
│  ○ Just Download               │
│  ○ Transfer to Phone           │
│  ○ Upload to Google Drive      │
│  ○ Share with Someone          │
│      (show contact list)       │
│                                │
│  [Add to Queue]                │
└────────────────────────────────┘
```

---

## Confirmed: File Storage Strategy

### Two-Tier Storage System

| Scenario | Storage Used | Duration |
|----------|--------------|----------|
| Google Drive connected | Upload to user's Drive | Permanent |
| No Google Drive | Upload to Cloudflare R2 | 24h expiry |

### Cloudflare R2 (Temporary Storage)

```
Free: 10GB storage + 10GB egress/month
No egress fees!
S3-compatible API
```

**Implementation:**
```javascript
// When uploading
const file = await r2.upload(url, {
  metadata: {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  }
});

// Cron job (runs every hour)
const expiredFiles = await db.files.findMany({
  where: { expiresAt: { lt: Date.now() } }
});

for (const file of expiredFiles) {
  await r2.delete(file.key);
  await db.files.delete(file.id);
}
```

### Share Flow

```
User clicks "Share with Someone"
    ↓
Is Google Drive connected?
    ├── YES → Upload to Google Drive → Share Drive link
    └── NO  → Upload to Cloudflare R2 → Share temp link (expires 24h)
```

---

## Feature Brainstorm (To Discuss One by One)

### 🤖 Smart & AI-Powered

| Feature | Description | Status |
|---------|-------------|--------|
| Auto-Categorize | AI detects content type → Tags automatically (Music, Podcast, Tutorial, Movie, etc.) | 🔵 Pending |
| Smart Suggestions | "You downloaded X, you might also like Y" | 🔵 Pending |
| Auto-Playlist | Detect playlist URLs → Download entire playlist as collection | 🔵 Pending |
| Content Summarize | Use AI to summarize video descriptions, generate tags | 🔵 Pending |
| Duplicate Content Detection | Detect same video even if different URL (re-uploads) | 🔵 Pending |

### 👥 Collaboration & Sharing

| Feature | Description | Status |
|---------|-------------|--------|
| Shared Queues | Family/team can add to shared download queue | ✅ Confirmed |
| In-App Contacts | Add friends/family by username | ✅ Confirmed |
| Share to Queue | Send download link directly to contact's queue | ✅ Confirmed |
| Share File Link | Send downloaded file URL to contact | ✅ Confirmed |
| Public Wishlists | Share a public list people can add to | ⏸️ Deferred |
| Collaborative Collections | Multiple people contribute to a playlist/collection | ⏸️ Deferred |

### ⚡ Advanced Download Control

| Feature | Description | Status |
|---------|-------------|--------|
| Partial Download | Download only first 5 minutes (preview before committing) | 🔵 Pending |
| Time Range | Download 2:30 - 5:45 only (clip extraction) | 🔵 Pending |
| Format Presets | "Music Mode" → Audio only, 320kbps, auto-metadata | 🔵 Pending |
| Quality Auto-Select | Based on available storage, pick best quality that fits | 🔵 Pending |
| Parallel Downloads | Download multiple items simultaneously | 🔵 Pending |
| Bandwidth Scheduler | Full speed at night, throttled during work hours | 🔵 Pending |
| Resume Broken | Auto-resume interrupted downloads | 🔵 Pending |

### 📱 Mobile-Specific

| Feature | Description | Status |
|---------|-------------|--------|
| Direct to Phone | Transfer to phone via HTTP when on same WiFi | ✅ Confirmed |
| iOS Share Sheet | Web Share Target API integration | ✅ Confirmed |
| Share Popup | Modal with options after sharing to PWA | ✅ Confirmed |
| iOS Shortcuts | Siri Shortcut: "Download this video" | ❌ Skip |
| Android Intent | Share to app from any Android app | ❌ Skip |
| Widgets | Home screen widget showing queue status | ❌ Skip |
| Background Refresh | Pull latest status when app opens | ❌ Skip |

### 📁 Organization & Management

| Feature | Description | Status |
|---------|-------------|--------|
| Collections/Playlists | Group downloads into named collections | 🔵 Pending |
| Tags System | Add custom tags, filter by tags | 🔵 Pending |
| Smart Folders | Auto-folders: "Unwatched", "Large Files", "Recent" | 🔵 Pending |
| Search History | Full-text search across all downloaded content | 🔵 Pending |
| Export Metadata | Export library as CSV, JSON, Markdown | 🔵 Pending |
| Notes per Download | Add personal notes to each item | 🔵 Pending |

### 🎬 Content Features

| Feature | Description | Status |
|---------|-------------|--------|
| Thumbnail Grid | View downloads as visual grid of thumbnails | ✅ Confirmed |
| Subtitle Download | Auto-download subtitles in preferred language | ✅ Already exists |
| Stream from Desktop | Stream video from desktop to phone (same WiFi) | ✅ Confirmed |
| Download to Phone | Download file from desktop to phone storage | ✅ Already confirmed |
| Chapter Extraction | Extract video chapters as bookmarks | ❌ Skip |
| Description Archive | Save full descriptions | ❌ Skip |
| Comment Export | Export top comments | ❌ Skip |

### Stream from Desktop - Implementation

```
┌─────────────┐                    ┌─────────────┐
│   Phone     │                    │   Desktop   │
│   (PWA)     │                    │   (VidGrab) │
│             │                    │             │
│  [Play] ────┼── HTTP Stream ────►│  Video File │
│             │                    │  on disk    │
│  [Download]─┼── HTTP Download ──►│             │
└─────────────┘                    └─────────────┘
         Same WiFi Network
```

**Requirements:**
- HTTP server with range request support (for video seeking)
- Stream endpoint: `http://[PC-IP]:3847/stream/[file-id]`
- Video player UI in PWA
- Same network detection

### ⏰ Scheduling & Automation

| Feature | Description | Status |
|---------|-------------|--------|
| Scheduled Downloads | "Download every Thursday at 2am" | ❌ Skip |
| Watch Channels | Auto-download new videos from subscribed channels | ❌ Skip |
| Smart Wake | Wake PC from sleep for scheduled downloads | ❌ Skip |
| Auto-Delete Rules | Delete downloads older than X days | ✅ Confirmed |
| Storage Manager | Auto-pause when disk space low | ❌ Skip |

### 🔔 Notifications & Alerts

| Feature | Description | Status |
|---------|-------------|--------|
| Rich Notifications (Android) | Thumbnail preview in notification | ✅ Confirmed |
| Rich Notifications (iOS) | Thumbnail preview (best effort, limited) | ⚠️ Best effort |
| Download Failed Alerts | Detailed error + retry/skip options | ✅ Confirmed |
| Weekly Digest | Email summary of what you downloaded | ❌ Skip |
| Storage Warnings | "Running low on space" alert | ❌ Skip |
| Dead Video Alert | "Video you saved was deleted" | ❌ Skip |

### Download Failed Alerts - Error Types

| Scenario | Error Message | Action |
|----------|---------------|--------|
| Video removed | "Video was removed from platform" | [Remove from Queue] |
| Private video | "This video is private" | [Skip] |
| Rate limited | "Too many requests, try again later" | [Retry in 1 hour] |
| Network error | "Connection failed" | [Retry Now] |
| Format unavailable | "Requested format not available" | [Try Another Quality] |
| Unknown error | "Download failed" | [Retry] [Report Bug] |

### 🔒 Security & Privacy

| Feature | Description | Status |
|---------|-------------|--------|
| Private Mode | Don't save to history, don't sync | ❌ Skip |
| Encrypted Storage | Password-protect sensitive downloads | ❌ Skip |
| Self-Destruct | Downloads that auto-delete after viewing | ❌ Skip |
| URL Anonymization | Strip tracking params from URLs | ❌ Skip |
| VPN Detection | Warn if downloading without VPN | ❌ Skip |

### 🔗 Integrations

| Feature | Description | Status |
|---------|-------------|--------|
| Cloud Upload | Auto-upload to Google Drive (user's account) | ✅ Confirmed |
| Temporary Storage | Cloudflare R2 for temp file sharing (24h expiry) | ✅ Confirmed |
| Plex/Jellyfin | Add downloads directly to media server library | 🔵 Pending |
| Discord Bot | Control via Discord commands | 🔵 Pending |
| IFTTT/Zapier | Connect to automation services | 🔵 Pending |
| RSS Feed | Subscribe to your download queue as RSS | 🔵 Pending |
| Notion/Obsidian | Log downloads to your note-taking app | 🔵 Pending |
| Home Assistant | Integrate with smart home (pause downloads when gaming, etc.) | 🔵 Pending |

### 📊 Analytics & Insights

| Feature | Description | Status |
|---------|-------------|--------|
| Dashboard (User) | Total GB downloaded, bandwidth used, etc. | ✅ Confirmed |
| Dashboard (Admin) | System stats, user activity, reports | ✅ Confirmed |
| Charts | Download activity over time | ❌ Skip |
| Content Breakdown | Pie chart: YouTube vs Twitch vs TikTok | ❌ Skip |
| Cost Calculator | "You saved $X by not paying for premium" | ❌ Skip |
| Storage Forecast | Predict storage needs | ❌ Skip |

### 👨‍💻 Developer/API

| Feature | Description | Status |
|---------|-------------|--------|
| Public API | REST API with documentation | ❌ Skip |
| Webhooks | `download.completed` → Your server | ❌ Skip |
| API Keys | Generate keys for third-party apps | ❌ Skip |
| CLI Tool | `vidgrab add <url>` from terminal | ❌ Skip |
| SDK | JavaScript/Python SDKs | ❌ Skip |

### 💰 Monetization

| Feature | Description | Status |
|---------|-------------|--------|
| Free Tier | Personal use, limited features | ❌ Skip - already free |
| Pro Tier | Unlimited, cloud storage, priority support | ❌ Skip |
| Family Plan | Up to 5 users, shared storage | ❌ Skip |
| White Label | Let others deploy their own branded version | ❌ Skip |

---

## Discussion Progress

We will discuss each category one by one and update status:
- 🔵 Pending - Not yet discussed
- ✅ Confirmed - Will implement
- ❌ Rejected - Won't implement
- ⏸️ Deferred - Maybe later

---

## Top Picks (Recommended)

| Rank | Feature | Status |
|------|---------|--------|
| 1 | Google Drive Upload (user's account) | ✅ Confirmed |
| 2 | HTTP Transfer to Phone (same WiFi) | ✅ Confirmed |
| 3 | In-App Contact System (friends/family) | ✅ Confirmed |
| 4 | Cloudflare R2 Temp Storage (24h expiry) | ✅ Confirmed |
| 5 | Share Sheet Popup with options | ✅ Confirmed |
| 6 | Collections + Tags | 🔵 To Discuss |
| 7 | Watch Channels | 🔵 To Discuss |
| 8 | Subtitles + Audio-only mode | 🔵 To Discuss |

---

*Last updated: 2026-02-15*
*Status: Discussion in progress*

---

## Confirmed Features Summary

### Core Features
| Feature | Details |
|---------|---------|
| **HTTP Transfer** | Transfer files to phone via HTTP when on same WiFi network |
| **Google Drive** | Upload to user's Google Drive with subfolder organization by platform |
| **Cloudflare R2** | Temporary storage (10GB free, 24h expiry) for sharing without Google Drive |
| **Contact System** | Add friends/family by username, share links/files directly |
| **Share to Queue** | Send download links directly to contact's download queue |
| **Share File Link** | Send downloaded file URL to contacts |
| **Share Sheet Popup** | Modal with options when sharing via iOS Share Sheet |
| **Two-Tier Storage** | Google Drive (permanent) or Cloudflare R2 (temporary) based on user preference |
| **Advanced Extension** | Media sniffer, network monitor, local + cloud fallback, extension login |
| **Background Service** | Desktop app runs service on startup (port 3847) |
| **Multi-Device (Simple)** | Any online device picks up pending downloads |
| **Offline PWA** | Add links offline, stored in IndexedDB, synced when back online |
| **Pusher Notifications** | Real-time progress updates when PWA is open |
| **Android Background** | Background push notifications on Android (not possible on iOS) |
| **Folder Rules** | Auto-organize downloads by platform, channel, content type |
| **Rate Limiting & Security** | Rate limits, API keys, CSRF, input validation, security headers |
| **Duplicate Detection** | Warn if URL already downloaded, with "Download Anyway" option |

### Error Tracking & Reporting
| Feature | Details |
|---------|---------|
| **Sentry** | Auto error tracking for Electron, Next.js, Extension |
| **Bug Reporting** | In-app form → Email + Admin Panel |
| **Feature Requests** | In-app form → Email + Admin Panel |
| **Admin Panel** | View/manage all reports, respond via email |
| **Resend Email** | Email service for reports and notifications |

### Download Features
| Feature | Details |
|---------|---------|
| **Resume Broken** | Auto-resume interrupted downloads |
| **Parallel Downloads** | Download multiple items (careful with rate limits) |
| **Auto-Delete Rules** | Delete old downloads automatically |

### Content & UI Features
| Feature | Details |
|---------|---------|
| **Thumbnail Grid** | View downloads as visual grid of thumbnails |
| **Stream from Desktop** | Stream video from desktop to phone (same WiFi) |
| **Download to Phone** | Download file from desktop to phone storage |
| **Export Metadata** | Export library as CSV, JSON, Markdown |

### Notifications
| Feature | Details |
|---------|---------|
| **Rich Notifications (Android)** | Thumbnail preview in notification |
| **Rich Notifications (iOS)** | Best effort, limited support |
| **Download Failed Alerts** | Detailed error + retry/skip options |

### Analytics
| Feature | Details |
|---------|---------|
| **User Dashboard** | Total GB downloaded, bandwidth used, etc. |
| **Admin Dashboard** | System stats, user activity, reports |

### Queue Management
| Feature | Details |
|---------|---------|
| **Queue Priority** | Drag to reorder, mark as high priority |
| **Batch Operations** | Select multiple → retry/delete/move all |
| **History Separation** | Completed items in separate history view |

### Settings & Preferences
| Feature | Details |
|---------|---------|
| **Settings Sync** | Settings sync across all devices |
| **Default Quality** | Preferred quality per platform |
| **Default Download Folder** | User's preferred download location |

### Network & Platform
| Feature | Details |
|---------|---------|
| **WiFi vs Cellular** | Pause on cellular to save data |
| **Rate Limit Handling** | Auto-retry with exponential backoff |
| **Quality Fallback** | Auto-pick next best if unavailable |

### User Experience
| Feature | Details |
|---------|---------|
| **Onboarding** | First-time user tutorial |
| **Empty States** | Helpful UI when lists are empty |
| **Undo Actions** | Undo accidental deletions |
| **Help Section** | Full documentation of all features |

### Account
| Feature | Details |
|---------|---------|
| **Account Deletion** | Delete account + all data (GDPR) |
| **Backup/Restore** | Export/import all user data |

## Skipped/Deferred Features

| Feature | Status | Reason |
|---------|--------|--------|
| Smart Metadata Fetch | ❌ Skipped | Cannot fetch metadata directly from web app |
| Telegram Notifications | ❌ Skipped | Banned in user's region |
| Complex Multi-Device | ⏸️ Deferred | For future implementation |
| iOS Background Notifications | ❌ Not possible | iOS PWA limitations |
| Migration from VidGrab | ❌ Skipped | Small user base currently |
| Username Change | ❌ Skipped | Complex, rarely needed |
| Multiple Google Drive | ❌ Skipped | Overcomplicates storage |

---

## Additional Confirmed Features

### 📋 Queue Management

| Feature | Description | Status |
|---------|-------------|--------|
| **Queue Priority** | Drag to reorder items, mark as high priority | ✅ Confirmed |
| **Batch Operations** | Select multiple → retry all, delete all, move all | ✅ Confirmed |
| **History Separation** | Completed items moved to history, separate from active queue | ✅ Confirmed |

### ⚙️ Settings & Preferences

| Feature | Description | Status |
|---------|-------------|--------|
| **Settings Sync** | User settings sync across all devices | ✅ Confirmed |
| **Default Quality** | Set preferred quality per platform | ✅ Confirmed |
| **Default Download Folder** | User's preferred download location | ✅ Confirmed |

### 🌐 Network & Platform

| Feature | Description | Status |
|---------|-------------|--------|
| **WiFi vs Cellular** | Pause downloads when on cellular (save data) | ✅ Confirmed |
| **Rate Limit Handling** | Auto-retry with exponential backoff | ✅ Confirmed |
| **Quality Fallback** | Auto-pick next best quality if selected unavailable | ✅ Confirmed |

### 📱 User Experience

| Feature | Description | Status |
|---------|-------------|--------|
| **Onboarding** | First-time user tutorial/walkthrough | ✅ Confirmed |
| **Empty States** | Helpful UI when queue/history/contacts empty | ✅ Confirmed |
| **Undo Actions** | Undo accidental deletions (toast with undo button) | ✅ Confirmed |
| **Help Section** | In-app documentation of all features and how to use them | ✅ Confirmed |

### 🔐 Account

| Feature | Description | Status |
|---------|-------------|--------|
| **Account Deletion** | Delete account and all associated data (GDPR) | ✅ Confirmed |
| **Backup/Restore** | Export/import queue, history, contacts, settings | ✅ Confirmed |

---

## Help Section Details

### Structure

```
┌────────────────────────────────────────────────────────┐
│  Help & FAQ                                            │
│                                                        │
│  📖 Getting Started                                    │
│     ├── What is Grab?                                  │
│     ├── How to add your first download                 │
│     └── Setting up your account                        │
│                                                        │
│  📱 Mobile App (PWA)                                   │
│     ├── Installing on iPhone                           │
│     ├── Installing on Android                          │
│     ├── Using Share Sheet                              │
│     └── Offline mode                                   │
│                                                        │
│  💻 Desktop App                                        │
│     ├── Installation                                   │
│     ├── How downloads work                             │
│     └── Background service                             │
│                                                        │
│  📂 File Management                                    │
│     ├── Transfer to phone (same WiFi)                  │
│     ├── Stream from desktop                            │
│     ├── Google Drive integration                       │
│     └── Folder organization rules                      │
│                                                        │
│  👥 Contacts & Sharing                                 │
│     ├── Adding contacts                                │
│     ├── Sharing to friend's queue                      │
│     └── Sharing file links                             │
│                                                        │
│  🔌 Browser Extension                                  │
│     ├── Installation                                   │
│     ├── How media detection works                      │
│     └── Local vs Cloud mode                            │
│                                                        │
│  ⚙️ Settings                                           │
│     ├── Quality preferences                            │
│     ├── Notification settings                          │
│     └── Storage options                                │
│                                                        │
│  ❓ FAQ                                                │
│     ├── Why is my download slow?                       │
│     ├── Why did my download fail?                      │
│     ├── How do I resume a broken download?             │
│     └── Can I download from [platform]?                │
│                                                        │
│  🐛 Troubleshooting                                    │
│     ├── Common errors and fixes                        │
│     ├── How to report a bug                            │
│     └── Contact support                                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Help Features

| Feature | Description |
|---------|-------------|
| **Search** | Search help articles by keyword |
| **Screenshots** | Visual guides with screenshots |
| **Video tutorials** | Short GIF/video demos for complex features |
| **Platform-specific** | Show relevant help based on user's platform |
| **Contextual help** | "?" buttons next to features link to relevant help |
| **Changelog** | What's new in each version |
