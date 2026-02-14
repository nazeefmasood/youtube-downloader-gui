# PO Token Integration + Batch Downloads + Status Bar - Implementation Plan

## Status: COMPLETED

All features have been implemented:

| Feature | Status | Notes |
|---------|--------|-------|
| PO Token Server | DONE | `electron/potTokenServer.ts` fully implemented |
| Token fetching in downloader | DONE | `getExtractorArgs()` uses `fetchPotToken()` |
| Batch group tracking | DONE | `QueueItem.batchGroupId`, `batchGroups` Map |
| Batch pause logic | DONE | Dynamic 5min/10min based on playlist size |
| Countdown system | DONE | `CountdownInfo`, 1-second intervals |
| Dependencies | DONE | bgutils-js, jsdom, youtubei.js installed |
| Status Bar UI | DONE | Countdown display, PO Token indicator |
| Settings UI | DONE | Batch + PO token config panels |
| PO Token status IPC | DONE | `pot:status` events to renderer |

## What Was Implemented

### 1. Status Bar Enhancements
- Batch pause countdown with pulsing animation
- Download delay countdown
- PO Token indicator badge (green=running, red=stopped)
- Batch info badge during downloads

### 2. Settings Panel
**"BATCH DOWNLOADS" group:**
- Enable Batch Pausing toggle
- Batch Size selector (10/15/25/50)
- Short Pause duration (≤50 videos)
- Long Pause duration (>50 videos)

**"PO TOKEN SERVER" group:**
- Status badge (RUNNING/STOPPED)
- Enable PO Token toggle
- Token Cache TTL selector
- Restart Server button

### 3. PO Token IPC
- `getPotTokenStatus()` - Get current status
- `restartPotTokenServer()` - Restart the server
- `onPotTokenStatus(callback)` - Subscribe to status updates (every 30s)

### 4. CSS Styles
- `.status-countdown` - Pulsing countdown text
- `.status-countdown-small` - Subtle delay countdown
- `.status-batch-info` - Batch progress badge
- `.pot-indicator` - Status bar PO token badge
- `.pot-status-badge` - Settings panel status badge
- `.status-indicator.batch-paused` - Yellow pulsing dot
- `@keyframes countdownPulse` - Animation

---

## Original Context

After reviewing the codebase, the backend work is **already complete**. Here's what exists vs. what's still needed:

| Feature | Status | Notes |
|---------|--------|-------|
| PO Token Server | ✅ Done | `electron/potTokenServer.ts` fully implemented |
| Token fetching in downloader | ✅ Done | `getExtractorArgs()` uses `fetchPotToken()` |
| Batch group tracking | ✅ Done | `QueueItem.batchGroupId`, `batchGroups` Map |
| Batch pause logic | ✅ Done | Dynamic 5min/10min based on playlist size |
| Countdown system | ✅ Done | `CountdownInfo`, 1-second intervals |
| Dependencies | ✅ Done | bgutils-js, jsdom, youtubei.js installed |
| **Status Bar UI** | ❌ Missing | No countdown/pause display |
| **Settings UI** | ❌ Missing | No batch/PO token config panel |
| **PO Token status IPC** | ❌ Missing | No `pot:status` events to renderer |

---

## What Still Needs To Be Done

### 1. Status Bar Enhancements (`src/App.tsx`)

**Current status bar:** Shows "READY" or downloading progress.

**Needed additions:**
- Display `countdownInfo` when type is `'batch-pause'` or `'download-delay'`
- Show "Batch pause: resuming in 4:32" with pulsing animation
- Show "Next download in 3s" for inter-download delays
- Add PO Token indicator badge (green = running, red = stopped)
- Show "BATCH 2/4" badge when batch group is active

**Priority order for left side:**
1. Batch pause countdown (accent color, pulse animation)
2. Download delay countdown (muted color)
3. Downloading progress (current)
4. "READY" (current)

### 2. Settings Panel (`src/App.tsx`)

Add two new settings groups:

**"BATCH DOWNLOADS" group:**
```tsx
<div className="settings-group">
  <h3>BATCH DOWNLOADS</h3>
  <Toggle label="Enable Batch Pausing" value={settings.batchDownloadEnabled} />
  <Select label="Batch Size" options={[10, 15, 25, 50]} value={settings.batchSize} />
  <Select label="Short Pause (≤50 videos)" options={[3, 5, 10, 15]} unit="min" value={settings.batchPauseShort} />
  <Select label="Long Pause (>50 videos)" options={[5, 10, 15, 20, 30]} unit="min" value={settings.batchPauseLong} />
</div>
```

