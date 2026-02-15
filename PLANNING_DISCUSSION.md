# Grab - Planning Discussion Summary

> Complete record of the planning discussion for transforming VidGrab into Grab, a general-purpose cloud-connected downloader.

**Date:** February 15, 2026

---

## Initial Context

### User's Original Vision
- Wanted iOS/Android app but abandoned due to Apple Developer Program ($99/year)
- Often finds things to download while on phone but forgets links
- Wants to save links on mobile and have files ready when back at desktop
- Wanted to make VidGrab a **general downloader** (not just YouTube)

### Key Requirements Identified
- Web app (Next.js) accessible on iPhone as PWA
- User logs in, adds links → saved to cloud database
- Desktop app detects pending links and downloads them
- Real-time notifications when downloads complete
- iOS Share Sheet integration for quick adding
- IDM-style link detection via browser extension

---

## Architecture Decisions

### Confirmed Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 + PWA + Tailwind CSS |
| Auth | NextAuth.js + Google OAuth |
| Database | Neon (PostgreSQL) |
| ORM | Prisma |
| Real-time | Pusher |
| Storage (Permanent) | Google Drive API |
| Storage (Temporary) | Cloudflare R2 (10GB free) |
| Error Tracking | Sentry |
| Email | Resend |
| Desktop App | Grab Desktop (Electron + yt-dlp) |
| Extension | Chrome/Firefox Extension |
| Deploy | Vercel |

### Free Tier Limits (Personal Use)

| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth, unlimited deploys |
| Neon | 0.5GB storage, 100 hours compute/month |
| Cloudflare R2 | 10GB storage, 10GB egress/month |
| Sentry | 5,000 errors/month |
| Resend | 3,000 emails/month |
| Pusher | 200k messages/day |

---

## Feature Decisions

### Areas for Improvement (10 Items Discussed)

| # | Feature | Decision | Notes |
|---|---------|----------|-------|
| 1 | File Access | ✅ Confirmed | HTTP transfer + Google Drive + Cloudflare R2 |
| 2 | Multi-Device | ✅ Confirmed (Simple) | Any device picks up pending downloads |
| 3 | Extension → Cloud | ✅ Confirmed | Media sniffer with cloud fallback |
| 4 | Offline PWA | ✅ Confirmed | IndexedDB sync when online |
| 5 | Duplicate Detection | ✅ Confirmed | Warn if URL already downloaded |
| 6 | Smart Metadata | ❌ Skipped | Can't fetch from web app directly |
| 7 | Notifications | ✅ Confirmed | Pusher + Android background push |
| 8 | Folder Rules | ✅ Confirmed | Auto-organize by platform |
| 9 | Rate Limiting & Security | ✅ Confirmed | 100 req/hour, API keys, CSRF |
| 10 | Contact System | ✅ Confirmed | Add friends/family by username |

### Feature Brainstorm Categories

#### 🤖 Smart & AI-Powered
- All skipped (overkill for personal use)
- Note: Playlist/channel download already exists in VidGrab

#### ⚡ Advanced Download Control
| Feature | Decision |
|---------|----------|
| Resume Broken | ✅ Confirmed |
| Parallel Downloads | ✅ Confirmed (careful with rate limits) |
| Everything else | ❌ Skipped |

#### 📁 Organization & Management
| Feature | Decision |
|---------|----------|
| Export Metadata | ✅ Confirmed (CSV, JSON, Markdown) |
| Everything else | ❌ Skipped |

#### 🎬 Content Features
| Feature | Decision |
|---------|----------|
| Thumbnail Grid | ✅ Confirmed |
| Stream from Desktop | ✅ Confirmed |
| Download to Phone | ✅ Confirmed |
| Subtitle Download | Already exists |
| Everything else | ❌ Skipped |

#### ⏰ Scheduling & Automation
| Feature | Decision |
|---------|----------|
| Auto-Delete Rules | ✅ Confirmed |
| Everything else | ❌ Skipped |

#### 🔔 Notifications & Alerts
| Feature | Decision |
|---------|----------|
| Rich Notifications (Android) | ✅ Confirmed |
| Rich Notifications (iOS) | ⚠️ Best effort (limited) |
| Download Failed Alerts | ✅ Confirmed |
| Everything else | ❌ Skipped |

#### 🔒 Security & Privacy
- All skipped

#### 📊 Analytics & Insights
| Feature | Decision |
|---------|----------|
| User Dashboard | ✅ Confirmed |
| Admin Dashboard | ✅ Confirmed |
| Everything else | ❌ Skipped |

#### 👨‍💻 Developer/API
- All skipped

#### 💰 Monetization
- All skipped (personal/friends/family use)

---

## Additional Features Added Later

### 📋 Queue Management
| Feature | Decision |
|---------|----------|
| Queue Priority (drag reorder, high priority) | ✅ Confirmed |
| Batch Operations (select multiple, retry/delete/move all) | ✅ Confirmed |
| History Separation (completed items in separate view) | ✅ Confirmed |

### ⚙️ Settings & Preferences
| Feature | Decision |
|---------|----------|
| Settings Sync (across devices) | ✅ Confirmed |
| Default Quality (per platform) | ✅ Confirmed |
| Default Download Folder | ✅ Confirmed |

### 🌐 Network & Platform
| Feature | Decision |
|---------|----------|
| WiFi vs Cellular (pause on cellular) | ✅ Confirmed |
| Rate Limit Handling (exponential backoff) | ✅ Confirmed |
| Quality Fallback (auto-pick next best) | ✅ Confirmed |

