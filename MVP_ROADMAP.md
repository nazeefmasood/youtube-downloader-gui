# Grab - MVP Roadmap

> Focused plan to build the minimum viable product first, then iterate with additional features.

---

## MVP Goal

**Get the core flow working:**
```
User on phone → Share/add link → Saved to cloud → Desktop downloads → User gets file
```

---

## MVP Tech Stack (Simplified)

| Component | Technology | Why |
|-----------|------------|-----|
| Frontend | Next.js 14 + Tailwind | Fast to build |
| Auth | NextAuth.js + Google OAuth | Simple, reliable |
| Database | Neon (PostgreSQL) | Free, serverless |
| ORM | Prisma | Type-safe |
| Real-time | Pusher | For notifications |
| Desktop | Grab Desktop (existing) | Already built |
| Deploy | Vercel | Free, easy |

**Skip for MVP:**
- Cloudflare R2 (use Google Drive only for now)
- Sentry (add later)
- Resend (add later)
- Browser extension (add later)
- Admin panel (add later)

---

## Phase 1: Foundation (Week 1)

### 1.1 Project Setup
- [ ] Create Next.js 14 project: `npx create-next-app@latest grab --typescript --tailwind --app`
- [ ] Install dependencies:
  ```
  npm install prisma @prisma/client next-auth @next-auth/prisma-adapter
  npm install zod bcryptjs
  npm install @pusher/pusher-js pusher
  npm install lucide-react clsx tailwind-merge
  ```
- [ ] Set up folder structure:
  ```
  grab/
  ├── app/
  │   ├── (auth)/
  │   │   ├── login/page.tsx
  │   │   └── signup/page.tsx
  │   ├── (app)/
  │   │   ├── queue/page.tsx
  │   │   ├── history/page.tsx
  │   │   └── settings/page.tsx
  │   ├── api/
  │   │   ├── auth/[...nextauth]/route.ts
  │   │   ├── queue/
  │   │   ├── user/
  │   │   └── webhooks/
  │   ├── layout.tsx
  │   ├── page.tsx
  │   └── manifest.ts
  ├── components/
  │   ├── ui/
  │   ├── queue/
  │   └── layout/
  ├── lib/
  │   ├── prisma.ts
  │   ├── auth.ts
  │   └── utils.ts
  ├── prisma/
  │   └── schema.prisma
  └── public/
      └── icons/
  ```
- [ ] Configure Tailwind CSS
- [ ] Set up PWA manifest

### 1.2 Database Setup
- [ ] Create Neon database (free tier)
- [ ] Set up Prisma schema:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  username      String    @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts    Account[]
  sessions    Session[]
  queueItems  QueueItem[]
  settings    UserSettings?

  @@index([email])
  @@index([username])
}

