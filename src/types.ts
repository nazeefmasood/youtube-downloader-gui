export interface VideoFormat {
  formatId: string
  ext: string
  resolution: string
  quality: string
  filesize?: number
  fps?: number
  vcodec?: string
  acodec?: string
  isAudioOnly: boolean
}

export interface ContentInfo {
  type: 'video' | 'playlist' | 'channel'
  id: string
  title: string
  thumbnail?: string
  duration?: number
  uploaderName?: string
  uploaderUrl?: string
  description?: string
  videoCount?: number
  entries?: PlaylistEntry[]
}

export interface PlaylistEntry {
  id: string
  title: string
  duration?: number
  thumbnail?: string
  index: number
}

export interface DownloadProgress {
  percent: number
  speed?: string
  eta?: string
  downloaded?: string
  total?: string
  currentFile?: string
  currentIndex?: number
  totalFiles?: number
  status: 'downloading' | 'merging' | 'processing' | 'complete' | 'error' | 'waiting'
}

export interface DownloadOptions {
  url: string
  format: string
  quality?: string
  audioOnly?: boolean
  outputPath?: string
}

export interface HistoryItem {
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
}

export interface AppSettings {
  downloadPath: string
  defaultQuality: string
  defaultFormat: 'mp4' | 'mp3' | 'm4a' | 'webm'
  organizeByType: boolean
  autoStartDownload: boolean
  autoBestQuality: boolean
  maxConcurrentDownloads: number
  delayBetweenDownloads: number
  theme: 'light' | 'dark' | 'system'
}

export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>

  detectUrl: (url: string) => Promise<ContentInfo>
  cancelDetection: () => Promise<void>
  getFormats: (url: string) => Promise<VideoFormat[]>
  startDownload: (options: DownloadOptions) => Promise<void>
  cancelDownload: () => Promise<void>
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
  onDownloadComplete: (callback: (result: { success: boolean; filePath?: string; error?: string }) => void) => () => void
  onDownloadError: (callback: (error: string) => void) => () => void
  onVideoComplete: (callback: (videoInfo: {
    index: number
    totalFiles: number
    title: string
    filePath: string
    alreadyDownloaded?: boolean
  }) => void) => () => void
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>
  getHistory: () => Promise<HistoryItem[]>
  addToHistory: (item: HistoryItem) => Promise<void>
  clearHistory: () => Promise<void>
  removeFromHistory: (id: string) => Promise<void>
  openFile: (filePath: string) => Promise<void>
  openFolder: (filePath: string) => Promise<void>
  selectFolder: () => Promise<string | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