**"PO TOKEN SERVER" group:**
```tsx
<div className="settings-group">
  <h3>PO TOKEN SERVER</h3>
  <Badge status={potTokenStatus.running ? 'RUNNING' : 'STOPPED'} />
  <Button onClick={restartPotServer}>Restart Server</Button>
</div>
```

### 3. PO Token IPC Handlers (`electron/main.ts` & `electron/preload.ts`)

**Add to `main.ts`:**
```typescript
// Start PO token server on app launch (after httpServer)
import { startPotTokenServer, getPotTokenStatus, cleanupPotTokenServer } from './potTokenServer'

// In createWindow():
await startPotTokenServer(4416, 360) // port, TTL in minutes

// Add IPC handlers:
ipcMain.handle('pot:getStatus', () => getPotTokenStatus())
ipcMain.handle('pot:restart', async () => {
  cleanupPotTokenServer()
  await startPotTokenServer()
  return getPotTokenStatus()
})

// Send status updates every 30s:
setInterval(() => {
  mainWindow?.webContents.send('pot:status', getPotTokenStatus())
}, 30000)

// In cleanup():
cleanupPotTokenServer()
```

**Add to `preload.ts`:**
```typescript
getPotTokenStatus: () => ipcRenderer.invoke('pot:getStatus'),
restartPotTokenServer: () => ipcRenderer.invoke('pot:restart'),
onPotTokenStatus: (callback) => {
  ipcRenderer.on('pot:status', (_event, status) => callback(status))
  return () => ipcRenderer.removeListener('pot:status', callback)
},
```

### 4. Update Types (`src/types.ts`)

Already has `BatchStatus` and `CountdownInfo` - verify these are exported and used in `ElectronAPI`:

```typescript
interface PotTokenStatus {
  running: boolean
  port: number
  lastTokenTime: string | null
  tokenCount: number
  error: string | null
  uptime: number
}

interface ElectronAPI {
  // ... existing
  getPotTokenStatus: () => Promise<PotTokenStatus>
  restartPotTokenServer: () => Promise<PotTokenStatus>
  onPotTokenStatus: (callback: (status: PotTokenStatus) => void) => () => void
}
```

### 5. Update Download Store (`src/stores/downloadStore.ts`)

Add PO token status tracking:
```typescript
interface DownloadStore {
  // ... existing
  potTokenStatus: PotTokenStatus | null
  setPotTokenStatus: (status: PotTokenStatus) => void
}

// In defaults:
potTokenStatus: null,
```

### 6. CSS Styles (`src/index.css`)

Add countdown and badge styles:
```css
/* Batch pause countdown - prominent, pulsing */
.status-countdown {
  color: var(--accent);
  animation: countdownPulse 1.5s ease-in-out infinite;
}

/* Download delay countdown - subtle */
.status-countdown-small {
  color: var(--text-muted);
  font-size: 0.85em;
}

/* Batch info badge */
.status-batch-info {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.75em;
  margin-left: 8px;
}

/* PO Token indicator */
.pot-indicator {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7em;
  font-weight: 600;
}
.pot-indicator.active {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}
.pot-indicator.inactive {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

@keyframes countdownPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## Implementation Order (Remaining Work)

1. **`src/types.ts`** — Add `PotTokenStatus`, update `ElectronAPI` interface
2. **`electron/main.ts`** — Add PO server lifecycle, IPC handlers
3. **`electron/preload.ts`** — Expose PO token APIs
4. **`src/stores/downloadStore.ts`** — Add potTokenStatus state
5. **`src/index.css`** — Add countdown/badge styles
6. **`src/App.tsx`** — Status bar enhancements + settings UI

---

## Verification Checklist

- [ ] Start app → verify PO token server starts on port 4416
- [ ] Download single video → verify no 403/bot errors
- [ ] Add playlist with 30+ videos → verify batch pause after 25
- [ ] Verify countdown shows "Batch pause: resuming in X:XX"
- [ ] Verify "Next download in Xs" between individual downloads
- [ ] Check settings shows "RUNNING" badge for PO token
- [ ] Test restart server button
- [ ] Toggle batch pausing off → verify continuous download

---

## Rate Limit Reference

| Scenario | Limit |
|----------|-------|
| Guest sessions | ~300 videos/hour |
| Authenticated | ~2000 videos/hour |
| Inter-download delay | 2-5 seconds |
| Small batch pause (≤50 videos) | 5 minutes |
| Large batch pause (>50 videos) | 10 minutes |

---

## References

- [yt-dlp Extractors Wiki](https://github.com/yt-dlp/yt-dlp/wiki/Extractors)
- [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [BgUtils Repository](https://github.com/LuanRT/BgUtils)
