import { useCallback, useState } from 'react'
import type { QueueItem, QueueStatus, DownloadProgress } from '../../types'

interface DownloadsTabProps {
  queueStatus: QueueStatus
  downloadProgress: DownloadProgress | null
}

type FilterStatus = 'all' | 'active' | 'pending' | 'completed'

export function DownloadsTab({ queueStatus, downloadProgress }: DownloadsTabProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getFilteredItems = useCallback(() => {
    switch (filterStatus) {
      case 'active':
        return queueStatus.items.filter((i) => i.status === 'downloading')
      case 'pending':
        return queueStatus.items.filter((i) => i.status === 'pending' || i.status === 'paused')
      case 'completed':
        return queueStatus.items.filter((i) => i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled')
      default:
        return queueStatus.items
    }
  }, [queueStatus.items, filterStatus])

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

  const getQueueStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )
      case 'downloading':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )
      case 'completed':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )
      case 'failed':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        )
      case 'paused':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="10" y1="8" x2="10" y2="16" />
            <line x1="14" y1="8" x2="14" y2="16" />
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

  const activeQueueItems = queueStatus.items.filter(
    (i) => i.status === 'pending' || i.status === 'downloading' || i.status === 'paused'
  )
  const filteredItems = getFilteredItems()

  // Get current queue progress
  const currentQueueItem = queueStatus.items.find((i) => i.id === queueStatus.currentItemId)
  const effectiveProgress = downloadProgress || currentQueueItem?.progress

  return (
    <div className="downloads-tab">
      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          ALL ({queueStatus.items.length})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'active' ? 'active' : ''}`}
          onClick={() => setFilterStatus('active')}
        >
          ACTIVE ({queueStatus.items.filter((i) => i.status === 'downloading').length})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          PENDING ({queueStatus.items.filter((i) => i.status === 'pending' || i.status === 'paused').length})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'completed' ? 'active' : ''}`}
          onClick={() => setFilterStatus('completed')}
        >
          COMPLETED ({queueStatus.items.filter((i) => i.status === 'completed').length})
        </button>
        <div className="filter-spacer" />
        {activeQueueItems.length > 0 && (
          <button
            type="button"
            className={`btn-queue-control ${queueStatus.isPaused ? 'paused' : ''}`}
            onClick={handlePauseResumeQueue}
          >
            {queueStatus.isPaused ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                RESUME
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                PAUSE
              </>
            )}
          </button>
        )}
        <button type="button" className="btn-clear" onClick={handleClearQueue}>
          CLEAR
        </button>
      </div>

      {/* Progress Bar when downloading */}
      {queueStatus.isProcessing && effectiveProgress && (
        <div className="download-progress-bar">
          <div className="progress-info">
            <span className="progress-label">
              {effectiveProgress.status === 'downloading' && 'DOWNLOADING'}
              {effectiveProgress.status === 'merging' && 'MERGING'}
              {effectiveProgress.status === 'processing' && 'PROCESSING'}
              {effectiveProgress.status === 'waiting' && 'WAITING'}
            </span>
            <span className="progress-percent">{effectiveProgress.percent?.toFixed(0) || 0}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-bg" />
            <div className="progress-fill" style={{ width: `${effectiveProgress.percent || 0}%` }} />
          </div>
          <div className="progress-stats-compact">
            <span><strong>{effectiveProgress.speed || '--'}</strong> Speed</span>
            <span><strong>{effectiveProgress.eta || '--'}</strong> ETA</span>
            <span><strong>{effectiveProgress.total || '--'}</strong> Size</span>
            {currentQueueItem && (
              <span className="progress-title-compact">{currentQueueItem.title}</span>
            )}
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="queue-content">
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="empty-state-title">NO DOWNLOADS<span className="blink">_</span></div>
            <div className="empty-state-text">
              {filterStatus === 'all'
                ? '// Add videos from the Analyze tab to start downloading'
                : `// No ${filterStatus} downloads`}
            </div>
          </div>
        ) : (
          <div className="queue-list">
            {filteredItems.map((item) => (
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
                        <path d="M8 5v14l11-7z" />
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
                  <span className={`status-label ${item.status}`}>
                    {getQueueStatusLabel(item.status)}
                  </span>
                </div>

                <div className="queue-item-actions">
                  {(item.status === 'pending' || item.status === 'downloading' || item.status === 'paused') && (
                    <button
                      type="button"
                      className="queue-btn-cancel"
                      onClick={() => handleCancelQueueItem(item.id)}
                      title="Cancel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" />
                      </svg>
                    </button>
                  )}
                  {(item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') && (
                    <button
                      type="button"
                      className="queue-btn-remove"
                      onClick={() => handleRemoveQueueItem(item.id)}
                      title="Remove"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
