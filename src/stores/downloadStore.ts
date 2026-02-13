import { create } from 'zustand'
import type { ContentInfo, VideoFormat, DownloadProgress, HistoryItem, AppSettings, QueueStatus } from '../types'

interface DownloadState {
  // URL and detection
  url: string
  isDetecting: boolean
  detectionError: string | null
  contentInfo: ContentInfo | null

  // Formats
  formats: VideoFormat[]
  selectedFormat: string
  isLoadingFormats: boolean

  // Download
  isDownloading: boolean
  downloadProgress: DownloadProgress | null
  downloadError: string | null

  // History
  history: HistoryItem[]

  // Settings
  settings: AppSettings

  // Queue
  queueStatus: QueueStatus

  // Actions
  setUrl: (url: string) => void
  detectUrl: (url: string) => Promise<void>
  cancelDetection: () => Promise<void>
  fetchFormats: (url: string) => Promise<void>
  setSelectedFormat: (format: string) => void
  startDownload: () => Promise<void>
  cancelDownload: () => Promise<void>
  setDownloadProgress: (progress: DownloadProgress | null) => void
  setDownloadError: (error: string | null) => void
  setIsDownloading: (isDownloading: boolean) => void
  loadHistory: () => Promise<void>
  addToHistory: (item: HistoryItem) => Promise<void>
  removeFromHistory: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  loadSettings: () => Promise<void>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  reset: () => void

  // Queue actions
  loadQueue: () => Promise<void>
  addToQueue: (item: { url: string; title: string; thumbnail?: string; format: string; audioOnly: boolean }) => Promise<{ id: string; position: number }>
  removeFromQueue: (id: string) => Promise<void>
  cancelQueueItem: (id: string) => Promise<void>
  pauseQueue: () => Promise<void>
  resumeQueue: () => Promise<void>
  clearQueue: () => Promise<void>
  setQueueStatus: (status: QueueStatus) => void
}

