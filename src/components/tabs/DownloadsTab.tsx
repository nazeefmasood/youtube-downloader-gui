import { useCallback, useState, useRef, useEffect } from 'react'
import type { QueueItem, QueueStatus, DownloadProgress } from '../../types'

interface DownloadsTabProps {
  queueStatus: QueueStatus
  downloadProgress: DownloadProgress | null
}

type FilterStatus = 'all' | 'active' | 'pending' | 'completed'
type ClearMenuState = 'closed' | 'open'

// Virtualization constants
const ITEM_HEIGHT = 72  // Approximate height of each queue item
const BUFFER_ITEMS = 5   // Extra items to render above/below viewport

interface GroupInfo {
  groupId: string
  label: string
  items: QueueItem[]
  completedCount: number
  totalCount: number
}

export function DownloadsTab({ queueStatus, downloadProgress }: DownloadsTabProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [scrollTop, setScrollTop] = useState(0)
  const [clearMenuState, setClearMenuState] = useState<ClearMenuState>('closed')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const clearMenuRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Close clear menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clearMenuRef.current && !clearMenuRef.current.contains(event.target as Node)) {
        setClearMenuState('closed')
      }
    }
    if (clearMenuState === 'open') {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [clearMenuState])

  // Handle scroll for virtualization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Calculate visible range for virtualization
  const getVisibleRange = useCallback((totalItems: number) => {
    if (!scrollContainerRef.current || totalItems === 0) {
      return { startIndex: 0, endIndex: Math.min(50, totalItems) }
    }

    const containerHeight = scrollContainerRef.current.clientHeight || 600
    const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_ITEMS * 2

    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS)
    const endIndex = Math.min(totalItems, startIndex + visibleCount)

    return { startIndex, endIndex }
  }, [scrollTop])

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

  // Build grouped rows for batch items, preserving insertion order
  const buildGroups = useCallback((): GroupInfo[] => {
    const items = getFilteredItems()
    const groupMap = new Map<string, QueueItem[]>()
    const groups: GroupInfo[] = []
    const seenGroups = new Set<string>()

    // Process items in order to preserve their position
    for (const item of items) {
      if (item.batchGroupId) {
        const existing = groupMap.get(item.batchGroupId)
        if (existing) {
          existing.push(item)
        } else {
          groupMap.set(item.batchGroupId, [item])
        }
        // Create group entry on first encounter
        if (!seenGroups.has(item.batchGroupId)) {
          seenGroups.add(item.batchGroupId)
          groups.push({
            groupId: item.batchGroupId,
            label: item.sourceType === 'channel' ? 'CHANNEL' : 'PLAYLIST',
            items: [], // filled below
            completedCount: 0,
            totalCount: 0,
          })
        }
      } else {
        groups.push({
          groupId: item.id,
          label: '',
          items: [item],
          completedCount: item.status === 'completed' ? 1 : 0,
          totalCount: 1,
        })
      }
    }

    // Fill in batch group data
    for (const group of groups) {
      if (groupMap.has(group.groupId)) {
        const groupItems = groupMap.get(group.groupId)!
        group.items = groupItems
        group.totalCount = groupItems.length
        group.completedCount = groupItems.filter(i => i.status === 'completed').length
      }
    }

    return groups
  }, [getFilteredItems])

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

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

  // Clear functions
  const handleClearCompleted = useCallback(() => {
    // Remove all completed items
    queueStatus.items
      .filter(item => item.status === 'completed')
      .forEach(item => window.electronAPI.removeFromQueue(item.id))
    setClearMenuState('closed')
  }, [queueStatus.items])

  const handleClearFailed = useCallback(() => {
    // Remove all failed/cancelled items
    queueStatus.items
      .filter(item => item.status === 'failed' || item.status === 'cancelled')
      .forEach(item => window.electronAPI.removeFromQueue(item.id))
    setClearMenuState('closed')
  }, [queueStatus.items])

  const handleClearAllExceptActive = useCallback(() => {
    // Remove all items except currently downloading
    queueStatus.items
      .filter(item => item.status !== 'downloading')
      .forEach(item => window.electronAPI.removeFromQueue(item.id))
    setClearMenuState('closed')
  }, [queueStatus.items])

  const handleClearAll = useCallback(() => {
    // Cancel current download and clear everything
    if (queueStatus.isProcessing && queueStatus.currentItemId) {
      window.electronAPI.cancelQueueItem(queueStatus.currentItemId)
    }
    window.electronAPI.clearQueue()
    setClearMenuState('closed')
  }, [queueStatus.isProcessing, queueStatus.currentItemId])

  const toggleClearMenu = useCallback(() => {
    setClearMenuState(prev => prev === 'open' ? 'closed' : 'open')
  }, [])

  // Get counts for clear menu
  const completedCount = queueStatus.items.filter(i => i.status === 'completed').length
  const failedCount = queueStatus.items.filter(i => i.status === 'failed' || i.status === 'cancelled').length
  const totalCount = queueStatus.items.length

  const handleRetryQueueItem = useCallback((id: string) => {
    window.electronAPI.retryQueueItem(id)
  }, [])

  const handleRetryAllFailed = useCallback(() => {
    window.electronAPI.retryAllFailed()
  }, [])

  const handlePauseItem = useCallback((id: string) => {
    window.electronAPI.pauseQueueItem(id)
  }, [])

  const handleResumeItem = useCallback((id: string) => {
    window.electronAPI.resumeQueueItem(id)
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
  const groups = buildGroups()
  const hasBatchGroups = groups.some(g => g.totalCount > 1)

  // Build flat list of visible rows for grouped view
  const buildVisibleRows = useCallback(() => {
    const rows: Array<{ type: 'header'; group: GroupInfo } | { type: 'item'; item: QueueItem; grouped: boolean }> = []
    for (const group of groups) {
      if (group.totalCount > 1) {
        rows.push({ type: 'header', group })
        if (!collapsedGroups.has(group.groupId)) {
          for (const item of group.items) {
            rows.push({ type: 'item', item, grouped: true })
          }
        }
      } else {
        rows.push({ type: 'item', item: group.items[0], grouped: false })
      }
    }
    return rows
  }, [groups, collapsedGroups])

  const groupedRows = hasBatchGroups ? buildVisibleRows() : null

  // Calculate virtualization (use flat list when no groups)
  const totalRowCount = groupedRows ? groupedRows.length : filteredItems.length
  const { startIndex, endIndex } = getVisibleRange(totalRowCount)
  const totalHeight = totalRowCount * ITEM_HEIGHT
  const offsetY = startIndex * ITEM_HEIGHT
  const visibleItems = groupedRows ? null : filteredItems.slice(startIndex, endIndex)
  const visibleRows = groupedRows ? groupedRows.slice(startIndex, endIndex) : null

  const renderQueueItemContent = (item: QueueItem) => (
    <>
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
          <span className={`queue-item-tag tag-type ${item.contentType || (item.audioOnly ? 'audio' : 'video')}`}>
            {item.contentType === 'subtitle' ? `SUB ${item.subtitleDisplayNames || 'ALL'}`
              : item.contentType === 'video+sub'
                ? `VIDEO+SUB (${item.subtitleDisplayNames || 'ALL'})${item.qualityLabel ? ` ${item.qualityLabel}` : ''}`
              : item.contentType === 'audio' || item.audioOnly
                ? `AUDIO${item.qualityLabel ? ` ${item.qualityLabel}` : ''}`
                : `VIDEO${item.qualityLabel ? ` ${item.qualityLabel}` : ''}`}
          </span>
          <span className={`queue-item-tag tag-source ${item.source === 'extension' ? 'ext' : (item.sourceType || 'single')}`}>
            {item.source === 'extension' ? 'EXTENSION'
              : item.sourceType === 'playlist' ? 'PLAYLIST'
              : item.sourceType === 'channel' ? 'CHANNEL'
              : 'SINGLE'}
          </span>
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
        {(item.status === 'downloading' || item.status === 'pending') && (
          <button type="button" className="queue-btn-pause" onClick={() => handlePauseItem(item.id)} title="Pause">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        )}
        {item.status === 'paused' && (
          <button type="button" className="queue-btn-resume" onClick={() => handleResumeItem(item.id)} title="Resume">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}
        {(item.status === 'pending' || item.status === 'downloading' || item.status === 'paused') && (
          <button type="button" className="queue-btn-cancel" onClick={() => handleCancelQueueItem(item.id)} title="Cancel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        )}
        {(item.status === 'failed' || item.status === 'cancelled') && (
          <button type="button" className="queue-btn-retry" onClick={() => handleRetryQueueItem(item.id)} title="Retry">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        )}
        {(item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') && (
          <button type="button" className="queue-btn-remove" onClick={() => handleRemoveQueueItem(item.id)} title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </>
  )

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
        {queueStatus.items.filter((i) => i.status === 'failed').length > 0 && (
          <button
            type="button"
            className="btn-retry-all"
            onClick={handleRetryAllFailed}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            RETRY FAILED
          </button>
        )}
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
        {/* Clear dropdown menu */}
        <div className="clear-dropdown" ref={clearMenuRef}>
          <button
            type="button"
            className={`btn-clear ${clearMenuState === 'open' ? 'active' : ''}`}
            onClick={toggleClearMenu}
            disabled={totalCount === 0}
          >
            CLEAR {clearMenuState === 'open' ? '▲' : '▼'}
          </button>
          {clearMenuState === 'open' && (
            <div className="clear-dropdown-menu">
              {completedCount > 0 && (
                <button type="button" onClick={handleClearCompleted}>
                  COMPLETED ({completedCount})
                </button>
              )}
              {failedCount > 0 && (
                <button type="button" onClick={handleClearFailed}>
                  FAILED/CANCELLED ({failedCount})
                </button>
              )}
              <button type="button" onClick={handleClearAllExceptActive}>
                KEEP ACTIVE ONLY
              </button>
              <button type="button" className="danger" onClick={handleClearAll}>
                EVERYTHING ({totalCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Queue List */}
      <div
        ref={scrollContainerRef}
        className={`queue-content ${queueStatus.isProcessing && effectiveProgress ? 'has-progress-bar' : ''}`}
        onScroll={handleScroll}
      >
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
          <div
            className="queue-list"
            style={{ height: totalHeight, position: 'relative' }}
          >
            <div style={{ position: 'absolute', top: offsetY, width: '100%' }}>
              {visibleRows ? (
                /* Grouped view */
                visibleRows.map((row) => {
                  if (row.type === 'header') {
                    const g = row.group
                    const isCollapsed = collapsedGroups.has(g.groupId)
                    const failedCount = g.items.filter(i => i.status === 'failed').length
                    const pendingCount = g.items.filter(i => i.status === 'pending' || i.status === 'paused').length
                    const pct = g.totalCount > 0 ? Math.round((g.completedCount / g.totalCount) * 100) : 0
                    return (
                      <div
                        key={`gh-${g.groupId}`}
                        className={`queue-group-header ${isCollapsed ? 'collapsed' : ''}`}
                        onClick={() => toggleGroupCollapse(g.groupId)}
                        style={{ height: ITEM_HEIGHT }}
                      >
                        <span className="group-expand-indicator">
                          {isCollapsed ? '▸' : '▾'}
                        </span>
                        <span className={`queue-item-tag tag-source ${g.label.toLowerCase()}`}>
                          {g.label}
                        </span>
                        <div className="group-info">
                          <span className="group-title">{g.items[0]?.title || 'Batch'}</span>
                          <div className="group-stats">
                            <span className="group-stat">{g.completedCount}/{g.totalCount} done</span>
                            {failedCount > 0 && <span className="group-stat group-stat--error">{failedCount} failed</span>}
                            {pendingCount > 0 && <span className="group-stat group-stat--pending">{pendingCount} queued</span>}
                          </div>
                        </div>
                        <div className="group-progress-wrap">
                          <span className="group-pct">{pct}%</span>
                          <div className="group-bar">
                            <div className="group-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  }
                  const item = row.item
                  return (
                    <div
                      key={item.id}
                      className={`queue-item ${row.grouped ? 'queue-item--grouped' : ''} ${item.status === 'downloading' ? 'active' : ''} ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'failed' ? 'failed' : ''} ${item.status === 'paused' ? 'paused' : ''}`}
                    >
                {renderQueueItemContent(item)}
              </div>
                  )
                })
              ) : (
                /* Flat view */
                visibleItems!.map((item) => (
              <div
                key={item.id}
                className={`queue-item ${item.status === 'downloading' ? 'active' : ''} ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'failed' ? 'failed' : ''} ${item.status === 'paused' ? 'paused' : ''}`}
              >
                {renderQueueItemContent(item)}
              </div>
            ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Batch status / countdown bar */}
      {queueStatus.countdownInfo && (
        <div className="batch-countdown-bar">
          <span className="countdown-label">{queueStatus.countdownInfo.label}</span>
          <div className="countdown-bar-track">
            <div
              className="countdown-bar-fill"
              style={{
                width: `${queueStatus.countdownInfo.total > 0
                  ? ((queueStatus.countdownInfo.total - queueStatus.countdownInfo.remaining) / queueStatus.countdownInfo.total) * 100
                  : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Batch info */}
      {queueStatus.batchStatus?.active && (
        <div className="batch-info-bar">
          <span className="batch-info-label">BATCH</span>
          <span className="batch-info-num">{queueStatus.batchStatus.batchNumber}/{queueStatus.batchStatus.totalBatches}</span>
          <span className="batch-info-sep">//</span>
          <span className="batch-info-detail">{queueStatus.batchStatus.completedItems}/{queueStatus.batchStatus.totalItems} items</span>
          <span className="batch-info-sep">//</span>
          <span className="batch-info-detail">batch size: {queueStatus.batchStatus.batchSize}</span>
        </div>
      )}

      {/* Fixed Progress Bar at Bottom */}
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
    </div>
  )
}
