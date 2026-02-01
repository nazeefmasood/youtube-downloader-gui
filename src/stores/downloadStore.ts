import { create } from 'zustand'
import type { ContentInfo, VideoFormat, DownloadProgress, HistoryItem, AppSettings } from '../types'

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
}

const defaultSettings: AppSettings = {
  downloadPath: '',
  defaultQuality: '1080p',
  defaultFormat: 'mp4',
  organizeByType: true,
  autoStartDownload: false,
  autoBestQuality: false,
  maxConcurrentDownloads: 1,
  delayBetweenDownloads: 2000,
  theme: 'dark',
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

      // Find default format based on settings
      let defaultFormat = formats.find(f =>
        f.quality === settings.defaultQuality && f.ext === settings.defaultFormat
      )

      if (!defaultFormat && formats.length > 0) {
        // Fall back to first matching quality or first format
        defaultFormat = formats.find(f => f.quality === settings.defaultQuality) || formats[0]
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
    const { url, selectedFormat, settings } = get()
    if (!url || !selectedFormat) return

    set({ isDownloading: true, downloadError: null, downloadProgress: null })

    try {
      const selectedFormatObj = get().formats.find(f => f.formatId === selectedFormat)

      await window.electronAPI.startDownload({
        url,
        format: selectedFormat,
        audioOnly: selectedFormatObj?.isAudioOnly,
        outputPath: settings.downloadPath,
      })

      // Add to history on success (handled via IPC callback)
    } catch (error) {
      set({
        isDownloading: false,
        downloadError: error instanceof Error ? error.message : 'Download failed',
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
}))
