# Grab - Implementation Roadmap

> Organized list of confirmed features for implementation.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 + PWA + Tailwind CSS |
| **Auth** | NextAuth.js + Google OAuth |
| **Database** | Neon (PostgreSQL) |
| **ORM** | Prisma |
| **Real-time** | Pusher |
| **Storage (Permanent)** | Google Drive API |
| **Storage (Temporary)** | Cloudflare R2 |
| **Error Tracking** | Sentry |
| **Email** | Resend |
| **Desktop App** | Grab Desktop (Electron + yt-dlp) |
| **Extension** | Chrome/Firefox Extension |
| **Deploy** | Vercel |

---

## Phase 1: Foundation

### 1.1 Project Setup
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up PWA manifest and service worker
- [ ] Configure ESLint, Prettier

### 1.2 Database Setup
- [ ] Create Neon database
- [ ] Set up Prisma ORM
- [ ] Create database schema

```prisma
// Core Models
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique
  displayName  String?
  createdAt    DateTime @default(now())
  queue        QueueItem[]
  contacts     Contact[]
  sharedFrom   SharedItem[] @relation("From")
  sharedTo     SharedItem[] @relation("To")
  reports      Report[]
}

model QueueItem {
  id          String   @id @default(cuid())
  url         String
  title       String?
  status      Status   @default(PENDING)
  platform    String?
  folder      String?
  transferToPhone Boolean @default(false)
  uploadToDrive   Boolean @default(false)
  shareWithContact String?
  createdAt   DateTime @default(now())
  completedAt DateTime?
  userId      String
  user        User     @relation(fields: [userId])
}

model Contact {
  id         String   @id @default(cuid())
  userId     String
  contactId  String
  status     ContactStatus @default(PENDING)
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

model Report {
  id          String   @id @default(cuid())
  type        ReportType
  title       String
  description String
  userId      String?
  userEmail   String?
  status      ReportStatus @default(OPEN)
  screenshot  String?
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
  user        User?    @relation(fields: [userId])
}

model FolderRule {
  id          String   @id @default(cuid())
  userId      String
  platform    String?
  channel     String?
  contentType String?  // video, audio
  targetFolder String
  priority    Int      @default(0)
}

model DownloadHistory {
  id          String   @id @default(cuid())
  userId      String
  totalBytes  BigInt   @default(0)
  totalFiles  Int      @default(0)
  lastUpdated DateTime @default(now())
}

enum Status {
  PENDING
  DOWNLOADING
  COMPLETED
  FAILED
}

enum ContactStatus {
  PENDING
  ACCEPTED
  BLOCKED
}

enum ShareType {
  TO_QUEUE
  FILE_LINK
}

enum ItemStatus {
  PENDING
  DOWNLOADED
  VIEWED
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

### 1.3 Authentication
- [ ] Set up NextAuth.js
- [ ] Configure Google OAuth provider
- [ ] Implement session management
- [ ] Create protected routes
- [ ] Add rate limiting (100 req/hour per user)

---

## Phase 2: Core PWA

### 2.1 Basic UI Layout
- [ ] Create responsive layout (mobile-first)
- [ ] Bottom navigation (Queue, History, Contacts, Settings)
- [ ] Header with user info

### 2.2 Queue Management
- [ ] Queue list view
- [ ] Add URL form with validation
- [ ] Duplicate detection (warn if already downloaded)
- [ ] Queue item actions (cancel, retry, remove)
- [ ] Status indicators (pending, downloading, completed, failed)

### 2.3 Share Sheet Integration
- [ ] Configure Web Share Target API in manifest
- [ ] Handle incoming shared URLs
- [ ] Show options modal after share:

```
┌────────────────────────────────┐
│  What do you want to do?       │
│                                │
│  ○ Just Download               │
│  ○ Transfer to Phone           │
│  ○ Upload to Google Drive      │
│  ○ Share with Someone          │
│                                │
│  [Add to Queue]                │
└────────────────────────────────┘
```

### 2.4 Offline Support
- [ ] Service worker for caching
- [ ] IndexedDB for offline queue
- [ ] Background sync when online

---

## Phase 3: Desktop Integration

### 3.1 Desktop App Updates
- [ ] API authentication (API key)
- [ ] Poll cloud API for pending queue items
- [ ] Download items from cloud queue
- [ ] Update status in cloud DB
- [ ] Report download progress

### 3.2 Download Features
- [ ] Resume broken downloads
- [ ] Parallel downloads (with rate limit awareness)
- [ ] Auto-delete old files (configurable)
- [ ] Platform detection (YouTube, Twitch, TikTok, etc.)

### 3.3 Background Service
- [ ] Run HTTP server on startup (port 3847)
- [ ] Accept requests from extension
- [ ] Serve files for streaming/download
- [ ] System tray integration

---

## Phase 4: File Management

### 4.1 HTTP Transfer (Same WiFi)
- [ ] Detect if phone on same network
- [ ] Stream endpoint with range support
- [ ] Download endpoint
- [ ] File browser in PWA

```javascript
// Desktop endpoints
GET /stream/:fileId  // Stream with range support
GET /download/:fileId // Full download
GET /files           // List available files
```

### 4.2 Google Drive Integration
- [ ] Google Drive OAuth
- [ ] Create VidGrab folder structure
- [ ] Upload completed downloads
- [ ] Subfolder organization:

```
Google Drive/
└── VidGrab/
    ├── YouTube/
    ├── Twitch/
    ├── TikTok/
    ├── Twitter/
    └── Music/
