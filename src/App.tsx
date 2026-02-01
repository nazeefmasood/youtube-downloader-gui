import { useState, useEffect, useCallback } from 'react'
import { useDownloadStore } from './stores/downloadStore'
import type { DownloadProgress } from './types'

type View = 'downloads' | 'history' | 'settings'
type Theme = 'dark' | 'light'

function App() {
  const [view, setView] = useState<View>('downloads')
  const [urlInput, setUrlInput] = useState('')
  const [completedVideos, setCompletedVideos] = useState<Set<number>>(new Set())
  const [showSuccess, setShowSuccess] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
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

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('vidgrab-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [theme])

  // Initialize settings and history
  useEffect(() => {
    loadSettings()
    loadHistory()
  }, [loadSettings, loadHistory])

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
    // Always open the download folder, not the specific file
    window.electronAPI.openFolder(settings.downloadPath || '')
  }, [settings.downloadPath])

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

  return (
    <>
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
        <button className={`toolbar-btn ${view === 'downloads' ? 'active' : ''}`} onClick={() => setView('downloads')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Downloads</span>
        </button>

        <button className={`toolbar-btn ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>History</span>
        </button>

        <button className={`toolbar-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Settings</span>
        </button>

        <div className="toolbar-spacer" />

        {/* Theme Toggle */}
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
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

        <button className="toolbar-btn" onClick={handleReset} disabled={isDownloading}>
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
      <div className={`main-content ${isDownloading ? 'downloading' : ''}`}>
        {view === 'downloads' && (
          <>
            {/* Content Panel (Left) */}
            <div className="content-panel">
              {/* Empty State */}
              {!contentInfo && !isDetecting && (
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
                </div>
              )}

              {/* Loading State */}
              {isDetecting && (
                <div className="empty-state">
                  <div className="spinner" />
                  <div className="empty-state-title">ANALYZING TARGET<span className="blink">_</span></div>
                  <div className="empty-state-text">// Fetching metadata from remote source</div>
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
            </div>

            {/* Side Panel (Right) - Quality Selection */}
            {contentInfo && !showSuccess && (
              <div className="side-panel">
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
                    <button className="btn-download btn-stop" onClick={cancelDownload}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12"/>
                      </svg>
                      ABORT DOWNLOAD
                    </button>
                  ) : (
                    <button
                      className="btn-download"
                      onClick={handleStartDownload}
                      disabled={!selectedFormat || isLoadingFormats}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      EXECUTE DOWNLOAD
                    </button>
                  )}
                </div>
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
            </div>
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
              <button className="btn-success" onClick={handleOpenFolder}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                OPEN FOLDER
              </button>
              <button className="btn-outline" onClick={handleReset}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                NEW DOWNLOAD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Progress Bar - Fixed above status bar - Only on downloads tab */}
      {isDownloading && view === 'downloads' && (
        <div className={`progress-bar-fixed ${contentInfo && !showSuccess ? 'with-sidebar' : ''}`}>
          <div className="progress-bar-inner">
            <div className="progress-info">
              <span className="progress-label">
                {downloadProgress?.status === 'downloading' && 'DOWNLOADING'}
                {downloadProgress?.status === 'merging' && 'MERGING'}
                {downloadProgress?.status === 'processing' && 'PROCESSING'}
                {downloadProgress?.status === 'waiting' && 'WAITING'}
                {downloadProgress?.status === 'complete' && 'FINALIZING'}
                {!downloadProgress && 'INITIALIZING'}
              </span>
              <span className="progress-percent">{downloadProgress?.percent?.toFixed(0) || 0}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-bg" />
              <div className={`progress-fill ${!downloadProgress ? 'progress-fill-init' : ''}`} style={{ width: `${downloadProgress?.percent || 0}%` }} />
            </div>
            <div className="progress-stats-compact">
              <span><strong>{downloadProgress?.speed || '--'}</strong> Speed</span>
              <span><strong>{downloadProgress?.eta || '--'}</strong> ETA</span>
              <span><strong>{downloadProgress?.total || '--'}</strong> Size</span>
              {downloadProgress?.totalFiles && downloadProgress.totalFiles > 1 && (
                <span>Video <strong>{downloadProgress.currentIndex || 1}/{downloadProgress.totalFiles}</strong></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-left">
          <div className={`status-indicator ${isDownloading ? 'downloading' : ''} ${downloadError ? 'error' : ''}`} />
          <span>
            {isDownloading && downloadProgress?.status === 'downloading' && `DOWNLOADING ${downloadProgress.percent?.toFixed(0)}%`}
            {isDownloading && downloadProgress?.status === 'merging' && 'MERGING FILES'}
            {isDownloading && !downloadProgress && 'INITIALIZING'}
            {!isDownloading && downloadError && 'ERROR'}
            {!isDownloading && showSuccess && 'COMPLETE'}
            {!isDownloading && !downloadError && !showSuccess && 'READY'}
          </span>
        </div>
        <span>{history.length} DOWNLOADS LOGGED // {theme.toUpperCase()} MODE</span>
      </div>
    </>
  )
}

export default App