### 📱 User Experience
| Feature | Decision |
|---------|----------|
| Onboarding (first-time tutorial) | ✅ Confirmed |
| Empty States (helpful messages) | ✅ Confirmed |
| Undo Actions (toast with undo) | ✅ Confirmed |
| Help Section (full documentation) | ✅ Confirmed |

### 🔐 Account
| Feature | Decision |
|---------|----------|
| Account Deletion (GDPR compliance) | ✅ Confirmed |
| Backup/Restore (export/import data) | ✅ Confirmed |

### Skipped in This Round
| Feature | Reason |
|---------|--------|
| Migration from VidGrab | Small user base |
| Username Change | Complex, rarely needed |
| Multiple Google Drive | Overcomplicates storage |

---

## Key Features - Detailed Decisions

### 1. File Access Strategy

**Two-tier storage system:**

| Scenario | Storage | Duration |
|----------|---------|----------|
| Google Drive connected | User's Google Drive | Permanent |
| No Google Drive | Cloudflare R2 | 24h expiry |

**Google Drive Structure:**
```
Google Drive/
└── Grab/
    ├── YouTube/
    ├── Twitch/
    ├── TikTok/
    ├── Twitter/
    └── Music/
```

**HTTP Transfer (Same WiFi):**
- Grab Desktop serves files via port 3847
- Phone detects same network
- Stream or download directly

### 2. Contact System

**Friends & Family only (not public social):**
- Find users by username
- Send/accept contact requests
- Share to queue or share file link

**Sharing Options:**
- Add to their queue (appears in their downloads)
- Send file link (after download completes)

### 3. Browser Extension

**Media Sniffer Capabilities:**
- Detect video/audio on any page
- Monitor network requests
- Show download button overlay

**Dual Mode:**
- Try local service first (port 3847)
- Fallback to cloud API if local unavailable
- Extension login for cloud access

**Supported Platforms:**
All yt-dlp supported sites (1800+):
- YouTube, Twitch, TikTok, Twitter/X
- Instagram, Reddit, Vimeo
- And many more

### 4. Notification Strategy

**Platform-Specific:**

| Platform | In-App | Background | Push |
|----------|--------|------------|------|
| iOS | ✅ Pusher | ❌ Not possible | ⚠️ Limited |
| Android | ✅ Pusher | ✅ Yes | ✅ Yes |
| Desktop | ✅ Pusher | ✅ Yes | ✅ Yes |

**Note:** Telegram backup was skipped (banned in user's region)

### 5. Download Failed Alerts

| Error Type | Message | Action |
|------------|---------|--------|
| Video removed | "Video was removed from platform" | [Remove from Queue] |
| Private video | "This video is private" | [Skip] |
| Rate limited | "Too many requests" | [Retry in 1 hour] |
| Network error | "Connection failed" | [Retry Now] |
| Format unavailable | "Format not available" | [Try Another Quality] |
| Unknown error | "Download failed" | [Retry] [Report Bug] |

### 6. Share Sheet Popup

When user shares via iOS Share Sheet, show modal:

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

### 7. Error Tracking & Reporting

**Components:**
- Sentry for auto error tracking
- In-app bug reporting form
- Feature request form
- Admin panel for management
- Email notifications via Resend

**Report Types:**
- 🐛 Bug
- ✨ Feature Request
- 💬 Other

---

## App Name Decision

**Final Name:** **Grab**

**Rationale:**
- Short and memorable
- Works for general downloader (not YouTube-specific)
- Modern and clean
- Could use domain like `grab-app.com` or `getgrab.app`

**Previous Name:** VidGrab

---

## Implementation Phases

| Phase | Description | Priority | Est. Time |
|-------|-------------|----------|-----------|
| 1 | Foundation (DB, Auth, API) | 🔴 P0 | 1-2 weeks |
| 2 | Core PWA (Queue, UI) | 🔴 P0 | 1-2 weeks |
| 3 | Desktop Integration | 🔴 P0 | 1 week |
| 4 | File Management | 🟡 P1 | 1-2 weeks |
| 5 | Notifications | 🟡 P1 | 1 week |
| 6 | Social Features | 🟡 P1 | 1 week |
| 7 | Browser Extension | 🟢 P2 | 1-2 weeks |
| 8 | Error Tracking | 🟢 P2 | 1 week |
| 9 | Advanced Features | 🟢 P3 | 1-2 weeks |
| 10 | Security & Polish | 🟢 P3 | 1 week |

**Total Core (P0):** 3-5 weeks
**Full Feature Set:** 10-14 weeks

---

## Confirmed Features Count

| Category | Confirmed | Skipped |
|----------|-----------|---------|
| Areas for Improvement | 9 | 1 |
| Feature Brainstorm | 12 | 48 |
| **Total** | **21** | **49** |

---

## Files Created

1. `GENERAL_DOWNLOADER_PLAN.md` - Full architecture & feature discussion
2. `IMPLEMENTATION_ROADMAP.md` - Organized implementation checklist with code examples
3. `PLANNING_DISCUSSION.md` - This summary document

---

## Next Steps

1. Initialize Next.js 14 project with name "Grab"
2. Set up Neon database and Prisma
3. Configure NextAuth.js with Google OAuth
4. Build core PWA with queue management
5. Update Grab Desktop to poll cloud API
6. Implement file management (HTTP transfer, Google Drive, R2)
7. Add Pusher for real-time notifications
8. Build contact system and sharing
9. Develop browser extension
10. Add error tracking and admin panel

---

*Discussion completed: February 15, 2026*
