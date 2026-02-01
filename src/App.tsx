import { useState, useEffect, useCallback } from 'react'
import { useDownloadStore } from './stores/downloadStore'
import type { DownloadProgress } from './types'

type View = 'downloads' | 'history' | 'settings'

function App() {
  const [view, setView] = useState<View>('downloads')
  const [urlInput, setUrlInput] = useState('')
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
        // Get current contentInfo from store to avoid stale closure
        const currentState = useDownloadStore.getState()
        // Only add to history for single video downloads (playlists/channels are tracked per-video)
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

    // Track individual video downloads in playlists/channels
    const unsubVideoComplete = window.electronAPI.onVideoComplete((videoInfo) => {
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

  // Auto-select best quality when formats load and autoBestQuality is enabled
  useEffect(() => {
    if (formats.length > 0 && settings.autoBestQuality) {
      const bestVideo = formats.find(f => !f.isAudioOnly)
      if (bestVideo) {
        setSelectedFormat(bestVideo.formatId)
      }
    }
  }, [formats, settings.autoBestQuality, setSelectedFormat])

  const handleAddUrl = useCallback(() => {
    if (urlInput.trim()) {
      detectUrl(urlInput.trim())
    }
  }, [urlInput, detectUrl])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrlInput(text)
        detectUrl(text)
      }
    } catch {
      console.error('Failed to read clipboard')
    }
  }, [detectUrl])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddUrl()
    }
  }, [handleAddUrl])

  const handleStartDownload = useCallback(() => {
    startDownload()
  }, [startDownload])

  const handleStopDownload = useCallback(() => {
    cancelDownload()
  }, [cancelDownload])

  const getStatusText = (progress: DownloadProgress | null) => {
    if (!progress) return 'Ready'
    switch (progress.status) {
      case 'downloading': return `Downloading ${progress.percent.toFixed(1)}%`
      case 'merging': return 'Merging audio & video...'
      case 'processing': return 'Processing...'
      case 'complete': return 'Complete!'
      case 'waiting': return 'Waiting...'
      case 'error': return 'Error'
      default: return 'Ready'
    }
  }

  return (
    <>
      {/* Custom Title Bar */}
      <div className="title-bar">
        <div className="title-bar-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#fff"/>
            <path d="M10 8l6 4-6 4V8z" fill="#000"/>
          </svg>
          <span>VidGrab</span>
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
        <button className="toolbar-btn" onClick={handlePaste}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1"/>
          </svg>
          <span>Paste</span>
        </button>

        <button className="toolbar-btn" onClick={reset} disabled={isDownloading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Clear</span>
        </button>

        <div className="toolbar-separator" />

        <button className={`toolbar-btn ${view === 'downloads' ? 'active' : ''}`} onClick={() => setView('downloads')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Downloads</span>
        </button>

        <button className={`toolbar-btn ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>History</span>
        </button>

        <button className={`toolbar-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          <span>Settings</span>
        </button>
      </div>

      {/* URL Input Bar */}
      {view === 'downloads' && (
        <div className="url-bar">
          <div className="url-input-wrapper">
            <input
              type="text"
              className="url-input"
              placeholder="Enter YouTube URL (video, playlist, or channel)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDetecting || isDownloading}
            />
            {isDetecting ? (
              <button
                className="url-btn cancel"
                onClick={() => cancelDetection()}
              >
                Cancel
              </button>
            ) : (
              <button
                className="url-btn"
                onClick={handleAddUrl}
                disabled={isDownloading || !urlInput.trim()}
              >
                Analyze
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {view === 'downloads' && (
          <>
            {/* Download Area */}
            <div className="download-area">
              {/* Empty State */}
              {!contentInfo && !isDetecting && (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <div className="empty-state-title">Ready to Download</div>
                  <div className="empty-state-text">Paste a YouTube URL above to get started</div>
                </div>
              )}

              {/* Loading State */}
              {isDetecting && (
                <div className="empty-state">
                  <div className="spinner" />
                  <div className="empty-state-title">Analyzing URL...</div>
                  <div className="empty-state-text">Fetching video information</div>
                </div>
              )}

              {/* Content Loaded */}
              {contentInfo && !isDetecting && (
                <div className="content-loaded">
                  {/* Video Info Card */}
                  <div className="video-card">
                    <div className="video-thumbnail">
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
                    <div className="video-info">
                      <div className="video-title">{contentInfo.title}</div>
                      <div className="video-meta">
                        {contentInfo.uploaderName && <span>{contentInfo.uploaderName}</span>}
                        <span className="video-type">{contentInfo.type.toUpperCase()}</span>
                        {contentInfo.videoCount && contentInfo.videoCount > 1 && (
                          <span>{contentInfo.videoCount} videos</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Download Progress */}
                  {(isDownloading || downloadProgress) && (
                    <div className="download-progress-card">
                      <div className="progress-header">
                        <span className="progress-status">
                          {downloadProgress?.status === 'downloading' && 'Downloading...'}
                          {downloadProgress?.status === 'merging' && 'Merging files...'}
                          {downloadProgress?.status === 'complete' && 'Complete!'}
                          {downloadProgress?.status === 'waiting' && 'Waiting...'}
                          {!downloadProgress && isDownloading && 'Starting...'}
                        </span>
                        <span className="progress-percent">{downloadProgress?.percent?.toFixed(0) || 0}%</span>
                      </div>
                      <div className="progress-bar-large">
                        <div
                          className="progress-bar-fill-large"
                          style={{ width: `${downloadProgress?.percent || 0}%` }}
                        />
                      </div>
                      <div className="progress-details">
                        <span>{downloadProgress?.speed || '—'}</span>
                        <span>ETA: {downloadProgress?.eta || '—'}</span>
                        <span>{downloadProgress?.total || '—'}</span>
                      </div>
                      {downloadProgress?.currentIndex && downloadProgress?.totalFiles && downloadProgress.totalFiles > 1 && (
                        <div className="progress-files">
                          Video {downloadProgress.currentIndex} of {downloadProgress.totalFiles}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {downloadError && (
                    <div className="error-card">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>{downloadError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Side Panel - Quality Selection */}
            {contentInfo && (
              <div className="side-panel">
                <div className="panel-section">
                  <div className="panel-title">Video Quality</div>
                  {isLoadingFormats ? (
                    <div className="loading-formats">
                      <div className="spinner-small" />
                      <span>Loading formats...</span>
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
                          <span className="quality-name">{format.quality}</span>
                          <span className="quality-ext">{format.ext.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel-section">
                  <div className="panel-title">Audio Only</div>
                  <div className="quality-list">
                    {formats.filter(f => f.isAudioOnly).map((format) => (
                      <button
                        key={format.formatId}
                        className={`quality-option ${selectedFormat === format.formatId ? 'selected' : ''}`}
                        onClick={() => setSelectedFormat(format.formatId)}
                        disabled={isDownloading}
                      >
                        <span className="quality-name">{format.quality}</span>
                        <span className="quality-ext">{format.ext.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Button */}
                <div className="panel-actions">
                  {isDownloading ? (
                    <button className="btn-download btn-stop" onClick={handleStopDownload}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12"/>
                      </svg>
                      Stop Download
                    </button>
                  ) : (
                    <button
                      className="btn-download"
                      onClick={handleStartDownload}
                      disabled={!selectedFormat || isLoadingFormats}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Start Download
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {view === 'history' && (
          <div className="history-panel">
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div className="empty-state-title">No History</div>
                <div className="empty-state-text">Downloaded videos will appear here</div>
              </div>
            ) : (
              <>
                <div className="history-header">
                  <span>{history.length} downloads</span>
                  <button className="btn-clear" onClick={clearHistory}>Clear All</button>
                </div>
                <div className="history-list">
                  {history.map((item) => (
                    <div key={item.id} className="history-item">
                      <div className="history-thumbnail">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} />
                        ) : (
                          <div className="thumbnail-placeholder-small">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="history-info">
                        <div className="history-title">{item.title}</div>
                        <div className="history-meta">
                          <span>{new Date(item.downloadDate).toLocaleDateString()}</span>
                          <span className={`history-status ${item.status}`}>{item.status}</span>
                        </div>
                      </div>
                      <div className="history-actions">
                        <button onClick={() => window.electronAPI.openFolder(item.filePath)} title="Open folder">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                        <button onClick={() => removeFromHistory(item.id)} title="Remove">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

        {view === 'settings' && (
          <div className="settings-panel">
            <div className="settings-group">
              <div className="settings-group-title">Download</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download Location</div>
                  <div className="setting-value">{settings.downloadPath || '~/Downloads/Youtube Downloads'}</div>
                </div>
                <button className="btn-secondary" onClick={async () => {
                  const folder = await window.electronAPI.selectFolder()
                  if (folder) updateSettings({ downloadPath: folder })
                }}>
                  Browse
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
              <div className="settings-group-title">About</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">VidGrab</div>
                  <div className="setting-description">Version 1.0.0 • Powered by yt-dlp</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <span>{getStatusText(downloadProgress)}</span>
        <span>{history.length} downloads</span>
      </div>
    </>
  )
}

export default App
