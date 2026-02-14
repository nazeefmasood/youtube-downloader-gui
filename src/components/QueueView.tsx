import { useEffect, useState, useCallback } from 'react'
import type { QueueItem, QueueStatus } from '../types'

export function QueueView() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    items: [],
    isProcessing: false,
    isPaused: false,
    currentItemId: null,
    batchStatus: null,
    countdownInfo: null,
  })

  useEffect(() => {
    // Load initial queue status
    window.electronAPI.getQueue().then(setQueueStatus).catch(console.error)

    // Subscribe to queue updates
    const unsubscribe = window.electronAPI.onQueueUpdate((status) => {
      setQueueStatus(status)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handlePauseResume = useCallback(() => {
    if (queueStatus.isPaused) {
      window.electronAPI.resumeQueue()
    } else {
      window.electronAPI.pauseQueue()
    }
  }, [queueStatus.isPaused])

  const handleCancelItem = useCallback((id: string) => {
    window.electronAPI.cancelQueueItem(id)
  }, [])

  const handleRemoveItem = useCallback((id: string) => {
    window.electronAPI.removeFromQueue(id)
  }, [])

  const handleClearQueue = useCallback(() => {
    window.electronAPI.clearQueue()
  }, [])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getStatusIcon = (status: QueueItem['status']) => {
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
    }
  }

  const getStatusLabel = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return 'QUEUED'
      case 'downloading':
        return 'DOWNLOADING'
      case 'completed':
        return 'COMPLETE'
      case 'failed':
        return 'FAILED'
      case 'cancelled':
        return 'CANCELLED'
    }
  }

  const pendingCount = queueStatus.items.filter(i => i.status === 'pending').length
  const downloadingCount = queueStatus.items.filter(i => i.status === 'downloading').length
  const completedCount = queueStatus.items.filter(i => i.status === 'completed').length

  return (
    <div className="queue-panel">
      {queueStatus.items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="empty-state-title">QUEUE EMPTY<span className="blink">_</span></div>
          <div className="empty-state-text">// Downloads from the browser extension will appear here</div>
          <div className="empty-state-hint">
            <div className="hint-item">
              <span className="hint-icon">1</span>
              <span>Install the VidGrab browser extension</span>
            </div>
            <div className="hint-item">
              <span className="hint-icon">2</span>
              <span>Visit a YouTube video</span>
            </div>
            <div className="hint-item">
              <span className="hint-icon">3</span>
              <span>Click the download button below the video</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="queue-header">
            <div className="queue-stats">
              <span className="queue-title">DOWNLOAD QUEUE</span>
              <div className="queue-badges">
                {downloadingCount > 0 && (
                  <span className="queue-badge downloading">{downloadingCount} active</span>
                )}
                {pendingCount > 0 && (
                  <span className="queue-badge pending">{pendingCount} pending</span>
                )}
                {completedCount > 0 && (
                  <span className="queue-badge completed">{completedCount} done</span>
                )}
              </div>
            </div>
            <div className="queue-controls">
              <button
                className={`btn-queue-control ${queueStatus.isPaused ? 'paused' : ''}`}
                onClick={handlePauseResume}
                title={queueStatus.isPaused ? 'Resume queue' : 'Pause queue'}
              >
                {queueStatus.isPaused ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    RESUME
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16"/>
                      <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    PAUSE
                  </>
                )}
              </button>
              <button className="btn-clear" onClick={handleClearQueue}>
                CLEAR ALL
              </button>
            </div>
          </div>

          <div className="queue-list">
            {queueStatus.items.map((item) => (
              <div
                key={item.id}
                className={`queue-item ${item.status === 'downloading' ? 'active' : ''} ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'failed' ? 'failed' : ''}`}
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
                  {item.status === 'downloading' && item.progress && (
                    <div className="queue-item-progress">
                      <div className="queue-progress-bar">
                        <div
                          className="queue-progress-fill"
                          style={{ width: `${item.progress.percent || 0}%` }}
                        />
                      </div>
                      <div className="queue-progress-stats">
                        <span>{item.progress.percent?.toFixed(0) || 0}%</span>
                        {item.progress.speed && <span>{item.progress.speed}</span>}
                        {item.progress.eta && <span>ETA: {item.progress.eta}</span>}
                      </div>
                    </div>
                  )}
                  {item.status === 'failed' && item.error && (
                    <div className="queue-item-error">{item.error}</div>
                  )}
                </div>

                <div className="queue-item-status">
                  {getStatusIcon(item.status)}
                  <span className={`status-label ${item.status}`}>{getStatusLabel(item.status)}</span>
                </div>

                <div className="queue-item-actions">
                  {(item.status === 'pending' || item.status === 'downloading') && (
                    <button
                      className="queue-btn-cancel"
                      onClick={() => handleCancelItem(item.id)}
                      title="Cancel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      </svg>
                    </button>
                  )}
                  {(item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') && (
                    <button
                      className="queue-btn-remove"
                      onClick={() => handleRemoveItem(item.id)}
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
        </>
      )}
    </div>
  )
}
