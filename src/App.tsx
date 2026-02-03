import { useState, useEffect, useCallback } from 'react'
import { useDownloadStore } from './stores/downloadStore'
import type { DownloadProgress, QueueItem, LogEntry } from './types'

type View = 'downloads' | 'history' | 'settings'
type Theme = 'dark' | 'light'

function App() {
  const [view, setView] = useState<View>('downloads')
  const [urlInput, setUrlInput] = useState('')
  const [completedVideos, setCompletedVideos] = useState<Set<number>>(new Set())
  const [showSuccess, setShowSuccess] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [binaryMissing, setBinaryMissing] = useState(false)
  const [binaryDownloading, setBinaryDownloading] = useState(false)
  const [binaryDownloadProgress, setBinaryDownloadProgress] = useState(0)
  const [binaryError, setBinaryError] = useState<string | null>(null)
  const {
    contentInfo,
    isDetecting,
    formats,
    selectedFormat,
    setSelectedFormat,
    isDownloading,
    isLoadingFormats,
    downloadProgress,
    downloadError,
    history,
    settings,
    detectUrl,
    cancelDetection,
    startDownload,
    cancelDownload,
    setDownloadProgress,
    setIsDownloading,
    setDownloadError,
    addToHistory,
    loadHistory,
    removeFromHistory,
    clearHistory,
    loadSettings,
    updateSettings,
    reset,
    loadQueue,
    queueStatus,
    setQueueStatus,
  } = useDownloadStore()

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('vidgrab-theme') as Theme
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  // Apply font size setting
  useEffect(() => {
    if (settings.fontSize) {
      document.documentElement.setAttribute('data-font-size', settings.fontSize)
    }
  }, [settings.fontSize])

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('vidgrab-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [theme])

  // Initialize settings, history, and queue
  useEffect(() => {
    loadSettings()
    loadHistory()
    loadQueue()
  }, [loadSettings, loadHistory, loadQueue])

  // Check for binary on startup
  useEffect(() => {
    const checkBinary = async () => {
      const installed = await window.electronAPI.checkBinary()
      if (!installed) {
        setBinaryMissing(true)
      }
    }
    checkBinary()

    // Set up binary download listeners
    const unsubStart = window.electronAPI.onBinaryDownloadStart(() => {
      setBinaryDownloading(true)
      setBinaryDownloadProgress(0)
      setBinaryError(null)
    })

    const unsubProgress = window.electronAPI.onBinaryDownloadProgress((data) => {
      setBinaryDownloadProgress(data.percent)
    })

    const unsubComplete = window.electronAPI.onBinaryDownloadComplete(() => {
      setBinaryDownloading(false)
      setBinaryMissing(false)
      setBinaryDownloadProgress(100)
    })

    const unsubError = window.electronAPI.onBinaryDownloadError((data) => {
      setBinaryDownloading(false)
      setBinaryError(data.error)
    })

    return () => {
      unsubStart()
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [])

  // Subscribe to queue updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.onQueueUpdate((status) => {
      setQueueStatus(status)
    })
    return () => unsubscribe()
  }, [setQueueStatus])

  // Subscribe to history updates (for queue items)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onHistoryAdded(() => {
      // Reload history to include the new item
      loadHistory()
    })
    return () => unsubscribe()
  }, [loadHistory])

  // Set up download event listeners
  useEffect(() => {
    const unsubProgress = window.electronAPI.onDownloadProgress((progress: DownloadProgress) => {
      setDownloadProgress(progress)
    })

    const unsubComplete = window.electronAPI.onDownloadComplete((result) => {
      setIsDownloading(false)
      if (result.success) {
        setDownloadProgress(null)
        setShowSuccess(true)
        const currentState = useDownloadStore.getState()
        if (currentState.contentInfo && currentState.contentInfo.type === 'video') {
          addToHistory({
            id: Date.now().toString(),
            title: currentState.contentInfo.title,
            url: currentState.url,
            thumbnail: currentState.contentInfo.thumbnail,
            downloadDate: new Date().toISOString(),
            filePath: result.filePath || '',
            duration: currentState.contentInfo.duration,
            status: 'completed',
            type: currentState.contentInfo.type,
            videoCount: currentState.contentInfo.videoCount,
          })
        }
      } else {
        setDownloadError(result.error || 'Download failed')
      }
    })

    const unsubVideoComplete = window.electronAPI.onVideoComplete((videoInfo) => {
      setCompletedVideos(prev => new Set([...prev, videoInfo.index]))
      const currentState = useDownloadStore.getState()
      addToHistory({
        id: `${Date.now()}-${videoInfo.index}`,
        title: videoInfo.title,
        url: currentState.url,
        thumbnail: currentState.contentInfo?.thumbnail,
        downloadDate: new Date().toISOString(),
        filePath: videoInfo.filePath,
        status: 'completed',
        type: 'video',
      })
    })

    const unsubError = window.electronAPI.onDownloadError((error: string) => {
      setIsDownloading(false)
      setDownloadError(error)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubVideoComplete()
      unsubError()
    }
  }, [setDownloadProgress, setIsDownloading, setDownloadError, addToHistory])

  // Auto-select best quality when formats load
  useEffect(() => {
    if (formats.length > 0 && settings.autoBestQuality) {
      const bestVideo = formats.find(f => !f.isAudioOnly)
      if (bestVideo) {
        setSelectedFormat(bestVideo.formatId)
      }
    }
  }, [formats, settings.autoBestQuality, setSelectedFormat])

  const handleAnalyze = useCallback(() => {
    if (urlInput.trim()) {
      setCompletedVideos(new Set())
      setShowSuccess(false)
      detectUrl(urlInput.trim())
    }
  }, [urlInput, detectUrl])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze()
    }
  }, [handleAnalyze])

  const handleStartDownload = useCallback(() => {
    setCompletedVideos(new Set())
    setShowSuccess(false)
    startDownload()
  }, [startDownload])

  const handleReset = useCallback(() => {
    setUrlInput('')
    setCompletedVideos(new Set())
    setShowSuccess(false)
    reset()
  }, [reset])

  const handleOpenFolder = useCallback(() => {
    window.electronAPI.openFolder(settings.downloadPath || '')
  }, [settings.downloadPath])

  // Queue actions
  const handleCancelQueueItem = useCallback((id: string) => {
    window.electronAPI.cancelQueueItem(id)
  }, [])

  const handleRemoveQueueItem = useCallback((id: string) => {
    window.electronAPI.removeFromQueue(id)
  }, [])

  const handlePauseResumeQueue = useCallback(() => {
    if (queueStatus.isPaused) {
      window.electronAPI.resumeQueue()
    } else {
      window.electronAPI.pauseQueue()
    }
  }, [queueStatus.isPaused])

  const handleClearQueue = useCallback(() => {
    window.electronAPI.clearQueue()
  }, [])

  // Load error logs when settings view is active
  const loadErrorLogs = useCallback(async () => {
    try {
      const logs = await window.electronAPI.getErrorLogs()
      setErrorLogs(logs)
    } catch (err) {
      console.error('Failed to load error logs:', err)
    }
  }, [])

  const handleCopyLogs = useCallback(() => {
    const logText = errorLogs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.details ? '\n  ' + log.details : ''}`
    ).join('\n')
    navigator.clipboard.writeText(logText)
  }, [errorLogs])

  const handleOpenLogFile = useCallback(() => {
    window.electronAPI.openLogFile()
  }, [])

  // Load logs when settings view is opened
  useEffect(() => {
    if (view === 'settings') {
      loadErrorLogs()
    }
  }, [view, loadErrorLogs])

  // Handle confetti easter egg
  const handleCreditsClick = useCallback(() => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3000)
  }, [])

  // Handle binary download
  const handleDownloadBinary = useCallback(async () => {
    setBinaryError(null)
    await window.electronAPI.downloadBinary()
  }, [])

  // Handle download all for playlists/channels
  const handleDownloadAll = useCallback(async () => {
    if (!contentInfo || !contentInfo.entries) return

    // Use selected format or default to best quality
    const formatToUse = selectedFormat || 'bestvideo+bestaudio/best'
    const formatObj = formats.find(f => f.formatId === formatToUse)

    // Add each video in playlist/channel as separate queue item
    for (const entry of contentInfo.entries) {
      await window.electronAPI.addToQueue({
        url: `https://www.youtube.com/watch?v=${entry.id}`,
        title: entry.title,
        thumbnail: entry.thumbnail,
        format: formatToUse,
        audioOnly: formatObj?.isAudioOnly || false,
        source: 'app',
      })
    }
  }, [contentInfo, selectedFormat, formats])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.ctrlKey && e.key === 'v' && !urlInput.trim() && !isDetecting && !isDownloading) {
        return
      }

      if (e.ctrlKey && e.key === 'Enter' && selectedFormat && !isDownloading && contentInfo) {
        e.preventDefault()
        handleStartDownload()
        return
      }

      if (e.key === 'Escape') {
        if (isDetecting) {
          e.preventDefault()
          cancelDetection()
        } else if (isDownloading) {
          e.preventDefault()
          cancelDownload()
        } else if (showSuccess) {
          e.preventDefault()
          handleReset()
        }
        return
      }

      if (isInputField) return

      if (e.ctrlKey && e.key === 'o' && showSuccess) {
        e.preventDefault()
        handleOpenFolder()
        return
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleReset()
        return
      }

      if (e.ctrlKey && e.key === '1') {
        e.preventDefault()
        setView('downloads')
        return
      }

      if (e.ctrlKey && e.key === '2') {
        e.preventDefault()
        setView('history')
        return
      }

      if (e.ctrlKey && e.key === '3') {
        e.preventDefault()
        setView('settings')
        return
      }

      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        toggleTheme()
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    urlInput,
    selectedFormat,
    isDownloading,
    isDetecting,
    showSuccess,
    contentInfo,
    handleStartDownload,
    handleReset,
    handleOpenFolder,
    cancelDetection,
    cancelDownload,
    toggleTheme,
  ])

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getVideoStatus = (index: number) => {
    if (completedVideos.has(index)) return 'completed'
    if (downloadProgress?.currentIndex === index) return 'downloading'
    if (downloadProgress && index < (downloadProgress.currentIndex || 0)) return 'completed'
    return 'waiting'
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getQueueStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        )
      case 'downloading':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        )
      case 'completed':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )
      case 'failed':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        )
      case 'cancelled':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        )
      case 'paused':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="10" y1="8" x2="10" y2="16"/>
            <line x1="14" y1="8" x2="14" y2="16"/>
          </svg>
        )
    }
  }

  const getQueueStatusLabel = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending': return 'QUEUED'
      case 'downloading': return 'DOWNLOADING'
      case 'completed': return 'COMPLETE'
      case 'failed': return 'FAILED'
      case 'cancelled': return 'CANCELLED'
      case 'paused': return 'PAUSED'
    }
  }

  // Queue counts and progress
  const activeQueueItems = queueStatus.items.filter(i => i.status === 'pending' || i.status === 'downloading' || i.status === 'paused')
  const completedQueueItems = queueStatus.items.filter(i => i.status === 'completed')
  const hasQueueItems = queueStatus.items.length > 0

  // Extract current queue item's progress
  const currentQueueItem = queueStatus.items.find(i => i.id === queueStatus.currentItemId)
  const queueProgress = currentQueueItem?.progress

  // Effective progress is either direct download or queue download
  const effectiveProgress = downloadProgress || queueProgress
  const isActiveDownload = isDownloading || queueStatus.isProcessing

  // Check if queue just finished (has completed items but no active ones)
  const queueJustFinished = completedQueueItems.length > 0 && activeQueueItems.length === 0 && !queueStatus.isProcessing

  return (
    <>
      {/* Binary Download Modal */}
      {binaryMissing && (
        <div className="binary-modal-overlay">
          <div className="binary-modal">
            <div className="binary-modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div className="binary-modal-title">REQUIRED COMPONENT MISSING</div>
            <div className="binary-modal-text">
              VidGrab requires yt-dlp to download videos. Click below to download it automatically.
            </div>
            {binaryError && (
              <div className="binary-modal-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {binaryError}
              </div>
            )}
            {binaryDownloading ? (
              <div className="binary-modal-progress">
                <div className="binary-progress-bar">
                  <div className="binary-progress-fill" style={{ width: `${binaryDownloadProgress}%` }} />
                </div>
                <div className="binary-progress-text">Downloading... {binaryDownloadProgress}%</div>
              </div>
            ) : (
              <button className="binary-modal-btn" onClick={handleDownloadBinary}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                DOWNLOAD YT-DLP
              </button>
            )}
          </div>
        </div>
      )}

      {/* Title Bar */}
      <div className="title-bar">
        <div className="title-bar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          <span>VIDGRAB</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>v1.0.0</span>
        </div>
        <div className="title-bar-controls">
          <button className="title-bar-btn" onClick={() => window.electronAPI.minimizeWindow()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><rect y="4" width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="title-bar-btn" onClick={() => window.electronAPI.maximizeWindow()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor"/></svg>
          </button>
          <button className="title-bar-btn close" onClick={() => window.electronAPI.closeWindow()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className={`toolbar-btn ${view === 'downloads' ? 'active' : ''}`} onClick={() => setView('downloads')} title="Downloads (Ctrl+1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Downloads</span>
          {activeQueueItems.length > 0 && (
            <span className="queue-count">{activeQueueItems.length}</span>
          )}
        </button>

        <button className={`toolbar-btn ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')} title="History (Ctrl+2)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>History</span>
        </button>

        <button className={`toolbar-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')} title="Settings (Ctrl+3)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Settings</span>
        </button>

        <div className="toolbar-spacer" />

        {/* Theme Toggle */}
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode (Ctrl+L)`}>
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <button className="toolbar-btn" onClick={handleReset} disabled={isDownloading} title="New Download (Ctrl+N)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Clear</span>
        </button>
      </div>

      {/* URL Input Bar */}
      {view === 'downloads' && (
        <div className="url-bar">
          <div className="url-bar-label">INPUT TARGET URL</div>
          <div className="url-input-wrapper">
            <input
              type="text"
              className="url-input"
              placeholder="https://youtube.com/watch?v=... or playlist/channel URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDetecting || isDownloading}
            />
            {isDetecting ? (
              <button className="url-btn cancel" onClick={() => cancelDetection()}>
                ABORT
              </button>
            ) : (
              <button
                className="url-btn"
                onClick={handleAnalyze}
                disabled={isDownloading || !urlInput.trim()}
              >
                ANALYZE
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`main-content ${isActiveDownload ? 'downloading' : ''}`}>
        {view === 'downloads' && (
          <>
            {/* Content Panel (Left) */}
            <div className="content-panel">
              {/* Empty State - only show when no queue items and no content and not detecting */}
              {!contentInfo && !isDetecting && !hasQueueItems && (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <div className="empty-state-title">AWAITING INPUT<span className="blink">_</span></div>
                  <div className="empty-state-text">// Paste a YouTube URL above to begin analysis</div>
                  <div className="empty-state-hint">
                    <div className="hint-item">
                      <span className="hint-icon">1</span>
                      <span>Paste a YouTube URL above, or</span>
                    </div>
                    <div className="hint-item">
                      <span className="hint-icon">2</span>
                      <span>Use the browser extension to add to queue</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyzing State - Show in left panel */}
              {isDetecting && !contentInfo && (
                <div className="content-loading">
                  <div className="spinner" />
                  <div className="loading-title">ANALYZING TARGET<span className="blink">_</span></div>
                  <div className="loading-text">// Fetching metadata from remote source</div>
                </div>
              )}


              {/* Content Loaded */}
              {contentInfo && !isDetecting && (
                <>
                  {/* Content Info Header */}
                  <div className="content-info">
                    <div className="content-header">
                      <div className="content-thumbnail">
                        {contentInfo.thumbnail ? (
                          <img src={contentInfo.thumbnail} alt={contentInfo.title} />
                        ) : (
                          <div className="thumbnail-placeholder">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="content-details">
                        <span className={`content-type ${contentInfo.type}`}>{contentInfo.type}</span>
                        <div className="content-title">{contentInfo.title}</div>
                        <div className="content-meta">
                          {contentInfo.uploaderName && (
                            <span className="content-meta-item">{contentInfo.uploaderName}</span>
                          )}
                          {contentInfo.videoCount && contentInfo.videoCount > 1 && (
                            <span className="content-meta-item">{contentInfo.videoCount} VIDEOS</span>
                          )}
                          {contentInfo.duration && (
                            <span className="content-meta-item">{formatDuration(contentInfo.duration)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Display */}
                  {downloadError && (
                    <div className="error-panel">
                      <div className="error-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--error)' }}>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        <span className="error-title">ERROR</span>
                      </div>
                      <div className="error-message">{downloadError}</div>
                    </div>
                  )}

                  {/* Video List (for playlists/channels) */}
                  {contentInfo.entries && contentInfo.entries.length > 0 && !showSuccess && (
                    <>
                      <div className="video-list-header">
                        <span className="video-list-title">VIDEO QUEUE</span>
                        <span className="video-list-count">{contentInfo.entries.length} items</span>
                      </div>
                      <div className="video-list">
                        {contentInfo.entries.map((video) => {
                          const status = getVideoStatus(video.index)
                          return (
                            <div
                              key={video.id}
                              className={`video-list-item ${status === 'downloading' ? 'active' : ''} ${status === 'completed' ? 'completed' : ''}`}
                            >
                              <div className="video-list-index">
                                {String(video.index).padStart(2, '0')}
                              </div>
                              <div className="video-list-thumb">
                                {video.thumbnail ? (
                                  <img src={video.thumbnail} alt={video.title} />
                                ) : (
                                  <div className="thumbnail-placeholder">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="video-list-info">
                                <div className="video-list-name">{video.title}</div>
                                <div className="video-list-duration">{formatDuration(video.duration)}</div>
                              </div>
                              {isDownloading && (
                                <span className={`video-list-status ${status}`}>
                                  {status === 'downloading' && '● ACTIVE'}
                                  {status === 'completed' && '✓ DONE'}
                                  {status === 'waiting' && '○ QUEUE'}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Unified Queue Section - Always visible when there are items */}
              {hasQueueItems && (
                <div className="queue-section">
                  <div className="queue-header">
                    <div className="queue-stats">
                      <span className="queue-title">DOWNLOAD QUEUE</span>
                      <div className="queue-badges">
                        {queueStatus.items.filter(i => i.status === 'downloading').length > 0 && (
                          <span className="queue-badge downloading">
                            {queueStatus.items.filter(i => i.status === 'downloading').length} active
                          </span>
                        )}
                        {queueStatus.items.filter(i => i.status === 'pending' || i.status === 'paused').length > 0 && (
                          <span className="queue-badge pending">
                            {queueStatus.items.filter(i => i.status === 'pending' || i.status === 'paused').length} pending
                          </span>
                        )}
                        {completedQueueItems.length > 0 && (
                          <span className="queue-badge completed">
                            {completedQueueItems.length} done
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="queue-controls">
                      {activeQueueItems.length > 0 && (
                        <button
                          className={`btn-queue-control ${queueStatus.isPaused ? 'paused' : ''}`}
                          onClick={handlePauseResumeQueue}
                        >
                          {queueStatus.isPaused ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              RESUME
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16"/>
                                <rect x="14" y="4" width="4" height="16"/>
                              </svg>
                              PAUSE
                            </>
                          )}
                        </button>
                      )}
                      <button className="btn-clear" onClick={handleClearQueue}>CLEAR</button>
                    </div>
                  </div>

                  <div className="queue-list">
                    {queueStatus.items.map((item) => (
                      <div
                        key={item.id}
                        className={`queue-item ${item.status === 'downloading' ? 'active' : ''} ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'failed' ? 'failed' : ''} ${item.status === 'paused' ? 'paused' : ''}`}
                      >
                        <div className="queue-item-thumb">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} />
                          ) : (
                            <div className="thumbnail-placeholder">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="queue-item-info">
                          <div className="queue-item-title">{item.title}</div>
                          <div className="queue-item-meta">
                            <span className="queue-item-source">{item.source === 'extension' ? 'EXT' : 'APP'}</span>
                            <span className="queue-item-format">{item.audioOnly ? 'AUDIO' : 'VIDEO'}</span>
                            <span className="queue-item-time">{formatTime(item.addedAt)}</span>
                          </div>
                          {item.status === 'failed' && item.error && (
                            <div className="queue-item-error">{item.error}</div>
                          )}
                        </div>

                        <div className="queue-item-status">
                          {getQueueStatusIcon(item.status)}
                          <span className={`status-label ${item.status}`}>{getQueueStatusLabel(item.status)}</span>
                        </div>

                        <div className="queue-item-actions">
                          {(item.status === 'pending' || item.status === 'downloading' || item.status === 'paused') && (
                            <button
                              className="queue-btn-cancel"
                              onClick={() => handleCancelQueueItem(item.id)}
                              title="Cancel"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12"/>
                              </svg>
                            </button>
                          )}
                          {(item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') && (
                            <button
                              className="queue-btn-remove"
                              onClick={() => handleRemoveQueueItem(item.id)}
                              title="Remove"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Side Panel (Right) - Quality Selection - Only show when content is loaded */}
            {contentInfo && !showSuccess && (
              <div className="side-panel">
                {(
                  <>
                    <div className="side-panel-content">
                      <div className="panel-section">
                        <div className="panel-header">
                          <span className="panel-title">VIDEO QUALITY</span>
                        </div>
                        <div className="panel-content">
                          {isLoadingFormats ? (
                            <div className="loading-formats">
                              <div className="spinner-small" />
                              <span>LOADING FORMATS...</span>
                            </div>
                          ) : (
                            <div className="quality-list">
                              {formats.filter(f => !f.isAudioOnly).map((format) => (
                                <button
                                  key={format.formatId}
                                  className={`quality-option ${selectedFormat === format.formatId ? 'selected' : ''}`}
                                  onClick={() => setSelectedFormat(format.formatId)}
                                  disabled={isDownloading}
                                >
                                  <div className="quality-info">
                                    <span className="quality-name">{format.quality}</span>
                                    <span className="quality-badge">{format.ext.toUpperCase()}</span>
                                  </div>
                                  {format.filesize && (
                                    <span className="quality-size">~{(format.filesize / 1024 / 1024).toFixed(0)} MB</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="panel-section">
                        <div className="panel-header">
                          <span className="panel-title">AUDIO ONLY</span>
                        </div>
                        <div className="panel-content">
                          <div className="quality-list">
                            {formats.filter(f => f.isAudioOnly).map((format) => (
                              <button
                                key={format.formatId}
                                className={`quality-option ${selectedFormat === format.formatId ? 'selected' : ''}`}
                                onClick={() => setSelectedFormat(format.formatId)}
                                disabled={isDownloading}
                              >
                                <div className="quality-info">
                                  <span className="quality-name">{format.quality}</span>
                                  <span className="quality-badge">{format.ext.toUpperCase()}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Download Button */}
                    <div className="panel-actions">
                      {isDownloading ? (
                        <button className="btn-download btn-stop" onClick={cancelDownload} title="Escape">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12"/>
                          </svg>
                          ABORT DOWNLOAD
                          <span className="shortcut-hint">Esc</span>
                        </button>
                      ) : (contentInfo.type === 'playlist' || contentInfo.type === 'channel') ? (
                        <button
                          className="btn-download"
                          onClick={handleDownloadAll}
                          disabled={isLoadingFormats || isActiveDownload}
                          title="Ctrl+Enter"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          {contentInfo.type === 'playlist'
                            ? `DOWNLOAD ALL (${contentInfo.videoCount || contentInfo.entries?.length || 0})`
                            : `DOWNLOAD EVERYTHING (${contentInfo.videoCount || contentInfo.entries?.length || 0})`
                          }
                          <span className="shortcut-hint">Ctrl+Enter</span>
                        </button>
                      ) : (
                        <button
                          className="btn-download"
                          onClick={handleStartDownload}
                          disabled={!selectedFormat || isLoadingFormats}
                          title="Ctrl+Enter"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          EXECUTE DOWNLOAD
                          <span className="shortcut-hint">Ctrl+Enter</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="history-panel">
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div className="empty-state-title">NO RECORDS<span className="blink">_</span></div>
                <div className="empty-state-text">// Download history will appear here</div>
              </div>
            ) : (
              <>
                <div className="history-header">
                  <span className="history-title">DOWNLOAD LOG</span>
                  <button className="btn-clear" onClick={clearHistory}>CLEAR ALL</button>
                </div>
                <div className="history-list">
                  {history.map((item) => (
                    <div key={item.id} className="history-item">
                      <div className="history-thumbnail">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} />
                        ) : (
                          <div className="thumbnail-placeholder">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="history-info">
                        <div className="history-title-text">{item.title}</div>
                        <div className="history-meta">
                          <span>{new Date(item.downloadDate).toLocaleDateString()}</span>
                          <span className={`history-status ${item.status}`}>{item.status}</span>
                        </div>
                      </div>
                      <div className="history-actions">
                        <button onClick={() => window.electronAPI.openFolder(item.filePath)} title="Open folder">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                        <button onClick={() => removeFromHistory(item.id)} title="Remove">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Settings View */}
        {view === 'settings' && (
          <div className="settings-panel">
            <div className="settings-group">
              <div className="settings-group-title">DOWNLOAD CONFIGURATION</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download Location</div>
                  <div className="setting-value">{settings.downloadPath || '~/Downloads/Youtube Downloads'}</div>
                </div>
                <button className="btn-secondary" onClick={async () => {
                  const folder = await window.electronAPI.selectFolder()
                  if (folder) updateSettings({ downloadPath: folder })
                }}>
                  BROWSE
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Auto Best Quality</div>
                  <div className="setting-description">Automatically select highest available quality</div>
                </div>
                <button
                  className={`toggle ${settings.autoBestQuality ? 'on' : ''}`}
                  onClick={() => updateSettings({ autoBestQuality: !settings.autoBestQuality })}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Organize by Type</div>
                  <div className="setting-description">Create folders for playlists and channels</div>
                </div>
                <button
                  className={`toggle ${settings.organizeByType ? 'on' : ''}`}
                  onClick={() => updateSettings({ organizeByType: !settings.organizeByType })}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download Delay</div>
                  <div className="setting-description">Delay between playlist videos</div>
                </div>
                <select
                  className="setting-select"
                  value={settings.delayBetweenDownloads}
                  onChange={(e) => updateSettings({ delayBetweenDownloads: parseInt(e.target.value) })}
                >
                  <option value="1000">1 second</option>
                  <option value="2000">2 seconds</option>
                  <option value="3000">3 seconds</option>
                  <option value="5000">5 seconds</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">APPEARANCE</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Theme</div>
                  <div className="setting-description">Switch between dark and light mode</div>
                </div>
                <button
                  className={`toggle ${theme === 'light' ? 'on' : ''}`}
                  onClick={toggleTheme}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Font Size</div>
                  <div className="setting-description">Adjust the interface text size</div>
                </div>
                <select
                  className="setting-select"
                  value={settings.fontSize || 'medium'}
                  onChange={(e) => updateSettings({ fontSize: e.target.value as 'small' | 'medium' | 'large' | 'x-large' })}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium (Default)</option>
                  <option value="large">Large</option>
                  <option value="x-large">Extra Large</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">DEBUG LOGS</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Error History</div>
                  <div className="setting-description">{errorLogs.length} recent errors/warnings</div>
                </div>
                <div className="log-actions">
                  <button className="btn-secondary" onClick={loadErrorLogs}>REFRESH</button>
                  <button className="btn-secondary" onClick={handleCopyLogs} disabled={errorLogs.length === 0}>COPY</button>
                  <button className="btn-secondary" onClick={handleOpenLogFile}>OPEN FILE</button>
                </div>
              </div>
              {errorLogs.length > 0 && (
                <div className="error-log-list">
                  {errorLogs.slice(0, 20).map((log, index) => (
                    <div key={index} className={`error-log-item ${log.level}`}>
                      <div className="error-log-header">
                        <span className={`error-log-level ${log.level}`}>{log.level.toUpperCase()}</span>
                        <span className="error-log-time">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="error-log-message">{log.message}</div>
                      {log.details && <div className="error-log-details">{log.details}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="settings-group">
              <div className="settings-group-title">ABOUT</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">VidGrab</div>
                  <div className="setting-description">Version 1.0.0 // Powered by yt-dlp</div>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Developer</div>
                  <div className="setting-description">Developed by Nazeef Masood</div>
                </div>
              </div>
              <div className="setting-item clickable" onClick={handleCreditsClick}>
                <div className="setting-info">
                  <div className="setting-label">Special Thanks</div>
                  <div className="setting-description credits-name">Ali Awan - First tester & supporter</div>
                </div>
                <span className="credits-hint">Click me!</span>
              </div>
              <div className="setting-item clickable" onClick={handleCreditsClick}>
                <div className="setting-info">
                  <div className="setting-label">Bug Hunter</div>
                  <div className="setting-description credits-name">Abdullah Awan - First to identify issues</div>
                </div>
                <span className="credits-hint">Click me!</span>
              </div>
            </div>
          </div>
        )}

        {/* Confetti overlay */}
        {showConfetti && (
          <div className="confetti-overlay">
            {[...Array(80)].map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  backgroundColor: ['#00ff88', '#ffaa00', '#ff6b6b', '#00d4ff', '#ff00ff', '#ffd700', '#7b68ee'][Math.floor(Math.random() * 7)],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
            <div className="confetti-text">Thank You!</div>
          </div>
        )}
      </div>

      {/* Success Overlay - Full Screen */}
      {showSuccess && !isDownloading && (
        <div className="success-overlay">
          <div className="success-content">
            <div className="success-confetti" />
            <div className="success-confetti" />
            <div className="success-confetti" />
            <div className="success-confetti" />
            <div className="success-confetti" />
            <div className="success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="success-title">DOWNLOAD COMPLETE</div>
            <div className="success-subtitle">{contentInfo?.title}</div>
            <div className="success-message">
              // All files have been successfully downloaded to your system
            </div>
            <div className="success-actions">
              <button className="btn-success" onClick={handleOpenFolder} title="Ctrl+O">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                OPEN FOLDER
                <span className="shortcut-hint">Ctrl+O</span>
              </button>
              <button className="btn-outline" onClick={handleReset} title="Ctrl+N">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                NEW DOWNLOAD
                <span className="shortcut-hint">Ctrl+N</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Progress Bar - Fixed above status bar */}
      {isActiveDownload && view === 'downloads' && (
        <div className={`progress-bar-fixed ${contentInfo && !showSuccess ? 'with-sidebar' : ''}`}>
          <div className="progress-bar-inner">
            <div className="progress-info">
              <span className="progress-label">
                {effectiveProgress?.status === 'downloading' && 'DOWNLOADING'}
                {effectiveProgress?.status === 'merging' && 'MERGING'}
                {effectiveProgress?.status === 'processing' && 'PROCESSING'}
                {effectiveProgress?.status === 'waiting' && 'WAITING'}
                {effectiveProgress?.status === 'complete' && 'FINALIZING'}
                {!effectiveProgress && 'INITIALIZING'}
              </span>
              <span className="progress-percent">{effectiveProgress?.percent?.toFixed(0) || 0}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-bg" />
              <div className={`progress-fill ${!effectiveProgress ? 'progress-fill-init' : ''}`} style={{ width: `${effectiveProgress?.percent || 0}%` }} />
            </div>
            <div className="progress-stats-compact">
              <span><strong>{effectiveProgress?.speed || '--'}</strong> Speed</span>
              <span><strong>{effectiveProgress?.eta || '--'}</strong> ETA</span>
              <span><strong>{effectiveProgress?.total || '--'}</strong> Size</span>
              {effectiveProgress?.totalFiles && effectiveProgress.totalFiles > 1 && (
                <span>Video <strong>{effectiveProgress.currentIndex || 1}/{effectiveProgress.totalFiles}</strong></span>
              )}
              {currentQueueItem && (
                <span className="progress-title-compact">{currentQueueItem.title}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-left">
          <div className={`status-indicator ${isActiveDownload ? 'downloading' : ''} ${downloadError ? 'error' : ''} ${queueStatus.isPaused ? 'paused' : ''} ${queueJustFinished ? 'complete' : ''}`} />
          <span>
            {isActiveDownload && effectiveProgress?.status === 'downloading' && `DOWNLOADING ${effectiveProgress.percent?.toFixed(0)}%`}
            {isActiveDownload && effectiveProgress?.status === 'merging' && 'MERGING FILES'}
            {isActiveDownload && effectiveProgress?.status === 'waiting' && 'WAITING FOR NEXT'}
            {isActiveDownload && !effectiveProgress && 'INITIALIZING'}
            {!isActiveDownload && queueStatus.isPaused && activeQueueItems.length > 0 && 'PAUSED'}
            {!isActiveDownload && !queueStatus.isPaused && downloadError && 'ERROR'}
            {!isActiveDownload && !queueStatus.isPaused && (showSuccess || queueJustFinished) && `COMPLETE (${completedQueueItems.length} DOWNLOADED)`}
            {!isActiveDownload && !queueStatus.isPaused && !downloadError && !showSuccess && !queueJustFinished && activeQueueItems.length > 0 && `${activeQueueItems.length} IN QUEUE`}
            {!isActiveDownload && !queueStatus.isPaused && !downloadError && !showSuccess && !queueJustFinished && activeQueueItems.length === 0 && 'READY'}
          </span>
        </div>
        <span>{history.length} DOWNLOADS LOGGED // {theme.toUpperCase()} MODE</span>
      </div>
    </>
  )
}

export default App