```

### 4.3 Cloudflare R2 (Temporary Storage)
- [ ] Set up R2 bucket
- [ ] Upload files for sharing
- [ ] Generate shareable links
- [ ] Auto-expiry (24 hours)
- [ ] Cron job to delete expired files

### 4.4 Folder Rules
- [ ] Default rules (by platform)
- [ ] Custom rules UI
- [ ] Rules stored in DB
- [ ] Desktop app applies rules

---

## Phase 5: Notifications

### 5.1 Pusher Integration
- [ ] Set up Pusher account
- [ ] Server-side event triggers
- [ ] Client-side subscription
- [ ] Real-time progress updates

### 5.2 Android Background Push
- [ ] Service worker push handling
- [ ] Rich notifications with thumbnails
- [ ] Notification actions (play, share)
- [ ] Background sync

### 5.3 iOS (Best Effort)
- [ ] Web Push API (iOS 16.4+)
- [ ] Basic notifications
- [ ] Handle limited support

### 5.4 Download Failed Alerts
- [ ] Error categorization
- [ ] User-friendly messages
- [ ] Retry/skip options

| Error | Message | Action |
|-------|---------|--------|
| Video removed | "Video was removed" | [Remove] |
| Private video | "Video is private" | [Skip] |
| Rate limited | "Try again later" | [Retry in 1h] |
| Network error | "Connection failed" | [Retry Now] |
| Unknown | "Download failed" | [Retry] [Report] |

---

## Phase 6: Social Features

### 6.1 Contact System
- [ ] Search users by username
- [ ] Send contact request
- [ ] Accept/decline requests
- [ ] Contact list view
- [ ] Block user option

### 6.2 Sharing
- [ ] Share to contact's queue
- [ ] Share file link
- [ ] Shared items history
- [ ] Notification on receive

### 6.3 Share Modal

```
┌────────────────────────────────┐
│  Share with:                   │
│                                │
│  ✓ @mom                        │
│  ✓ @dad                        │
│  □ @sister                     │
│                                │
│  Share as:                     │
│  ○ Add to their queue          │
│  ○ Send file link (when ready) │
│                                │
│  [Share]                       │
└────────────────────────────────┘
```

---

## Phase 7: Browser Extension

### 7.1 Core Extension
- [ ] Media sniffer (detect video/audio)
- [ ] Network request monitoring
- [ ] Download button overlay
- [ ] Popup UI

### 7.2 Authentication
- [ ] OAuth login in extension
- [ ] Store auth token securely
- [ ] Logout functionality

### 7.3 Dual Mode
- [ ] Try local service first (port 3847)
- [ ] Fallback to cloud API
- [ ] Status indicator (local/cloud)

### 7.4 Supported Platforms
- YouTube
- Twitch
- TikTok
- Twitter/X
- Vimeo
- Reddit
- Instagram
- And more (yt-dlp supported)

---

## Phase 8: Error Tracking & Reporting

### 8.1 Sentry Integration
- [ ] Set up Sentry project
- [ ] Next.js integration
- [ ] Electron integration
- [ ] Extension integration
- [ ] Source maps

### 8.2 Bug Reporting
- [ ] Report form in PWA
- [ ] Screenshot attachment
- [ ] Auto-include logs
- [ ] Submit to database

### 8.3 Feature Requests
- [ ] Request form in PWA
- [ ] Store in database
- [ ] Link to reports

### 8.4 Admin Panel
- [ ] Admin authentication
- [ ] Reports dashboard
- [ ] User management
- [ ] System stats

```
┌────────────────────────────────────────────────────────┐
│  Admin Panel                                           │
│                                                        │
│  📊 Overview  📝 Reports  👥 Users  ⚙️ Settings        │
│                                                        │
│  ──────────────────────────────────────────────────    │
│                                                        │
│  Open Reports: 5                                       │
│  Feature Requests: 12                                  │
│  Active Users: 8                                       │
│                                                        │
│  Recent Reports                                        │
│  🐛 App crashes on large playlist - @john - 2h ago    │
│  ✨ Add Vimeo support - @mom - 1d ago                  │
└────────────────────────────────────────────────────────┘
```

### 8.5 Email Notifications (Resend)
- [ ] Set up Resend account
- [ ] New report notification
- [ ] Report resolved notification
- [ ] Email templates

---

## Phase 9: Advanced Features

### 9.1 Content UI
- [ ] Thumbnail grid view
- [ ] List view toggle
- [ ] File details modal

### 9.2 Video Player
- [ ] Stream from desktop
- [ ] HTML5 video player
- [ ] Subtitle support
- [ ] Quality selection

### 9.3 Export
- [ ] Export as CSV
- [ ] Export as JSON
- [ ] Export as Markdown

### 9.4 Dashboards

**User Dashboard:**
- Total downloads
- Total GB downloaded
- Bandwidth used
- Download history

**Admin Dashboard:**
- Total users
- Total downloads (all users)
- System health
- Error rate
- Recent activity

---

## Phase 10: Security & Polish

### 10.1 Security
- [ ] Rate limiting (100 req/hour)
- [ ] API key for desktop app
- [ ] CSRF protection
- [ ] Input validation (Zod)
- [ ] CORS configuration
- [ ] Security headers (Helmet)

### 10.2 Performance
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Caching strategy

### 10.3 SEO & PWA
- [ ] Meta tags
- [ ] Open Graph
- [ ] PWA icons
- [ ] Splash screens

---

## Phase 11: Additional UX Features

### 11.1 Queue Management
- [ ] Drag to reorder queue items
- [ ] Mark item as high priority
- [ ] Select multiple items (checkbox/multi-select)
- [ ] Batch retry failed downloads
- [ ] Batch delete items
- [ ] Move selected to different folder
- [ ] Separate history view from active queue

### 11.2 Settings & Preferences
- [ ] Settings page in PWA
- [ ] Default quality per platform (YouTube: 1080p, Twitch: 720p, etc.)
- [ ] Default download folder setting
- [ ] Settings sync to cloud (store in user profile)
- [ ] Reset to defaults option

### 11.3 Network Handling
- [ ] Detect WiFi vs Cellular (Android)
- [ ] Option to pause on cellular
- [ ] Auto-resume when back on WiFi
- [ ] Rate limit detection
- [ ] Exponential backoff retry
- [ ] Quality fallback when selected unavailable

### 11.4 User Experience
- [ ] Onboarding flow for new users
  - Welcome screen
  - How to add downloads
  - How to use share sheet
  - How to connect Google Drive (optional)
- [ ] Empty states with helpful messages
  - Empty queue: "Add your first download!"
  - Empty history: "Completed downloads appear here"
  - No contacts: "Add friends and family to share downloads"
- [ ] Undo toast notifications
  - "Item deleted" [Undo]
  - 5 second timeout
- [ ] Help section
  - Getting started guides
  - Feature documentation
  - FAQ
  - Troubleshooting
  - Search help articles
  - Contextual help buttons ("?")

### 11.5 Account Management
- [ ] Account settings page
- [ ] Delete account button
- [ ] Confirmation dialog for deletion
- [ ] Actually delete all user data from:
  - Neon DB (user, queue, history, contacts, reports)
  - Google Drive (revoke OAuth token)
  - Cloudflare R2 (delete any temp files)
- [ ] Backup/restore functionality
  - Export as JSON (queue, history, contacts, settings)
  - Import from JSON file
  - Export as human-readable Markdown (optional)

---

## Phase 12: Help & Documentation

### 12.1 Help Section Structure
- [ ] Getting Started
  - What is Grab?
  - Adding your first download
  - Setting up your account
- [ ] Mobile App (PWA)
  - Installing on iPhone
  - Installing on Android
  - Using Share Sheet
  - Offline mode
- [ ] Desktop App
  - Installation
  - How downloads work
  - Background service
- [ ] File Management
  - Transfer to phone
  - Stream from desktop
  - Google Drive integration
  - Folder organization
- [ ] Contacts & Sharing
  - Adding contacts
  - Sharing to queue
  - Sharing file links
- [ ] Browser Extension
  - Installation
  - Media detection
  - Local vs Cloud mode
- [ ] Settings
  - Quality preferences
  - Notifications
  - Storage options
- [ ] FAQ
- [ ] Troubleshooting
- [ ] Changelog

### 12.2 Help Features
- [ ] Search functionality
- [ ] Screenshots in guides
- [ ] Video/GIF demos
- [ ] Contextual help links
- [ ] Platform-specific content

---

## Implementation Priority

| Priority | Phase | Estimated Time |
|----------|-------|----------------|
| 🔴 P0 | Phase 1: Foundation | 1-2 weeks |
| 🔴 P0 | Phase 2: Core PWA | 1-2 weeks |
| 🔴 P0 | Phase 3: Desktop Integration | 1 week |
| 🟡 P1 | Phase 4: File Management | 1-2 weeks |
| 🟡 P1 | Phase 5: Notifications | 1 week |
| 🟡 P1 | Phase 6: Social Features | 1 week |
| 🟢 P2 | Phase 7: Browser Extension | 1-2 weeks |
| 🟢 P2 | Phase 8: Error Tracking | 1 week |
| 🟢 P3 | Phase 9: Advanced Features | 1-2 weeks |
| 🟢 P3 | Phase 10: Security & Polish | 1 week |

---

## Total Estimated Time

**Core (P0):** 3-5 weeks
**Full Feature Set:** 10-14 weeks

---

*Last updated: 2026-02-15*
