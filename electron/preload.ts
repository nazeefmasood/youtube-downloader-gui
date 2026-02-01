import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // URL detection
  detectUrl: (url: string) => ipcRenderer.invoke('url:detect', url),
  cancelDetection: () => ipcRenderer.invoke('url:cancelDetect'),

  // Formats
  getFormats: (url: string) => ipcRenderer.invoke('formats:get', url),

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

  // File operations
  openFile: (filePath: string) => ipcRenderer.invoke('file:open', filePath),
  openFolder: (filePath: string) => ipcRenderer.invoke('file:showInFolder', filePath),
  selectFolder: () => ipcRenderer.invoke('folder:select'),
})