const defaultSettings: AppSettings = {
  downloadPath: '',
  defaultQuality: 'Best Quality',  // Changed from '1080p' to allow per-video best quality
  defaultFormat: 'mp4',
  organizeByType: true,
  autoStartDownload: false,
  autoBestQuality: true,  // Changed to true - prefer best quality per video
  maxConcurrentDownloads: 1,
  delayBetweenDownloads: 2000,
  theme: 'dark',
  fontSize: 'medium',
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  // Initial state
  url: '',
  isDetecting: false,
  detectionError: null,
  contentInfo: null,
  formats: [],
  selectedFormat: '',
  isLoadingFormats: false,
  isDownloading: false,
  downloadProgress: null,
  downloadError: null,
  history: [],
  settings: defaultSettings,
  queueStatus: {
    items: [],
    isProcessing: false,
    isPaused: false,
    currentItemId: null,
  },

  // Actions
  setUrl: (url) => set({ url }),

  detectUrl: async (url) => {
    set({ url, isDetecting: true, detectionError: null, contentInfo: null, formats: [] })
    try {
      const contentInfo = await window.electronAPI.detectUrl(url)
      set({ contentInfo, isDetecting: false })

      // Auto-fetch formats after detection
      await get().fetchFormats(url)
    } catch (error) {
      set({
        isDetecting: false,
        detectionError: error instanceof Error ? error.message : 'Failed to detect URL',
      })
    }
  },

  cancelDetection: async () => {
    try {
      await window.electronAPI.cancelDetection()
      set({ isDetecting: false, detectionError: null })
    } catch (error) {
      console.error('Failed to cancel detection:', error)
    }
  },

  fetchFormats: async (url) => {
    set({ isLoadingFormats: true })
    try {
      const formats = await window.electronAPI.getFormats(url)
      const settings = get().settings

      // Default to "Best Quality" (first format) for per-video optimal quality
      // This ensures playlist downloads get the best quality for each individual video
      let defaultFormat = formats[0]  // First format is always "Best Quality"

      // If user has a specific preference, try to match it
      if (settings.defaultQuality && settings.defaultQuality !== 'Best Quality') {
        const preferred = formats.find(f =>
          f.quality === settings.defaultQuality ||
          f.quality.includes(settings.defaultQuality)
        )
        if (preferred) defaultFormat = preferred
      }

      set({
        formats,
        selectedFormat: defaultFormat?.formatId || '',
        isLoadingFormats: false,
      })
    } catch (error) {
      set({ isLoadingFormats: false })
      console.error('Failed to fetch formats:', error)
    }
  },

  setSelectedFormat: (format) => set({ selectedFormat: format }),

  startDownload: async () => {
    const { url, selectedFormat, contentInfo, formats } = get()
    if (!url || !selectedFormat) return

    const formatObj = formats.find(f => f.formatId === selectedFormat)

    try {
      // Add to queue instead of direct download
      // This ensures all downloads go through the unified queue system
      await window.electronAPI.addToQueue({
        url,
        title: contentInfo?.title || 'Unknown',
        thumbnail: contentInfo?.thumbnail,
        format: selectedFormat,
        audioOnly: formatObj?.isAudioOnly || false,
        source: 'app',
      })

      // Clear error state - queue status will show the download progress
      set({ downloadError: null, downloadProgress: null })
    } catch (error) {
      set({
        downloadError: error instanceof Error ? error.message : 'Failed to add to queue',
      })
    }
  },

  cancelDownload: async () => {
    try {
      await window.electronAPI.cancelDownload()
      set({ isDownloading: false, downloadProgress: null })
    } catch (error) {
      console.error('Failed to cancel download:', error)
    }
  },

  setDownloadProgress: (progress) => set({ downloadProgress: progress }),

  setDownloadError: (error) => set({ downloadError: error }),

  setIsDownloading: (isDownloading) => set({ isDownloading }),

  loadHistory: async () => {
    try {
      const history = await window.electronAPI.getHistory()
      set({ history })
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  },

  addToHistory: async (item) => {
    try {
      await window.electronAPI.addToHistory(item)
      set((state) => ({ history: [item, ...state.history] }))
    } catch (error) {
      console.error('Failed to add to history:', error)
    }
  },

  removeFromHistory: async (id) => {
    try {
      await window.electronAPI.removeFromHistory(id)
      set((state) => ({ history: state.history.filter(item => item.id !== id) }))
    } catch (error) {
      console.error('Failed to remove from history:', error)
    }
  },

  clearHistory: async () => {
    try {
      await window.electronAPI.clearHistory()
      set({ history: [] })
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  },

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings()
      set({ settings: { ...defaultSettings, ...settings } })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  updateSettings: async (newSettings) => {
    try {
      await window.electronAPI.saveSettings(newSettings)
      set((state) => ({ settings: { ...state.settings, ...newSettings } }))
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },

  reset: () => set({
    url: '',
    isDetecting: false,
    detectionError: null,
    contentInfo: null,
    formats: [],
    selectedFormat: '',
    isLoadingFormats: false,
    downloadProgress: null,
    downloadError: null,
  }),

  // Queue actions
  loadQueue: async () => {
    try {
      const queueStatus = await window.electronAPI.getQueue()
      set({ queueStatus })
    } catch (error) {
      console.error('Failed to load queue:', error)
    }
  },

  addToQueue: async (item) => {
    try {
      return await window.electronAPI.addToQueue({ ...item, source: 'app' })
    } catch (error) {
      console.error('Failed to add to queue:', error)
      throw error
    }
  },

  removeFromQueue: async (id) => {
    try {
      await window.electronAPI.removeFromQueue(id)
    } catch (error) {
      console.error('Failed to remove from queue:', error)
    }
  },

  cancelQueueItem: async (id) => {
    try {
      await window.electronAPI.cancelQueueItem(id)
    } catch (error) {
      console.error('Failed to cancel queue item:', error)
    }
  },

  pauseQueue: async () => {
    try {
      await window.electronAPI.pauseQueue()
    } catch (error) {
      console.error('Failed to pause queue:', error)
    }
  },

  resumeQueue: async () => {
    try {
      await window.electronAPI.resumeQueue()
    } catch (error) {
      console.error('Failed to resume queue:', error)
    }
  },

  clearQueue: async () => {
    try {
      await window.electronAPI.clearQueue()
    } catch (error) {
      console.error('Failed to clear queue:', error)
    }
  },

  setQueueStatus: (status) => set({ queueStatus: status }),
}))
