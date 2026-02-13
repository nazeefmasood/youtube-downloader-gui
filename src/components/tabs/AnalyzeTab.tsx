import { useCallback, useEffect, useState, useRef } from 'react'
import { useDownloadStore } from '../../stores/downloadStore'
import type { SubtitleInfo, PlaylistSelectionMode } from '../../types'

interface AnalyzeTabProps {
  onAddToQueue: () => void
}

// Cache subtitles by video ID to avoid refetching
const subtitleCache = new Map<string, SubtitleInfo[]>()

export function AnalyzeTab({ onAddToQueue }: AnalyzeTabProps) {
  const [urlInput, setUrlInput] = useState('')
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [playlistSelectionMode, setPlaylistSelectionMode] = useState<PlaylistSelectionMode>('all')
  const [rangeStart, setRangeStart] = useState<number>(1)
  const [rangeEnd, setRangeEnd] = useState<number>(1)

  // Subtitle state - use ref to persist across tab switches
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [availableSubtitles, setAvailableSubtitles] = useState<SubtitleInfo[]>([])
  const lastFetchedVideoId = useRef<string | null>(null)
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

  // Fetch subtitles when video content is detected (with caching)
  useEffect(() => {
    const fetchSubtitles = async () => {
      if (contentInfo?.type === 'video' && contentInfo.id) {
        // Don't refetch if we already have subtitles for this video
        if (lastFetchedVideoId.current === contentInfo.id) {
          return
        }

        // Check cache first
        const cached = subtitleCache.get(contentInfo.id)
        if (cached) {
          setAvailableSubtitles(cached)
          lastFetchedVideoId.current = contentInfo.id
          return
        }

        setIsLoadingSubtitles(true)
        try {
          const url = `https://www.youtube.com/watch?v=${contentInfo.id}`
          const subs = await window.electronAPI.getSubtitles(url)
          subtitleCache.set(contentInfo.id, subs)  // Cache the results
          setAvailableSubtitles(subs)
          lastFetchedVideoId.current = contentInfo.id
        } catch (err) {
          console.error('Failed to fetch subtitles:', err)
          setAvailableSubtitles([])
        } finally {
          setIsLoadingSubtitles(false)
        }
      } else {
        setAvailableSubtitles([])
        lastFetchedVideoId.current = null
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
    // IMPORTANT: When embedding, only download selected languages (not all)
    // For playlists without embedding, use selected languages or default to English
    const getSubtitleLanguages = (): string[] => {
      const selected = Array.from(selectedSubtitleLangs)
      if (selected.length > 0) return selected

      // If no selection but embedding is on, default to English
      if (embedSubs) return ['en']

      // For playlists without specific selection and no embedding, use English
      return ['en']
    }

    const subOpts = subtitlesEnabled ? {
      enabled: true,
      languages: getSubtitleLanguages(),
      includeAutoGenerated: includeAutoSubs,
      format: subFormat,
      embedInVideo: embedSubs,
    } : undefined

    // Get subtitle display names for the queue item
    const getSubtitleDisplayNames = (): string | undefined => {
      if (!subOpts) return undefined
      const langCodes = subOpts.languages
      const names = langCodes.map(code => {
        const sub = availableSubtitles.find(s => s.lang === code)
        return sub?.langName || code.toUpperCase()
      })
      return names.join(', ')
    }
    const subtitleDisplayNames = getSubtitleDisplayNames()

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
        subtitleDisplayNames,
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
          subtitleDisplayNames,
        })
      }
    }

    onAddToQueue()
  }, [contentInfo, selectedFormat, formats, getVideosToDownload, onAddToQueue, subtitlesEnabled, availableSubtitles, selectedSubtitleLangs, includeAutoSubs, subFormat, embedSubs])

  // Handle subtitle-only download
  const handleSubtitleOnlyDownload = useCallback(async () => {
    if (!contentInfo || contentInfo.type !== 'video') return
    if (!availableSubtitles.length) return

    // Get subtitle display names for subtitle-only download
    const langNames = Array.from(selectedSubtitleLangs).map(code => {
      const sub = availableSubtitles.find(s => s.lang === code)
      return sub?.langName || code.toUpperCase()
    }).join(', ')

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
      subtitleDisplayNames: langNames,
    })

    onAddToQueue()
  }, [contentInfo, availableSubtitles, selectedSubtitleLangs, includeAutoSubs, subFormat, onAddToQueue])

  // Get video formats and audio formats separately
  const videoFormats = formats.filter(f => !f.isAudioOnly)
  const audioFormats = formats.filter(f => f.isAudioOnly)

  return (
    <div className="analyze-container">
      {/* URL Input Section */}
      <section className="analyze-input-section">
        <div className="input-header">
          <span className="input-label">TARGET_URL</span>
          <span className="input-status">
            {isDetecting && <span className="status-pulse">SCANNING</span>}
            {contentInfo && !isDetecting && <span className="status-ready">READY</span>}
          </span>
        </div>
        <div className="input-row">
          <div className="input-wrapper">
            <span className="input-prefix">{'>'}</span>
            <input
              type="text"
              className="analyze-input"
              placeholder="paste youtube url here..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDetecting}
              spellCheck={false}
            />
          </div>
          {isDetecting ? (
            <button type="button" className="analyze-btn abort" onClick={() => cancelDetection()}>
              <span className="btn-icon">✕</span>
              <span>ABORT</span>
            </button>
          ) : (
            <button
              type="button"
              className="analyze-btn"
              onClick={handleAnalyze}
              disabled={!urlInput.trim()}
            >
              <span className="btn-icon">▸</span>
              <span>ANALYZE</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <div className="analyze-main">
        {/* Left Panel - Content Preview */}
        <section className="analyze-preview">
          {/* Empty State */}
          {!contentInfo && !isDetecting && (
            <div className="preview-empty">
              <div className="empty-terminal">
                <div className="terminal-line">{'>'} Initializing video analyzer...</div>
                <div className="terminal-line">{'>'} Awaiting target URL<span className="blink">_</span></div>
                <div className="terminal-cursor" />
              </div>
              <div className="empty-hint">
                <span className="hint-key">PASTE</span>
                <span className="hint-text">a YouTube URL above to begin</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isDetecting && !contentInfo && (
            <div className="preview-loading">
              <div className="loading-grid">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="grid-cell" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <div className="loading-info">
                <span className="loading-title">ANALYZING TARGET</span>
                <span className="loading-sub">Fetching metadata from remote source...</span>
              </div>
              <div className="loading-progress">
                <div className="progress-bar" />
              </div>
            </div>
          )}

          {/* Content Loaded */}
          {contentInfo && !isDetecting && (
            <div className="preview-content">
              {/* Error Display */}
              {downloadError && (
                <div className="preview-error">
                  <span className="error-icon">⚠</span>
                  <span className="error-text">{downloadError}</span>
                </div>
              )}

              {/* Video Info Header */}
              <div className="preview-header">
                <div className="preview-thumb">
                  {contentInfo.thumbnail ? (
                    <img src={contentInfo.thumbnail} alt="" />
                  ) : (
                    <div className="thumb-placeholder">
                      <span>▶</span>
                    </div>
                  )}
                  <div className="thumb-overlay">
                    <span className={`type-badge ${contentInfo.type}`}>
                      {contentInfo.type.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="preview-meta">
                  <h2 className="preview-title">{contentInfo.title}</h2>
                  <div className="preview-stats">
                    {contentInfo.uploaderName && (
                      <span className="stat">
                        <span className="stat-label">UPLOADER</span>
                        <span className="stat-value">{contentInfo.uploaderName}</span>
                      </span>
                    )}
                    {contentInfo.videoCount && contentInfo.videoCount > 1 && (
                      <span className="stat">
                        <span className="stat-label">COUNT</span>
                        <span className="stat-value">{contentInfo.videoCount} videos</span>
                      </span>
                    )}
                    {contentInfo.duration && (
                      <span className="stat">
                        <span className="stat-label">DURATION</span>
                        <span className="stat-value">{formatDuration(contentInfo.duration)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Playlist/Channel Video List */}
              {contentInfo.entries && contentInfo.entries.length > 0 && (
                <div className="preview-list">
                  <div className="list-header">
                    <div className="list-info">
                      <span className="list-title">VIDEO QUEUE</span>
                      <span className="list-count">
                        {playlistSelectionMode === 'all'
                          ? `${contentInfo.entries.length} items`
                          : playlistSelectionMode === 'selected'
                            ? `${selectedVideos.size}/${contentInfo.entries.length} selected`
                            : `range: ${rangeStart}-${rangeEnd}`}
                      </span>
                    </div>
                    <div className="list-actions">
                      <button
                        type="button"
                        className={`list-btn ${selectedVideos.size === contentInfo.entries.length ? 'active' : ''}`}
                        onClick={handleSelectAll}
                      >
                        SELECT ALL
                      </button>
                      <button
                        type="button"
                        className="list-btn"
                        onClick={handleDeselectAll}
                        disabled={selectedVideos.size === 0}
                      >
                        DESELECT
                      </button>
                    </div>
                  </div>
                  <div className="list-items">
                    {contentInfo.entries.map((video, idx) => {
                      const isSelected = selectedVideos.has(video.index)
                      return (
                        <div
                          key={video.id}
                          className={`list-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleVideoSelect(video.index)}
                          style={{ animationDelay: `${idx * 0.03}s` }}
                        >
                          <div className={`item-check ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <span>✓</span>}
                          </div>
                          <span className="item-index">{String(video.index).padStart(2, '0')}</span>
                          <div className="item-thumb">
                            {video.thumbnail ? (
                              <img src={video.thumbnail} alt="" />
                            ) : (
                              <div className="thumb-placeholder-small">▶</div>
                            )}
                          </div>
                          <div className="item-info">
                            <span className="item-title">{video.title}</span>
                            <span className="item-duration">{formatDuration(video.duration)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Panel - Options */}
        {contentInfo && (
          <aside className="analyze-options">
            {/* Video Quality Section */}
            <div className="options-section">
              <div className="section-header">
                <span className="section-title">QUALITY</span>
                <span className="section-count">{videoFormats.length}</span>
              </div>
              <div className="section-content">
                {isLoadingFormats ? (
                  <div className="options-loading">
                    <div className="mini-spinner" />
                    <span>Loading formats...</span>
                  </div>
                ) : (
                  <div className="quality-grid">
                    {videoFormats.map((format, idx) => (
                      <button
                        key={format.formatId}
                        type="button"
                        className={`quality-item ${selectedFormat === format.formatId ? 'selected' : ''}`}
                        onClick={() => setSelectedFormat(format.formatId)}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <span className="quality-label">{format.quality}</span>
                        <span className="quality-meta">
                          <span className="quality-ext">{format.ext}</span>
                          {formatFileSize(format.filesize) && (
                            <span className="quality-size">{formatFileSize(format.filesize)}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Audio Only Section */}
            {audioFormats.length > 0 && (
              <div className="options-section">
                <div className="section-header">
                  <span className="section-title">AUDIO ONLY</span>
                  <span className="section-count">{audioFormats.length}</span>
                </div>
                <div className="section-content">
                  <div className="quality-grid">
                    {audioFormats.map((format, idx) => (
                      <button
                        key={format.formatId}
                        type="button"
                        className={`quality-item audio ${selectedFormat === format.formatId ? 'selected' : ''}`}
                        onClick={() => setSelectedFormat(format.formatId)}
                        style={{ animationDelay: `${(videoFormats.length + idx) * 0.05}s` }}
                      >
                        <span className="quality-label">{format.quality}</span>
                        <span className="quality-meta">
                          <span className="quality-ext">{format.ext}</span>
                          {formatFileSize(format.filesize) && (
                            <span className="quality-size">{formatFileSize(format.filesize)}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Subtitles Section */}
            <div className="options-section">
              <div className="section-header">
                <span className="section-title">SUBTITLES</span>
                <button
                  type="button"
                  className={`toggle-btn ${subtitlesEnabled ? 'on' : ''}`}
                  onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                >
                  <span className="toggle-slider" />
                </button>
              </div>
              {subtitlesEnabled && (
                <div className="section-content">
                  {contentInfo.type === 'video' ? (
                    <>
                      {isLoadingSubtitles ? (
                        <div className="options-loading">
                          <div className="mini-spinner" />
                          <span>Checking subtitles...</span>
                        </div>
                      ) : availableSubtitles.length > 0 ? (
                        <>
                          <div className="subtitle-grid">
                            {availableSubtitles
                              .filter(s => !s.isAutoGenerated || includeAutoSubs)
                              .slice(0, 12)
                              .map((sub, idx) => (
                                <button
                                  key={`${sub.lang}-${sub.isAutoGenerated}`}
                                  type="button"
                                  className={`subtitle-item ${selectedSubtitleLangs.has(sub.lang) ? 'selected' : ''}`}
                                  onClick={() => handleSubtitleLangToggle(sub.lang)}
                                  style={{ animationDelay: `${idx * 0.03}s` }}
                                >
                                  {sub.langName || sub.lang.toUpperCase()}
                                  {sub.isAutoGenerated && <span className="auto-tag">A</span>}
                                </button>
                              ))}
                          </div>
                          {selectedSubtitleLangs.size > 0 && (
                            <div className="subtitle-selected">
                              <span className="selected-label">SELECTED:</span>
                              <span className="selected-langs">
                                {Array.from(selectedSubtitleLangs).map(code => {
                                  const sub = availableSubtitles.find(s => s.lang === code)
                                  return sub?.langName || code.toUpperCase()
                                }).join(' + ')}
                              </span>
                            </div>
                          )}
                          <div className="subtitle-options">
                            <label className="sub-option">
                              <input
                                type="checkbox"
                                checked={includeAutoSubs}
                                onChange={(e) => setIncludeAutoSubs(e.target.checked)}
                              />
                              <span className="checkmark" />
                              <span>Auto-generated</span>
                            </label>
                            <label className="sub-option">
                              <input
                                type="checkbox"
                                checked={embedSubs}
                                onChange={(e) => setEmbedSubs(e.target.checked)}
                              />
                              <span className="checkmark" />
                              <span>Embed in video</span>
                            </label>
                          </div>
                          <div className="subtitle-format-row">
                            <span className="format-label">FORMAT</span>
                            <select
                              value={subFormat}
                              onChange={(e) => setSubFormat(e.target.value as 'srt' | 'vtt' | 'ass')}
                              className="format-select"
                            >
                              <option value="srt">SRT</option>
                              <option value="vtt">VTT</option>
                              <option value="ass">ASS</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            className="subtitle-dl-btn"
                            onClick={handleSubtitleOnlyDownload}
                            disabled={selectedSubtitleLangs.size === 0}
                          >
                            <span>↓</span>
                            <span>DOWNLOAD SUBTITLES ONLY</span>
                          </button>
                        </>
                      ) : (
                        <div className="no-subs">No subtitles available for this video</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="playlist-subs-note">
                        Subtitles will be downloaded for all videos in available languages
                      </div>
                      <div className="subtitle-options">
                        <label className="sub-option">
                          <input
                            type="checkbox"
                            checked={includeAutoSubs}
                            onChange={(e) => setIncludeAutoSubs(e.target.checked)}
                          />
                          <span className="checkmark" />
                          <span>Auto-generated</span>
                        </label>
                        <label className="sub-option">
                          <input
                            type="checkbox"
                            checked={embedSubs}
                            onChange={(e) => setEmbedSubs(e.target.checked)}
                          />
                          <span className="checkmark" />
                          <span>Embed in video</span>
                        </label>
                      </div>
                      <div className="subtitle-format-row">
                        <span className="format-label">FORMAT</span>
                        <select
                          value={subFormat}
                          onChange={(e) => setSubFormat(e.target.value as 'srt' | 'vtt' | 'ass')}
                          className="format-select"
                        >
                          <option value="srt">SRT</option>
                          <option value="vtt">VTT</option>
                          <option value="ass">ASS</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="options-action">
              <button
                type="button"
                className="add-queue-btn"
                onClick={handleAddToQueue}
                disabled={isLoadingFormats || (contentInfo.type !== 'video' && playlistSelectionMode === 'selected' && selectedVideos.size === 0)}
              >
                <span className="btn-plus">+</span>
                <span className="btn-text">
                  {contentInfo.type === 'video'
                    ? 'ADD TO QUEUE'
                    : playlistSelectionMode === 'selected' && selectedVideos.size > 0
                      ? `ADD ${selectedVideos.size} TO QUEUE`
                      : `ADD ALL (${contentInfo.entries?.length || 0})`}
                </span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
