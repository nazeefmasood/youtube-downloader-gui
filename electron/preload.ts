import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeToTray: () => ipcRenderer.invoke('window:minimizeToTray'),
  forceQuit: () => ipcRenderer.invoke('window:forceQuit'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Mini mode
  toggleMiniMode: () => ipcRenderer.invoke('mini:toggle'),
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('mini:setAlwaysOnTop', enabled),
  getMiniModeState: () => ipcRenderer.invoke('mini:getState'),
  onMiniModeChanged: (callback: (isMini: boolean) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, isMini: boolean) => callback(isMini)
    ipcRenderer.on('mini-mode:changed', subscription)
    return () => ipcRenderer.removeListener('mini-mode:changed', subscription)
  },

  // URL detection
  detectUrl: (url: string) => ipcRenderer.invoke('url:detect', url),
  cancelDetection: () => ipcRenderer.invoke('url:cancelDetect'),

  // Formats
  getFormats: (url: string) => ipcRenderer.invoke('formats:get', url),

  // Subtitles
  getSubtitles: (url: string) => ipcRenderer.invoke('subtitles:get', url),

  // Search
  searchYouTube: (query: string, maxResults?: number) =>
    ipcRenderer.invoke('search:youtube', query, maxResults),

  // Download
  startDownload: (options: {
    url: string
    format: string
    audioOnly?: boolean
    outputPath?: string
  }) => ipcRenderer.invoke('download:start', options),

  cancelDownload: () => ipcRenderer.invoke('download:cancel'),

  onDownloadProgress: (callback: (progress: {
    percent: number
    speed?: string
    eta?: string
    downloaded?: string
    total?: string
    currentFile?: string
    currentIndex?: number
    totalFiles?: number
    status: string
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof callback>[0]) => callback(progress)
    ipcRenderer.on('download:progress', subscription)
    return () => ipcRenderer.removeListener('download:progress', subscription)
  },

  onDownloadComplete: (callback: (result: {
    success: boolean
    filePath?: string
    error?: string
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, result: Parameters<typeof callback>[0]) => callback(result)
    ipcRenderer.on('download:complete', subscription)
    return () => ipcRenderer.removeListener('download:complete', subscription)
  },

  onDownloadError: (callback: (error: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('download:error', subscription)
    return () => ipcRenderer.removeListener('download:error', subscription)
  },

  onVideoComplete: (callback: (videoInfo: {
    index: number
    totalFiles: number
    title: string
    filePath: string
    alreadyDownloaded?: boolean
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, videoInfo: Parameters<typeof callback>[0]) => callback(videoInfo)
    ipcRenderer.on('download:videoComplete', subscription)
    return () => ipcRenderer.removeListener('download:videoComplete', subscription)
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  addToHistory: (item: {
    id: string
    title: string
    url: string
    thumbnail?: string
    downloadDate: string
    filePath: string
    fileSize?: number
    duration?: number
    status: 'completed' | 'failed' | 'cancelled'
    type: 'video' | 'playlist' | 'channel'
    videoCount?: number
  }) => ipcRenderer.invoke('history:add', item),
  removeFromHistory: (id: string) => ipcRenderer.invoke('history:remove', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  checkDuplicate: (url: string) => ipcRenderer.invoke('history:checkDuplicate', url),
  onHistoryAdded: (callback: (item: {
    id: string
    title: string
    url: string
    thumbnail?: string
    downloadDate: string
    filePath: string
    status: string
    type: string
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, item: Parameters<typeof callback>[0]) => callback(item)
    ipcRenderer.on('history:added', subscription)
    return () => ipcRenderer.removeListener('history:added', subscription)
  },
  onBatchComplete: (callback: (info: { batchGroupId: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, info: Parameters<typeof callback>[0]) => callback(info)
    ipcRenderer.on('batch:complete', subscription)
    return () => ipcRenderer.removeListener('batch:complete', subscription)
  },

  // File operations
  openFile: (filePath: string) => ipcRenderer.invoke('file:open', filePath),
  openFolder: (filePath: string) => ipcRenderer.invoke('file:showInFolder', filePath),
  selectFolder: () => ipcRenderer.invoke('folder:select'),

  // Queue operations
  getQueue: () => ipcRenderer.invoke('queue:get'),
  addToQueue: (item: {
    url: string
    title: string
    thumbnail?: string
    channel?: string
    format: string
    qualityLabel?: string
    audioOnly: boolean
    source: 'app' | 'extension'
    sourceType?: 'single' | 'playlist' | 'channel'
    contentType?: 'video' | 'audio' | 'subtitle' | 'video+sub'
    subtitleOptions?: {
      enabled: boolean
      languages: string[]
      includeAutoGenerated: boolean
      format: 'srt' | 'vtt' | 'ass'
      embedInVideo: boolean
    }
    subtitleDisplayNames?: string
    batchGroupId?: string
  }) => ipcRenderer.invoke('queue:add', item),
  removeFromQueue: (id: string) => ipcRenderer.invoke('queue:remove', id),
  cancelQueueItem: (id: string) => ipcRenderer.invoke('queue:cancel', id),
  pauseQueueItem: (id: string) => ipcRenderer.invoke('queue:pauseItem', id),
  resumeQueueItem: (id: string) => ipcRenderer.invoke('queue:resumeItem', id),
  pauseQueue: () => ipcRenderer.invoke('queue:pause'),
  resumeQueue: () => ipcRenderer.invoke('queue:resume'),
  clearQueue: () => ipcRenderer.invoke('queue:clear'),
  retryQueueItem: (id: string) => ipcRenderer.invoke('queue:retry', id),
  retryAllFailed: () => ipcRenderer.invoke('queue:retryAllFailed'),
  cancelRetry: (id: string) => ipcRenderer.invoke('queue:cancelRetry', id),
  setQueueItemPriority: (id: string, priority: number) => ipcRenderer.invoke('queue:setPriority', id, priority),
  getQueueItemPriority: (id: string) => ipcRenderer.invoke('queue:getPriority', id),
  onQueueUpdate: (callback: (status: {
    items: Array<{
      id: string
      url: string
      title: string
      thumbnail?: string
      channel?: string
      format: string
      qualityLabel?: string
      audioOnly: boolean
      status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'retrying'
      progress?: {
        percent: number
        speed?: string
        eta?: string
        status: string
      }
      addedAt: number
      source: 'app' | 'extension'
      sourceType?: 'single' | 'playlist' | 'channel'
      contentType?: 'video' | 'audio' | 'subtitle' | 'video+sub'
      subtitleOptions?: { languages?: string[]; format?: string }
      subtitleDisplayNames?: string
      batchGroupId?: string
      error?: string
      retryCount?: number
      nextRetryAt?: number
      autoRetryEnabled?: boolean
      priority?: number
    }>
    isProcessing: boolean
    isPaused: boolean
    currentItemId: string | null
    batchStatus?: {
      active: boolean
      groupId: string | null
      batchNumber: number
      totalBatches: number
      itemsInCurrentBatch: number
      batchSize: number
      totalItems: number
      completedItems: number
      isPaused: boolean
      pauseRemaining: number
      pauseDuration: number
    } | null
    countdownInfo?: {
      type: 'batch-pause' | 'download-delay' | 'retry-delay' | 'none'
      remaining: number
      total: number
      label: string
    } | null
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, status: Parameters<typeof callback>[0]) => callback(status)
    ipcRenderer.on('queue:update', subscription)
    return () => ipcRenderer.removeListener('queue:update', subscription)
  },

  // Logger operations
  getErrorLogs: () => ipcRenderer.invoke('logger:getErrors'),
  openLogFile: () => ipcRenderer.invoke('logger:openLogFile'),

  // Binary management
  checkBinary: () => ipcRenderer.invoke('binary:check'),
  downloadBinary: () => ipcRenderer.invoke('binary:download'),
  getBinaryStatus: () => ipcRenderer.invoke('binary:status'),
  onBinaryDownloadStart: (callback: (data: { name: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
    ipcRenderer.on('binary:download-start', subscription)
    return () => ipcRenderer.removeListener('binary:download-start', subscription)
  },
  onBinaryDownloadProgress: (callback: (data: { percent: number; downloaded: number; total: number }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
    ipcRenderer.on('binary:download-progress', subscription)
    return () => ipcRenderer.removeListener('binary:download-progress', subscription)
  },
  onBinaryDownloadComplete: (callback: (data: { path: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
    ipcRenderer.on('binary:download-complete', subscription)
    return () => ipcRenderer.removeListener('binary:download-complete', subscription)
  },
  onBinaryDownloadError: (callback: (data: { error: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: Parameters<typeof callback>[0]) => callback(data)
    ipcRenderer.on('binary:download-error', subscription)
    return () => ipcRenderer.removeListener('binary:download-error', subscription)
  },

  // FFmpeg management
  checkFfmpeg: () => ipcRenderer.invoke('ffmpeg:check'),
  downloadFfmpeg: () => ipcRenderer.invoke('ffmpeg:download'),
  getFfmpegPath: () => ipcRenderer.invoke('ffmpeg:path'),

  // Update operations
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateStatus: () => ipcRenderer.invoke('update:getStatus'),
  cancelUpdate: () => ipcRenderer.invoke('update:cancel'),
  getChangelog: (body: string, version: string) => ipcRenderer.invoke('update:getChangelog', body, version),
  markChangelogSeen: () => ipcRenderer.invoke('update:markChangelogSeen'),
  getUpdateState: () => ipcRenderer.invoke('update:getUpdateState'),
  skipUpdateVersion: (version: string) => ipcRenderer.invoke('update:skipVersion', version),
  resetUpdate: () => ipcRenderer.invoke('update:reset'),
  fetchChangelogFromMain: () => ipcRenderer.invoke('update:fetchChangelog'),

  // Update event listeners
  onUpdateChecking: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('update:checking', subscription)
    return () => ipcRenderer.removeListener('update:checking', subscription)
  },
  onUpdateAvailable: (callback: (info: {
    version: string
    currentVersion: string
    releaseDate: string
    releaseNotes: string
    downloadUrl: string
    mandatory: boolean
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, info: Parameters<typeof callback>[0]) => callback(info)
    ipcRenderer.on('update:available', subscription)
    return () => ipcRenderer.removeListener('update:available', subscription)
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('update:not-available', subscription)
    return () => ipcRenderer.removeListener('update:not-available', subscription)
  },
  onUpdateProgress: (callback: (progress: {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof callback>[0]) => callback(progress)
    ipcRenderer.on('update:progress', subscription)
    return () => ipcRenderer.removeListener('update:progress', subscription)
  },
  onUpdateDownloaded: (callback: (filePath: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('update:downloaded', subscription)
    return () => ipcRenderer.removeListener('update:downloaded', subscription)
  },
  onUpdateError: (callback: (error: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('update:error', subscription)
    return () => ipcRenderer.removeListener('update:error', subscription)
  },
  onUpdateCancelled: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('update:cancelled', subscription)
    return () => ipcRenderer.removeListener('update:cancelled', subscription)
  },
  onShowChangelog: (callback: (version: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, version: string) => callback(version)
    ipcRenderer.on('update:show-changelog', subscription)
    return () => ipcRenderer.removeListener('update:show-changelog', subscription)
  },
  onLinuxDeb: (callback: (filePath: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('update:linux-deb', subscription)
    return () => ipcRenderer.removeListener('update:linux-deb', subscription)
  },
  onLinuxAppImage: (callback: (filePath: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('update:linux-appimage', subscription)
    return () => ipcRenderer.removeListener('update:linux-appimage', subscription)
  },

  // PO Token operations
  getPotTokenStatus: () => ipcRenderer.invoke('pot:getStatus'),
  restartPotTokenServer: () => ipcRenderer.invoke('pot:restart'),
  onPotTokenStatus: (callback: (status: {
    running: boolean
    port: number
    lastTokenTime: string | null
    tokenCount: number
    error: string | null
    uptime: number
  }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, status: Parameters<typeof callback>[0]) => callback(status)
    ipcRenderer.on('pot:status', subscription)
    return () => ipcRenderer.removeListener('pot:status', subscription)
  },

  // Subscriptions (Watch Folder)
  getSubscriptions: () => ipcRenderer.invoke('subscriptions:getAll'),
  addSubscription: (url: string) => ipcRenderer.invoke('subscriptions:add', url),
  removeSubscription: (id: string) => ipcRenderer.invoke('subscriptions:remove', id),
  checkSubscriptions: () => ipcRenderer.invoke('subscriptions:checkNew'),
  onNewVideos: (callback: (videos: Array<{
    id: string
    title: string
    thumbnail?: string
    duration?: number
    url: string
    subscriptionId: string
    subscriptionName: string
  }>) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, videos: Parameters<typeof callback>[0]) => callback(videos)
    ipcRenderer.on('subscriptions:newVideos', subscription)
    return () => ipcRenderer.removeListener('subscriptions:newVideos', subscription)
  },

  // Queue Export/Import
  exportQueue: () => ipcRenderer.invoke('queue:export'),
  importQueue: () => ipcRenderer.invoke('queue:import'),

  // Tray operations
  isTraySupported: () => ipcRenderer.invoke('tray:supported'),
  clearTaskbarBadge: () => ipcRenderer.invoke('tray:clearBadge'),

  // Analytics operations
  getAnalytics: () => ipcRenderer.invoke('analytics:get'),
  getAnalyticsRange: (range: 'all' | 'today' | 'week' | 'month') =>
    ipcRenderer.invoke('analytics:getRange', range),
  resetAnalytics: () => ipcRenderer.invoke('analytics:reset'),
})