model UserSettings {
  id                    String   @id @default(cuid())
  userId                String   @unique
  defaultQuality        String   @default("best")
  defaultDownloadFolder String   @default("~/Downloads/Grab")
  notifyOnComplete      Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model QueueItem {
  id          String   @id @default(cuid())
  url         String
  title       String?
  status      String   @default("PENDING") // PENDING, DOWNLOADING, COMPLETED, FAILED
  platform    String?
  fileSize    BigInt?
  filePath    String?
  errorMessage String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?
  userId      String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([userId, status])
}

model DownloadHistory {
  id          String   @id @default(cuid())
  userId      String
  totalBytes  BigInt   @default(0)
  totalFiles  Int      @default(0)
  lastUpdated DateTime @default(now())
}
```

- [ ] Run `npx prisma db push`
- [ ] Run `npx prisma generate`

### 1.3 Authentication
- [ ] Configure NextAuth.js with Google OAuth
- [ ] Create `/api/auth/[...nextauth]/route.ts`
- [ ] Set up Google Cloud Console for OAuth
- [ ] Create login/signup pages
- [ ] Protect routes with middleware
- [ ] Auto-generate username from email

---

## Phase 2: Core Web App (Week 1-2)

### 2.1 Basic Layout
- [ ] Create responsive layout (mobile-first)
- [ ] Bottom navigation: Queue | History | Settings
- [ ] Header with user avatar
- [ ] Loading states

### 2.2 Queue Page
- [ ] Queue list with empty state
- [ ] Add URL form:
  ```tsx
  // components/queue/AddUrlForm.tsx
  - URL input
  - Platform auto-detection (show icon)
  - Duplicate check on blur
  - "Add to Queue" button
  ```
- [ ] Queue item card:
  ```tsx
  // components/queue/QueueItemCard.tsx
  - Platform icon (YouTube, Twitch, etc.)
  - Title (or URL if no title)
  - Status badge (Pending, Downloading, Completed, Failed)
  - Progress bar (when downloading)
  - Actions: Cancel, Retry, Remove
  ```
- [ ] Real-time status updates via Pusher

### 2.3 History Page
- [ ] List of completed downloads
- [ ] Filter by platform
- [ ] Search by title
- [ ] Click to see details

### 2.4 Settings Page
- [ ] Display username
- [ ] Default quality preference
- [ ] Notification toggle
- [ ] Sign out button

---

## Phase 3: Share Sheet (Week 2)

### 3.1 Web Share Target API
- [ ] Configure in manifest:
  ```json
  {
    "share_target": {
      "action": "/share",
      "method": "POST",
      "params": {
        "url": "url",
        "title": "title",
        "text": "text"
      }
    }
  }
  ```
- [ ] Create `/share` page that:
  - Receives shared URL
  - Shows quick add modal
  - Adds to queue
  - Redirects to queue page

### 3.2 Share Modal
```tsx
// components/share/ShareModal.tsx
┌────────────────────────────────┐
│  Add to Queue                  │
│                                │
│  URL: youtube.com/watch?v=...  │
│                                │
│  Platform: YouTube             │
│                                │
│  [Cancel]  [Add to Queue]      │
└────────────────────────────────┘
```

### 3.3 PWA Install
- [ ] Add to home screen prompt
- [ ] Install button in settings
- [ ] PWA icons (all sizes)

---

## Phase 4: Desktop Sync (Week 2-3)

### 4.1 Desktop App Updates
- [ ] Add API key generation in settings
- [ ] Store API key securely in desktop app
- [ ] Create `/api/queue/pending` endpoint for desktop
- [ ] Create `/api/queue/:id/status` endpoint to update status
- [ ] Desktop polls every 30 seconds:
  ```javascript
  // In Grab Desktop
  async function pollCloudQueue() {
    const response = await fetch('https://grab.vercel.app/api/queue/pending', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const items = await response.json();
    return items;
  }
  ```

### 4.2 Status Updates
- [ ] Desktop sends status updates:
  - DOWNLOADING (with progress %)
  - COMPLETED (with file path)
  - FAILED (with error message)
- [ ] Web app shows real-time status via Pusher

### 4.3 Pusher Integration
- [ ] Set up Pusher account
- [ ] Server-side triggers:
  ```javascript
  // When status changes
  await pusher.trigger(`user-${userId}`, 'queue-update', {
    itemId,
    status,
    progress
  });
  ```
- [ ] Client-side subscription:
  ```javascript
  const channel = pusher.subscribe(`user-${userId}`);
  channel.bind('queue-update', (data) => {
    // Update UI
  });
  ```

---

## Phase 5: File Access (Week 3)

### 5.1 HTTP Server (Desktop)
- [ ] Add file listing endpoint
- [ ] Add file download endpoint (with range support)
- [ ] Add file streaming endpoint

### 5.2 File Browser (Web App)
- [ ] "Files" tab in history
- [ ] List downloaded files
- [ ] Detect if on same network as desktop
- [ ] Download button → `http://[desktop-ip]:3847/download/[file-id]`
- [ ] Stream button → Opens video player

### 5.3 Network Detection
```javascript
// Check if desktop is reachable
async function checkDesktopConnection() {
  try {
    const response = await fetch('http://[local-ip]:3847/ping', {
      timeout: 2000
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

---

## Phase 6: Polish (Week 3-4)

### 6.1 Error Handling
- [ ] Handle network errors gracefully
- [ ] Show helpful error messages
- [ ] Retry button for failed downloads

### 6.2 Loading States
- [ ] Skeleton loaders for lists
- [ ] Spinner for actions
- [ ] Optimistic updates

### 6.3 Empty States
```tsx
// components/queue/EmptyQueue.tsx
┌────────────────────────────────┐
│                                │
│         📥                     │
│                                │
│    Your queue is empty         │
│                                │
│    Share a link or paste a     │
│    URL to get started          │
│                                │
│    [Paste URL]                 │
│                                │
└────────────────────────────────┘
```

### 6.4 Basic Help
- [ ] How to add downloads
- [ ] How to install PWA
- [ ] How to connect desktop app

---

## MVP Features Summary

| Feature | Status | Priority |
|---------|--------|----------|
| User auth (Google) | ✅ MVP | P0 |
| Queue management | ✅ MVP | P0 |
| Share Sheet integration | ✅ MVP | P0 |
| Desktop sync | ✅ MVP | P0 |
| Real-time status | ✅ MVP | P0 |
| File download (same WiFi) | ✅ MVP | P0 |
| File streaming | ✅ MVP | P1 |
| History view | ✅ MVP | P1 |
| Settings | ✅ MVP | P1 |

---

## Post-MVP Features (Add Later)

### Phase 7: Social (Week 5)
- Contact system
- Share to friend's queue
- Share file links

### Phase 8: Storage (Week 6)
- Google Drive integration
- Cloudflare R2 temp storage

### Phase 9: Extension (Week 7-8)
- Browser extension
- Media sniffer
- Cloud fallback

### Phase 10: Admin & Analytics (Week 9)
- Admin panel
- User dashboard
- Bug reporting

### Phase 11: Polish (Week 10+)
- Sentry integration
- Onboarding flow
- Help section
- All remaining UX features

---

## Quick Start Commands

```bash
# 1. Create project
npx create-next-app@latest grab --typescript --tailwind --app

# 2. Install dependencies
cd grab
npm install prisma @prisma/client next-auth @next-auth/prisma-adapter
npm install zod bcryptjs
npm install @pusher/pusher-js pusher
npm install lucide-react clsx tailwind-merge

# 3. Set up database
npx prisma init
# Edit prisma/schema.prisma
npx prisma db push
npx prisma generate

# 4. Run dev server
npm run dev
```

---

## Environment Variables

```env
# .env.local

# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Pusher
NEXT_PUBLIC_PUSHER_APP_ID="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_CLUSTER="..."
```

---

## Deployment Checklist

- [ ] Push to GitHub
- [ ] Connect to Vercel
- [ ] Add environment variables
- [ ] Set up Neon database
- [ ] Configure Google OAuth redirect URIs
- [ ] Test on mobile device

---

*MVP Timeline: 3-4 weeks*
*Post-MVP: Continue adding features incrementally*
