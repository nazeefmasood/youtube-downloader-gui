import { useCallback, useEffect, useState } from 'react'
import { useDownloadStore } from '../../stores/downloadStore'
import type { SubtitleInfo, PlaylistSelectionMode } from '../../types'

interface AnalyzeTabProps {
  onAddToQueue: () => void
}

export function AnalyzeTab({ onAddToQueue }: AnalyzeTabProps) {
  const [urlInput, setUrlInput] = useState('')
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [playlistSelectionMode, setPlaylistSelectionMode] = useState<PlaylistSelectionMode>('all')
  const [rangeStart, setRangeStart] = useState<number>(1)
  const [rangeEnd, setRangeEnd] = useState<number>(1)

  // Subtitle state
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [availableSubtitles, setAvailableSubtitles] = useState<SubtitleInfo[]>([])
  const [selectedSubtitleLangs, setSelectedSubtitleLangs] = useState<Set<string>>(new Set(['en']))
  const [includeAutoSubs, setIncludeAutoSubs] = useState(true)
  const [embedSubs, setEmbedSubs] = useState(false)
  const [subFormat, setSubFormat] = useState<'srt' | 'vtt' | 'ass'>('srt')
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false)

  const {
    contentInfo,
    isDetecting,
    formats,
    selectedFormat,
    setSelectedFormat,
    isLoadingFormats,
    downloadError,
    detectUrl,
    cancelDetection,
  } = useDownloadStore()

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
  }

  const handleAnalyze = useCallback(() => {
    if (urlInput.trim()) {
      detectUrl(urlInput.trim())
    }
  }, [urlInput, detectUrl])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze()
    }
  }, [handleAnalyze])

  // Reset playlist selection when content changes
  useEffect(() => {
    if (contentInfo?.entries) {
      setSelectedVideos(new Set())
      setPlaylistSelectionMode('all')
      setRangeStart(1)
      setRangeEnd(contentInfo.entries.length)
    }
  }, [contentInfo])

  // Fetch subtitles when video content is detected
  useEffect(() => {
    const fetchSubtitles = async () => {
      if (contentInfo?.type === 'video' && contentInfo.id) {
        setIsLoadingSubtitles(true)
        try {
          const url = `https://www.youtube.com/watch?v=${contentInfo.id}`
          const subs = await window.electronAPI.getSubtitles(url)
          setAvailableSubtitles(subs)
        } catch (err) {
          console.error('Failed to fetch subtitles:', err)
          setAvailableSubtitles([])
        } finally {
          setIsLoadingSubtitles(false)
        }
      } else {
        setAvailableSubtitles([])
      }
    }
    fetchSubtitles()
  }, [contentInfo])

  const handleVideoSelect = useCallback((index: number) => {
    setSelectedVideos((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
    if (playlistSelectionMode === 'all') {
      setPlaylistSelectionMode('selected')
    }
  }, [playlistSelectionMode])

  const handleSelectAll = useCallback(() => {
    if (!contentInfo?.entries) return
    const allIndices = new Set(contentInfo.entries.map((e) => e.index))
    setSelectedVideos(allIndices)
    setPlaylistSelectionMode('selected')
  }, [contentInfo])

  const handleDeselectAll = useCallback(() => {
    setSelectedVideos(new Set())
    setPlaylistSelectionMode('all')
  }, [])

  const handleSubtitleLangToggle = useCallback((lang: string) => {
    setSelectedSubtitleLangs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(lang)) {
        newSet.delete(lang)
      } else {
        newSet.add(lang)
      }
      return newSet
    })
  }, [])

  const getVideosToDownload = useCallback(() => {
    if (!contentInfo?.entries) return []

    switch (playlistSelectionMode) {
      case 'all':
        return contentInfo.entries
      case 'selected':
        return contentInfo.entries.filter((e) => selectedVideos.has(e.index))
      case 'range':
        return contentInfo.entries.filter(
          (e) => e.index >= rangeStart && e.index <= rangeEnd
        )
      default:
        return contentInfo.entries
    }
  }, [contentInfo, playlistSelectionMode, selectedVideos, rangeStart, rangeEnd])

  const handleAddToQueue = useCallback(async () => {
    if (!contentInfo) return

    const formatToUse = selectedFormat || 'bestvideo+bestaudio/best'
    const formatObj = formats.find((f) => f.formatId === formatToUse)
    const isAudio = formatObj?.isAudioOnly || false

    // Get the quality label from the format (e.g. "4K", "1080p", "Best Quality (4K)")
    const qualityLabel = formatObj?.quality || (isAudio ? 'Audio' : 'Video')

    // Build subtitle options if enabled
    const subOpts = subtitlesEnabled && availableSubtitles.length > 0 ? {
      enabled: true,
      languages: Array.from(selectedSubtitleLangs),
      includeAutoGenerated: includeAutoSubs,
      format: subFormat,
      embedInVideo: embedSubs,
    } : undefined

    // Determine content type tag
    const getContentType = (): 'video' | 'audio' | 'subtitle' | 'video+sub' => {
      if (isAudio) return 'audio'
      if (subOpts) return 'video+sub'
      return 'video'
    }

    if (contentInfo.type === 'video') {
      await window.electronAPI.addToQueue({
        url: `https://www.youtube.com/watch?v=${contentInfo.id}`,
        title: contentInfo.title,
        thumbnail: contentInfo.thumbnail,
        format: formatToUse,
        qualityLabel,
        audioOnly: isAudio,
        source: 'app',
        sourceType: 'single',
        contentType: getContentType(),
        subtitleOptions: subOpts,
      })
    } else {
      const videosToDownload = getVideosToDownload()
      const srcType = contentInfo.type === 'playlist' ? 'playlist' : 'channel'
      for (const entry of videosToDownload) {
        await window.electronAPI.addToQueue({
          url: `https://www.youtube.com/watch?v=${entry.id}`,
          title: entry.title,
          thumbnail: entry.thumbnail,
          format: formatToUse,
          qualityLabel,
          audioOnly: isAudio,
          source: 'app',
          sourceType: srcType,
          contentType: getContentType(),
          subtitleOptions: subOpts,
        })
      }
    }

    onAddToQueue()
  }, [contentInfo, selectedFormat, formats, getVideosToDownload, onAddToQueue, subtitlesEnabled, availableSubtitles, selectedSubtitleLangs, includeAutoSubs, subFormat, embedSubs])

  // Handle subtitle-only download
  const handleSubtitleOnlyDownload = useCallback(async () => {
    if (!contentInfo || contentInfo.type !== 'video') return
    if (!availableSubtitles.length) return

    await window.electronAPI.addToQueue({
      url: `https://www.youtube.com/watch?v=${contentInfo.id}`,
      title: contentInfo.title,
      thumbnail: contentInfo.thumbnail,
      format: 'subtitle-only',
      qualityLabel: `SUB (${subFormat.toUpperCase()})`,
      audioOnly: false,
      source: 'app',
      sourceType: 'single',
      contentType: 'subtitle',
      subtitleOptions: {
        enabled: true,
        languages: Array.from(selectedSubtitleLangs),
        includeAutoGenerated: includeAutoSubs,
        format: subFormat,
        embedInVideo: false,
      },
    })

    onAddToQueue()
  }, [contentInfo, availableSubtitles, selectedSubtitleLangs, includeAutoSubs, subFormat, onAddToQueue])

  return (
    <>
      {/* URL Input Bar */}
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
            disabled={isDetecting}
          />
          {isDetecting ? (
            <button type="button" className="url-btn cancel" onClick={() => cancelDetection()}>
              ABORT
            </button>
          ) : (
            <button
              type="button"
              className="url-btn"
              onClick={handleAnalyze}
              disabled={!urlInput.trim()}
            >
              ANALYZE
            </button>
          )}
        </div>
      </div>

      <div className="main-content">
        {/* Content Panel (Left) */}
        <div className="content-panel">
          {/* Empty State */}
          {!contentInfo && !isDetecting && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div className="empty-state-title">AWAITING INPUT<span className="blink">_</span></div>
              <div className="empty-state-text">// Paste a YouTube URL above to begin analysis</div>
            </div>
          )}

          {/* Analyzing State */}
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
                          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="error-icon">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    <span className="error-title">ERROR</span>
                  </div>
                  <div className="error-message">{downloadError}</div>
                </div>
              )}

              {/* Video List (for playlists/channels) */}
              {contentInfo.entries && contentInfo.entries.length > 0 && (
                <>
                  <div className="video-list-header">
                    <div className="video-list-header-left">
                      <span className="video-list-title">VIDEO QUEUE</span>
                      <span className="video-list-count">
                        {playlistSelectionMode === 'all'
                          ? `${contentInfo.entries.length} items`
                          : playlistSelectionMode === 'selected'
                            ? `${selectedVideos.size} / ${contentInfo.entries.length} selected`
                            : `${Math.min(rangeEnd, contentInfo.entries.length) - rangeStart + 1} items (range)`}
                      </span>
                    </div>
                    <div className="video-list-controls">
                      <button
                        type="button"
                        className={`btn-select ${selectedVideos.size === contentInfo.entries.length ? 'active' : ''}`}
                        onClick={handleSelectAll}
                      >
                        SELECT ALL
                      </button>
                      <button
                        type="button"
                        className="btn-select"
                        onClick={handleDeselectAll}
                        disabled={selectedVideos.size === 0}
                      >
                        DESELECT
                      </button>
                    </div>
                  </div>
                  <div className="video-list">
                    {contentInfo.entries.map((video) => {
                      const isSelected = selectedVideos.has(video.index)
                      return (
                        <div
                          key={video.id}
                          className={`video-list-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleVideoSelect(video.index)}
                        >
                          <div className={`video-checkbox ${isSelected ? 'checked' : ''}`}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" fill="none" />
                              </svg>
                            )}
                          </div>
                          <div className="video-list-index">{String(video.index).padStart(2, '0')}</div>
                          <div className="video-list-thumb">
                            {video.thumbnail ? (
                              <img src={video.thumbnail} alt={video.title} />
                            ) : (
                              <div className="thumbnail-placeholder">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="video-list-info">
                            <div className="video-list-name">{video.title}</div>
                            <div className="video-list-duration">{formatDuration(video.duration)}</div>
                          </div>
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
        {contentInfo && (
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
                      {formats.filter((f) => !f.isAudioOnly).map((format) => (
                        <button
                          key={format.formatId}
                          type="button"
                          className={`quality-option ${selectedFormat === format.formatId ? 'selected' : ''}`}
                          onClick={() => setSelectedFormat(format.formatId)}
                        >
                          <div className="quality-info">
                            <span className="quality-name">{format.quality}</span>
                            <span className="quality-badge">{format.ext.toUpperCase()}</span>
                          </div>
                          {formatFileSize(format.filesize) && (
                            <div className="quality-size">{formatFileSize(format.filesize)}</div>
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
                    {formats.filter((f) => f.isAudioOnly).map((format) => (
                      <button
                        key={format.formatId}
                        type="button"
                        className={`quality-option ${selectedFormat === format.formatId ? 'selected' : ''}`}
                        onClick={() => setSelectedFormat(format.formatId)}
                      >
                        <div className="quality-info">
                          <span className="quality-name">{format.quality}</span>
                          <span className="quality-badge">{format.ext.toUpperCase()}</span>
                        </div>
                        {formatFileSize(format.filesize) && (
                          <div className="quality-size">{formatFileSize(format.filesize)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Subtitle Options - Only for single videos */}
              {contentInfo.type === 'video' && (
                <div className="panel-section">
                  <div className="panel-header">
                    <span className="panel-title">SUBTITLES</span>
                    <button
                      type="button"
                      className={`toggle-small ${subtitlesEnabled ? 'on' : ''}`}
                      onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                      title="Toggle subtitles"
                    >
                      <div className="toggle-knob-small" />
                    </button>
                  </div>
                  {subtitlesEnabled && (
                    <div className="panel-content subtitle-options">
                      {isLoadingSubtitles ? (
                        <div className="loading-formats">
                          <div className="spinner-small" />
                          <span>CHECKING...</span>
                        </div>
                      ) : availableSubtitles.length > 0 ? (
                        <>
                          <div className="subtitle-langs">
                            {availableSubtitles
                              .filter(s => !s.isAutoGenerated || includeAutoSubs)
                              .slice(0, 8)
                              .map((sub) => (
                                <button
                                  key={`${sub.lang}-${sub.isAutoGenerated}`}
                                  type="button"
                                  className={`subtitle-lang-btn ${selectedSubtitleLangs.has(sub.lang) ? 'selected' : ''}`}
                                  onClick={() => handleSubtitleLangToggle(sub.lang)}
                                  title={sub.isAutoGenerated ? 'Auto-generated' : 'Manual subtitles'}
                                >
                                  {sub.lang.toUpperCase()}
                                  {sub.isAutoGenerated && <span className="auto-badge">A</span>}
                                </button>
                              ))}
                          </div>
                          <div className="subtitle-settings">
                            <label className="subtitle-checkbox">
                              <input
                                type="checkbox"
                                checked={includeAutoSubs}
                                onChange={(e) => setIncludeAutoSubs(e.target.checked)}
                              />
                              <span>Include auto-generated</span>
                            </label>
                            <label className="subtitle-checkbox">
                              <input
                                type="checkbox"
                                checked={embedSubs}
                                onChange={(e) => setEmbedSubs(e.target.checked)}
                              />
                              <span>Embed in video</span>
                            </label>
                          </div>
                          <div className="subtitle-format">
                            <span className="format-label">Format:</span>
                            <select
                              value={subFormat}
                              onChange={(e) => setSubFormat(e.target.value as 'srt' | 'vtt' | 'ass')}
                              className="subtitle-format-select"
                              title="Subtitle format"
                            >
                              <option value="srt">SRT</option>
                              <option value="vtt">VTT</option>
                              <option value="ass">ASS</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            className="btn-subtitle-only"
                            onClick={handleSubtitleOnlyDownload}
                            disabled={selectedSubtitleLangs.size === 0}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            DOWNLOAD SUBTITLE ONLY
                          </button>
                        </>
                      ) : (
                        <div className="no-subtitles">No subtitles available</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add to Queue Button */}
            <div className="panel-actions">
              <button
                type="button"
                className="btn-download"
                onClick={handleAddToQueue}
                disabled={isLoadingFormats || (contentInfo.type !== 'video' && playlistSelectionMode === 'selected' && selectedVideos.size === 0)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {contentInfo.type === 'video'
                  ? 'ADD TO QUEUE'
                  : playlistSelectionMode === 'selected' && selectedVideos.size > 0
                    ? `ADD SELECTED (${selectedVideos.size})`
                    : `ADD ALL (${contentInfo.entries?.length || 0})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
