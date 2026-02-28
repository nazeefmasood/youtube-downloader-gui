import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { useDownloadStore } from '../../stores/downloadStore'
import type { SubtitleInfo, PlaylistSelectionMode, VideoFormat, SearchResult } from '../../types'

export interface AnalyzeTabRef {
  pasteAndAnalyze: () => Promise<void>
  focusInput: () => void
}

interface AnalyzeTabProps {
  onAddToQueue: () => void
}

// Cache subtitles by video ID to avoid refetching
const subtitleCache = new Map<string, SubtitleInfo[]>()

// Multi-URL detection types
interface DetectedUrl {
  url: string
  type: 'video' | 'playlist' | 'channel' | 'unknown'
  id: string | null
  isValid: boolean
  selected: boolean
}

export const AnalyzeTab = forwardRef<AnalyzeTabRef, AnalyzeTabProps>(function AnalyzeTab({ onAddToQueue }, ref) {
  const [urlInput, setUrlInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [playlistSelectionMode, setPlaylistSelectionMode] = useState<PlaylistSelectionMode>('all')
  const [rangeStart, setRangeStart] = useState<number>(1)
  const [rangeEnd, setRangeEnd] = useState<number>(1)

  // Per-video quality overrides for playlists
  const [qualityOverrides, setQualityOverrides] = useState<Map<string, VideoFormat>>(new Map())
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [expandedVideoFormats, setExpandedVideoFormats] = useState<VideoFormat[]>([])
  const [isLoadingVideoFormats, setIsLoadingVideoFormats] = useState(false)

  // Subtitle state - use ref to persist across tab switches
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [availableSubtitles, setAvailableSubtitles] = useState<SubtitleInfo[]>([])
  const lastFetchedVideoId = useRef<string | null>(null)
  const [selectedSubtitleLangs, setSelectedSubtitleLangs] = useState<Set<string>>(new Set(['en']))
  const [includeAutoSubs, setIncludeAutoSubs] = useState(true)
  const [embedSubs, setEmbedSubs] = useState(false)
  const [subFormat, setSubFormat] = useState<'srt' | 'vtt' | 'ass'>('srt')
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false)

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<'url' | 'search'>('url')

  // Search result format selection state
  const [analyzingSearchResult, setAnalyzingSearchResult] = useState<SearchResult | null>(null)
  const [searchResultFormats, setSearchResultFormats] = useState<VideoFormat[]>([])
  const [isLoadingSearchFormats, setIsLoadingSearchFormats] = useState(false)
  const [selectedSearchFormat, setSelectedSearchFormat] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreResults, setHasMoreResults] = useState(true)

  // Multi-URL batch paste state
  const [showMultiUrlModal, setShowMultiUrlModal] = useState(false)
  const [detectedUrls, setDetectedUrls] = useState<DetectedUrl[]>([])
  const [isAddingBatch, setIsAddingBatch] = useState(false)

  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{ title: string; videoId: string } | null>(null)
  const [pendingDownload, setPendingDownload] = useState<(() => Promise<void>) | null>(null)

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState(false)

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
    url: storeUrl,  // Get the original URL from store as fallback
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

  // Detect if input is a URL or search query
  const isUrl = useCallback((input: string): boolean => {
    try {
      new URL(input)
      return true
    } catch {
      return false
    }
  }, [])

  // Parse a single URL and detect its type (YouTube video/playlist/channel, or other platform)
  const parseYouTubeUrl = useCallback((url: string): DetectedUrl => {
    try {
      const parsed = new URL(url)

      // Check if it's a valid HTTP/HTTPS URL
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { url, type: 'unknown', id: null, isValid: false, selected: false }
      }

      // Handle YouTube domains
      const isYouTube =
        parsed.hostname === 'www.youtube.com' ||
        parsed.hostname === 'youtube.com' ||
        parsed.hostname === 'm.youtube.com' ||
        parsed.hostname === 'youtu.be' ||
        parsed.hostname === 'www.youtu.be' ||
        parsed.hostname === 'music.youtube.com'

      // Handle Twitch domains
      const isTwitch =
        parsed.hostname === 'www.twitch.tv' ||
        parsed.hostname === 'twitch.tv' ||
        parsed.hostname === 'clips.twitch.tv'

      // Handle Twitter/X domains
      const isTwitter =
        parsed.hostname === 'twitter.com' ||
        parsed.hostname === 'www.twitter.com' ||
        parsed.hostname === 'x.com' ||
        parsed.hostname === 'www.x.com'

      // Handle TikTok domains
      const isTikTok =
        parsed.hostname === 'www.tiktok.com' ||
        parsed.hostname === 'tiktok.com' ||
        parsed.hostname === 'vm.tiktok.com'

      // Handle Instagram domains
      const isInstagram =
        parsed.hostname === 'www.instagram.com' ||
        parsed.hostname === 'instagram.com'

      // Handle Reddit domains
      const isReddit =
        parsed.hostname === 'www.reddit.com' ||
        parsed.hostname === 'reddit.com' ||
        parsed.hostname.endsWith('.reddit.com')

      // Handle Vimeo domains
      const isVimeo =
        parsed.hostname === 'vimeo.com' ||
        parsed.hostname === 'www.vimeo.com' ||
        parsed.hostname === 'player.vimeo.com'

      // For non-YouTube platforms, mark as video and let yt-dlp handle it
      if (isTwitch || isTwitter || isTikTok || isInstagram || isReddit || isVimeo) {
        return {
          url,
          type: 'video',
          id: parsed.pathname.split('/').filter(Boolean).pop() || null,
          isValid: true,
          selected: true,
        }
      }

      if (!isYouTube) {
        // Unknown platform - still try it (yt-dlp supports 1000+ sites)
        return {
          url,
          type: 'video',
          id: null,
          isValid: true,
          selected: true,
        }
      }

      // Handle youtu.be short links
      if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
        const videoId = parsed.pathname.slice(1)
        if (videoId) {
          return { url, type: 'video', id: videoId, isValid: true, selected: true }
        }
        return { url, type: 'unknown', id: null, isValid: false, selected: false }
      }

      // Handle youtube.com URLs
      const pathname = parsed.pathname

      // Playlist: /playlist?list=PL...
      if (pathname === '/playlist') {
        const listId = parsed.searchParams.get('list')
        if (listId) {
          return { url, type: 'playlist', id: listId, isValid: true, selected: true }
        }
        return { url, type: 'unknown', id: null, isValid: false, selected: false }
      }

      // Channel: /channel/UC... or /@username or /c/customname
      if (pathname.startsWith('/channel/')) {
        const channelId = pathname.split('/')[2]
        if (channelId) {
          return { url, type: 'channel', id: channelId, isValid: true, selected: true }
        }
      } else if (pathname.startsWith('/@')) {
        const username = pathname.slice(2)
        if (username) {
          return { url, type: 'channel', id: username, isValid: true, selected: true }
        }
      } else if (pathname.startsWith('/c/')) {
        const customName = pathname.split('/')[2]
        if (customName) {
          return { url, type: 'channel', id: customName, isValid: true, selected: true }
        }
      } else if (pathname.startsWith('/user/')) {
        const username = pathname.split('/')[2]
        if (username) {
          return { url, type: 'channel', id: username, isValid: true, selected: true }
        }
      }

      // Video: /watch?v=... (may also have &list= for playlist context)
      if (pathname === '/watch' || pathname === '/watch/') {
        const videoId = parsed.searchParams.get('v')
        if (videoId) {
          return { url, type: 'video', id: videoId, isValid: true, selected: true }
        }
      }

      // Shorts: /shorts/VIDEO_ID
      if (pathname.startsWith('/shorts/')) {
        const videoId = pathname.split('/')[2]
        if (videoId) {
          return { url, type: 'video', id: videoId, isValid: true, selected: true }
        }
      }

      // Live: /live/VIDEO_ID
      if (pathname.startsWith('/live/')) {
        const videoId = pathname.split('/')[2]
        if (videoId) {
          return { url, type: 'video', id: videoId, isValid: true, selected: true }
        }
      }

      // Embed: /embed/VIDEO_ID
      if (pathname.startsWith('/embed/')) {
        const videoId = pathname.split('/')[2]
        if (videoId) {
          return { url, type: 'video', id: videoId, isValid: true, selected: true }
        }
      }

      return { url, type: 'unknown', id: null, isValid: false, selected: false }
    } catch {
      return { url, type: 'unknown', id: null, isValid: false, selected: false }
    }
  }, [])

  // Parse multiple URLs from text (newline or comma separated)
  const parseMultipleUrls = useCallback((text: string): DetectedUrl[] => {
    // Split by newlines, commas, or both
    const lines = text
      .split(/[\n,]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0)

    const results: DetectedUrl[] = []
    const seenUrls = new Set<string>()

    for (const line of lines) {
      // Try to extract URL from the line (might have surrounding text)
      let urlMatch = line

      // If it looks like it might contain a URL, try to extract it
      const urlPattern = /(https?:\/\/[^\s]+)/i
      const match = line.match(urlPattern)
      if (match) {
        urlMatch = match[1]
      } else if (!line.startsWith('http')) {
        // Skip lines that don't look like URLs
        continue
      }

      // Normalize URL (remove trailing punctuation)
      urlMatch = urlMatch.replace(/[.,;:!?\])]+$/, '')

      // Deduplicate
      if (seenUrls.has(urlMatch)) {
        continue
      }
      seenUrls.add(urlMatch)

      const parsed = parseYouTubeUrl(urlMatch)
      results.push(parsed)
    }

    return results
  }, [parseYouTubeUrl])

  // Handle YouTube search
  const handleSearch = useCallback(async () => {
    if (!urlInput.trim()) return

    setIsSearching(true)
    setSearchError(null)
    setHasSearched(true)
    setHasMoreResults(true)

    try {
      const results = await window.electronAPI.searchYouTube(urlInput.trim(), 20)
      setSearchResults(results)
      // If we got less than requested, there are no more results
      setHasMoreResults(results.length === 20)
    } catch (err) {
      console.error('Search failed:', err)
      setSearchError(err instanceof Error ? err.message : 'Search failed')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [urlInput])

  // Handle loading more search results
  const handleLoadMore = useCallback(async () => {
    if (!urlInput.trim() || isLoadingMore || !hasMoreResults) return

    setIsLoadingMore(true)

    try {
      // Load next batch (current count + 20 more)
      const currentCount = searchResults.length
      const totalNeeded = currentCount + 20
      const results = await window.electronAPI.searchYouTube(urlInput.trim(), totalNeeded)
      // Only append the NEW results (slice from current count to end)
      const newResults = results.slice(currentCount)
      setSearchResults(prev => [...prev, ...newResults])
      // If we got less than requested, there are no more results
      setHasMoreResults(results.length === totalNeeded)
    } catch (err) {
      console.error('Load more failed:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [urlInput, isLoadingMore, hasMoreResults, searchResults.length])

  // Unified handler - detect URL vs search based on input
  const handleAnalyze = useCallback(() => {
    if (!urlInput.trim()) return

    // Check if input is a URL
    if (isUrl(urlInput.trim())) {
      // It's a URL - analyze it
      setInputMode('url')
      detectUrl(urlInput.trim())
    } else {
      // It's a search query - search YouTube
      setInputMode('search')
      handleSearch()
    }
  }, [urlInput, detectUrl, isUrl, handleSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalyze()
    }
  }, [handleAnalyze])

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus()
    },
    pasteAndAnalyze: async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text.trim()) {
          setUrlInput(text.trim())
          // Trigger analyze after setting the input
          if (isUrl(text.trim())) {
            setInputMode('url')
            detectUrl(text.trim())
          } else {
            setInputMode('search')
            handleSearch()
          }
        }
      } catch (error) {
        // Fallback: just focus the input
        inputRef.current?.focus()
      }
    }
  }), [detectUrl, isUrl, handleSearch])

  // Handle paste event to detect multiple URLs
  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    // Get dropped text (URL)
    const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')
    if (droppedText.trim()) {
      setUrlInput(droppedText.trim())
      // Auto-analyze the dropped URL
      setTimeout(() => {
        handleAnalyze()
      }, 100)
    }
  }, [handleAnalyze])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    const urls = parseMultipleUrls(pastedText)

    // If multiple URLs detected, show the preview modal
    if (urls.length > 1) {
      e.preventDefault()
      setDetectedUrls(urls)
      setShowMultiUrlModal(true)
    }
    // If only one URL, let the default paste behavior happen
    // and it will be handled by the normal analyze flow
  }, [parseMultipleUrls])

  // Multi-URL modal handlers
  const handleMultiUrlToggle = useCallback((index: number) => {
    setDetectedUrls(prev => {
      const next = [...prev]
      next[index] = { ...next[index], selected: !next[index].selected }
      return next
    })
  }, [])

  const handleMultiUrlSelectAll = useCallback(() => {
    setDetectedUrls(prev => prev.map(u => ({ ...u, selected: true })))
  }, [])

  const handleMultiUrlDeselectAll = useCallback(() => {
    setDetectedUrls(prev => prev.map(u => ({ ...u, selected: false })))
  }, [])

  const handleMultiUrlSelectValid = useCallback(() => {
    setDetectedUrls(prev => prev.map(u => ({ ...u, selected: u.isValid })))
  }, [])

  const handleMultiUrlCancel = useCallback(() => {
    setShowMultiUrlModal(false)
    setDetectedUrls([])
  }, [])

  const handleMultiUrlAddSelected = useCallback(async () => {
    const selectedUrls = detectedUrls.filter(u => u.selected && u.isValid)
    if (selectedUrls.length === 0) return

    setIsAddingBatch(true)
    const batchGroupId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

    try {
      for (const item of selectedUrls) {
        const srcType = item.type === 'playlist' ? 'playlist' : item.type === 'channel' ? 'channel' : 'single'

        await window.electronAPI.addToQueue({
          url: item.url,
          title: item.type === 'video' ? `Video ${item.id}` : item.type === 'playlist' ? `Playlist ${item.id}` : `Channel ${item.id}`,
          format: 'bestvideo+bestaudio/best',
          qualityLabel: 'Best Quality',
          audioOnly: false,
          source: 'app',
          sourceType: srcType,
          contentType: 'video',
          batchGroupId,
        })
      }

      // Close modal and reset state
      setShowMultiUrlModal(false)
      setDetectedUrls([])
      onAddToQueue()
    } catch (error) {
      console.error('Failed to add batch URLs:', error)
    } finally {
      setIsAddingBatch(false)
    }
  }, [detectedUrls, onAddToQueue])

  // Analyze search result to get available formats
  const handleAnalyzeSearchResult = useCallback(async (result: SearchResult) => {
    // For playlists/channels, add directly with best quality (no format selection)
    if (result.type !== 'video') {
      await window.electronAPI.addToQueue({
        url: result.url,
        title: result.title,
        thumbnail: result.thumbnail,
        channel: result.uploader,
        format: 'bestvideo+bestaudio/best',
        qualityLabel: 'Best Quality',
        audioOnly: false,
        source: 'app',
        sourceType: result.type === 'playlist' ? 'playlist' : 'channel',
        contentType: 'video',
      })
      onAddToQueue()
      return
    }

    // For videos, fetch formats and show selection
    setAnalyzingSearchResult(result)
    setIsLoadingSearchFormats(true)
    setSearchResultFormats([])
    setSelectedSearchFormat(null)

    try {
      const fetchedFormats = await window.electronAPI.getFormats(result.url)
      setSearchResultFormats(fetchedFormats)
      // Auto-select best quality
      const videoFormats = fetchedFormats.filter((f: VideoFormat) => !f.isAudioOnly)
      if (videoFormats.length > 0) {
        setSelectedSearchFormat(videoFormats[0].formatId)
      }
    } catch (error) {
      console.error('Failed to fetch formats:', error)
      // Fall back to best quality
      setSearchResultFormats([])
      setSelectedSearchFormat('bestvideo+bestaudio/best')
    } finally {
      setIsLoadingSearchFormats(false)
    }
  }, [onAddToQueue])

  // Confirm adding search result to queue with selected format
  const handleConfirmSearchResultToQueue = useCallback(async () => {
    if (!analyzingSearchResult) return

    const formatToUse = selectedSearchFormat || 'bestvideo+bestaudio/best'
    const formatObj = searchResultFormats.find((f) => f.formatId === formatToUse)
    const isAudio = formatObj?.isAudioOnly || false

    await window.electronAPI.addToQueue({
      url: analyzingSearchResult.url,
      title: analyzingSearchResult.title,
      thumbnail: analyzingSearchResult.thumbnail,
      channel: analyzingSearchResult.uploader,
      format: formatToUse,
      qualityLabel: formatObj?.quality || (isAudio ? 'Audio' : 'Best Quality'),
      audioOnly: isAudio,
      source: 'app',
      sourceType: 'single',
      contentType: isAudio ? 'audio' : 'video',
    })

    // Reset and close
    setAnalyzingSearchResult(null)
    setSearchResultFormats([])
    setSelectedSearchFormat(null)
    onAddToQueue()
  }, [analyzingSearchResult, selectedSearchFormat, searchResultFormats, onAddToQueue])

  // Cancel format selection for search result
  const handleCancelSearchFormatSelection = useCallback(() => {
    setAnalyzingSearchResult(null)
    setSearchResultFormats([])
    setSelectedSearchFormat(null)
  }, [])

  const formatViewCount = (count?: number) => {
    if (!count) return ''
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`
    return `${count} views`
  }

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
          // Use original URL for multi-platform support
          const url = contentInfo.url
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

  // Cache per-video formats to avoid re-fetching
  const videoFormatCache = useRef<Map<string, VideoFormat[]>>(new Map())

  const handleVideoExpand = useCallback(async (videoId: string) => {
    if (expandedVideoId === videoId) {
      setExpandedVideoId(null)
      return
    }
    setExpandedVideoId(videoId)

    // Check cache first
    const cached = videoFormatCache.current.get(videoId)
    if (cached) {
      setExpandedVideoFormats(cached)
      return
    }

    setIsLoadingVideoFormats(true)
    setExpandedVideoFormats([])
    try {
      // Find the video entry to get its URL for multi-platform support
      const videoEntry = contentInfo?.entries?.find(e => e.id === videoId)
      const url = videoEntry?.url || (contentInfo?.url ? `${contentInfo.url}` : null)
      if (!url) {
        throw new Error('Video URL not found')
      }
      const fmts = await window.electronAPI.getFormats(url)
      videoFormatCache.current.set(videoId, fmts)
      setExpandedVideoFormats(fmts)
    } catch (err) {
      console.error('Failed to fetch video formats:', err)
      setExpandedVideoFormats([])
    } finally {
      setIsLoadingVideoFormats(false)
    }
  }, [expandedVideoId, contentInfo])

  const handleSetQualityOverride = useCallback((videoId: string, format: VideoFormat) => {
    setQualityOverrides(prev => {
      const next = new Map(prev)
      next.set(videoId, format)
      return next
    })
  }, [])

  const handleClearQualityOverride = useCallback((videoId: string) => {
    setQualityOverrides(prev => {
      const next = new Map(prev)
      next.delete(videoId)
      return next
    })
    if (expandedVideoId === videoId) {
      setExpandedVideoId(null)
    }
  }, [expandedVideoId])

  // Determine which formats to show in the side panel
  // If a playlist video is expanded, show its formats; otherwise show global formats
  const expandedVideoTitle = expandedVideoId
    ? contentInfo?.entries?.find(e => e.id === expandedVideoId)?.title
    : null

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
    // For playlists: "Best Quality (720p)" is misleading since each video has its own max,
    // so strip the resolution qualifier — yt-dlp's "bestvideo+bestaudio/best" picks each video's actual best
    const isPlaylistOrChannel = contentInfo.type !== 'video'
    let qualityLabel = formatObj?.quality || (isAudio ? 'Audio' : 'Video')
    if (isPlaylistOrChannel && formatToUse === 'bestvideo+bestaudio/best') {
      qualityLabel = 'Best Quality'
    }

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
      // Check for duplicate before adding
      // Use original URL for multi-platform support, fallback to store URL
      const videoUrl = contentInfo.url || storeUrl
      if (!videoUrl) {
        console.error('No URL available for download')
        return
      }
      try {
        const duplicateCheck = await window.electronAPI.checkDuplicate(videoUrl)
        if (duplicateCheck.isDuplicate) {
          setDuplicateInfo({
            title: duplicateCheck.title || contentInfo.title,
            videoId: duplicateCheck.videoId || contentInfo.id,
          })
          setShowDuplicateModal(true)
          setPendingDownload(() => async () => {
            await window.electronAPI.addToQueue({
              url: videoUrl,
              title: contentInfo.title,
              thumbnail: contentInfo.thumbnail,
              channel: contentInfo.uploaderName,
              format: formatToUse,
              qualityLabel,
              audioOnly: isAudio,
              source: 'app',
              sourceType: 'single',
              contentType: getContentType(),
              subtitleOptions: subOpts,
              subtitleDisplayNames,
            })
            onAddToQueue()
          })
          return
        }
      } catch (error) {
        console.error('Failed to check for duplicate:', error)
        // Continue with download if check fails
      }

      await window.electronAPI.addToQueue({
        url: videoUrl,
        title: contentInfo.title,
        thumbnail: contentInfo.thumbnail,
        channel: contentInfo.uploaderName,
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
      const batchGroupId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

      // Check for duplicates in playlist/channel
      let skippedCount = 0
      const duplicates: string[] = []

      for (const entry of videosToDownload) {
        // Use entry URL for multi-platform support, skip if no URL available
        const entryUrl = entry.url
        if (!entryUrl) {
          console.warn('Skipping entry with no URL:', entry.id, entry.title)
          continue
        }
        try {
          const duplicateCheck = await window.electronAPI.checkDuplicate(entryUrl)
          if (duplicateCheck.isDuplicate) {
            skippedCount++
            duplicates.push(entry.title)
            continue // Skip this video
          }
        } catch (error) {
          console.error('Failed to check duplicate for:', entry.id, error)
          // Continue with download if check fails
        }

        const override = qualityOverrides.get(entry.id)
        const entryFormat = override?.formatId || formatToUse
        const entryIsAudio = override?.isAudioOnly ?? isAudio
        const entryQualityLabel = override?.quality || qualityLabel
        await window.electronAPI.addToQueue({
          url: entryUrl,
          title: entry.title,
          thumbnail: entry.thumbnail,
          channel: contentInfo.uploaderName,
          format: entryFormat,
          qualityLabel: entryQualityLabel,
          audioOnly: entryIsAudio,
          source: 'app',
          sourceType: srcType,
          contentType: entryIsAudio ? 'audio' : (subOpts ? 'video+sub' : 'video'),
          subtitleOptions: subOpts,
          subtitleDisplayNames,
          batchGroupId,
        })
      }

      // Show summary if duplicates were skipped
      if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} duplicate(s) from ${srcType}`)
        // Could show a toast notification here
      }
    }

    onAddToQueue()
  }, [contentInfo, selectedFormat, formats, getVideosToDownload, onAddToQueue, subtitlesEnabled, availableSubtitles, selectedSubtitleLangs, includeAutoSubs, subFormat, embedSubs, qualityOverrides, storeUrl])

  // Handle subtitle-only download
  const handleSubtitleOnlyDownload = useCallback(async () => {
    if (!contentInfo || contentInfo.type !== 'video') return
    if (!availableSubtitles.length) return

    // Get subtitle display names for subtitle-only download
    const langNames = Array.from(selectedSubtitleLangs).map(code => {
      const sub = availableSubtitles.find(s => s.lang === code)
      return sub?.langName || code.toUpperCase()
    }).join(', ')

    // Use original URL for multi-platform support, fallback to store URL
    const videoUrl = contentInfo.url || storeUrl
    if (!videoUrl) {
      console.error('No URL available for subtitle download')
      return
    }

    await window.electronAPI.addToQueue({
      url: videoUrl,
      title: contentInfo.title,
      thumbnail: contentInfo.thumbnail,
      channel: contentInfo.uploaderName,
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
  }, [contentInfo, availableSubtitles, selectedSubtitleLangs, includeAutoSubs, subFormat, onAddToQueue, storeUrl])

  // Get video formats and audio formats separately
  const videoFormats = formats.filter(f => !f.isAudioOnly)
  const audioFormats = formats.filter(f => f.isAudioOnly)

  return (
    <div className="analyze-container">
      {/* URL Input Section with Drag & Drop */}
      <section
        className={`analyze-input-section ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
              ref={inputRef}
              type="text"
              className="analyze-input"
              placeholder="search youtube or paste a url..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
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
        {/* Left Panel - Content Preview or Search Results */}
        <section className="analyze-preview">
          {/* Search Mode - Empty State (before search) */}
          {inputMode === 'search' && !hasSearched && !isSearching && (
            <div className="preview-empty">
              <div className="empty-terminal">
                <div className="terminal-line">{'>'} Search mode activated</div>
                <div className="terminal-line">{'>'} Type what you're looking for<span className="blink">_</span></div>
              </div>
              <div className="empty-hint">
                <span className="hint-key">SEARCH</span>
                <span className="hint-text">for any video, playlist, or channel</span>
              </div>
            </div>
          )}

          {/* Search Mode - No Results */}
          {inputMode === 'search' && hasSearched && !isSearching && searchResults.length === 0 && !searchError && (
            <div className="preview-empty">
              <div className="empty-terminal">
                <div className="terminal-line">{'>'} Search completed</div>
                <div className="terminal-line">{'>'} No results found<span className="blink">_</span></div>
              </div>
              <div className="empty-hint">
                <span className="hint-key">TRY</span>
                <span className="hint-text">a different search term</span>
              </div>
            </div>
          )}

          {/* Search Mode - Show Search Results */}
          {inputMode === 'search' && hasSearched && !isSearching && searchResults.length > 0 && !contentInfo && (
            <div className="search-results-container">
              <div className="search-header">
                <span className="search-title">SEARCH RESULTS</span>
                <span className="search-count">{searchResults.length} found</span>
              </div>
              {searchError && (
                <div className="search-error">
                  <span className="error-icon">⚠</span>
                  <span className="error-text">{searchError}</span>
                </div>
              )}
              <div className="results-grid">
                {searchResults.map((result, idx) => (
                  <div
                    key={result.id}
                    className="search-result-card"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div className="result-thumb">
                      {result.thumbnail ? (
                        <img src={result.thumbnail} alt="" />
                      ) : (
                        <div className="thumb-placeholder">▶</div>
                      )}
                      <span className="result-duration">{formatDuration(result.duration)}</span>
                      {result.type !== 'video' && (
                        <span className="result-type-badge">{result.type.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="result-info">
                      <span className="result-title">{result.title}</span>
                      <div className="result-meta">
                        {result.uploader && (
                          <span className="result-uploader">{result.uploader}</span>
                        )}
                        {result.viewCount && (
                          <span className="result-views">{formatViewCount(result.viewCount)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="result-add-btn"
                      onClick={() => handleAnalyzeSearchResult(result)}
                    >
                      <span>+</span>
                      <span>{result.type === 'video' ? 'SELECT QUALITY' : 'ADD TO QUEUE'}</span>
                    </button>
                  </div>
                ))}
              </div>
              {/* Load More Button */}
              {hasMoreResults && searchResults.length > 0 && (
                <div className="load-more-container">
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <span className="loading-spinner small" />
                        <span>LOADING...</span>
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        <span>LOAD MORE</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Search Result Format Selection Modal */}
          {analyzingSearchResult && (
            <div className="format-selection-overlay">
              <div className="format-selection-modal">
                <div className="modal-header">
                  <span className="modal-title">SELECT QUALITY</span>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={handleCancelSearchFormatSelection}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-video-info">
                  {analyzingSearchResult.thumbnail && (
                    <img src={analyzingSearchResult.thumbnail} alt="" className="modal-thumb" />
                  )}
                  <div className="modal-video-details">
                    <span className="modal-video-title">{analyzingSearchResult.title}</span>
                    {analyzingSearchResult.uploader && (
                      <span className="modal-video-uploader">{analyzingSearchResult.uploader}</span>
                    )}
                  </div>
                </div>
                {isLoadingSearchFormats ? (
                  <div className="modal-loading">
                    <div className="loading-spinner" />
                    <span>Loading formats...</span>
                  </div>
                ) : (
                  <div className="modal-format-list">
                    {/* Video formats */}
                    {searchResultFormats.filter(f => !f.isAudioOnly).length > 0 && (
                      <div className="format-section">
                        <span className="format-section-title">VIDEO</span>
                        <div className="format-options">
                          {searchResultFormats.filter(f => !f.isAudioOnly).map((format) => (
                            <button
                              key={format.formatId}
                              type="button"
                              className={`format-option ${selectedSearchFormat === format.formatId ? 'selected' : ''}`}
                              onClick={() => setSelectedSearchFormat(format.formatId)}
                            >
                              <span className="format-quality">{format.quality}</span>
                              <span className="format-meta">
                                <span>{format.ext}</span>
                                {format.filesize && <span>{formatFileSize(format.filesize)}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Audio formats */}
                    {searchResultFormats.filter(f => f.isAudioOnly).length > 0 && (
                      <div className="format-section">
                        <span className="format-section-title">AUDIO ONLY</span>
                        <div className="format-options">
                          {searchResultFormats.filter(f => f.isAudioOnly).map((format) => (
                            <button
                              key={format.formatId}
                              type="button"
                              className={`format-option ${selectedSearchFormat === format.formatId ? 'selected' : ''}`}
                              onClick={() => setSelectedSearchFormat(format.formatId)}
                            >
                              <span className="format-quality">{format.quality}</span>
                              <span className="format-meta">
                                <span>{format.ext}</span>
                                {format.filesize && <span>{formatFileSize(format.filesize)}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Fallback if no formats loaded */}
                    {searchResultFormats.length === 0 && !isLoadingSearchFormats && (
                      <div className="format-section">
                        <span className="format-section-title">QUALITY</span>
                        <div className="format-options">
                          <button
                            type="button"
                            className={`format-option ${selectedSearchFormat === 'bestvideo+bestaudio/best' ? 'selected' : ''}`}
                            onClick={() => setSelectedSearchFormat('bestvideo+bestaudio/best')}
                          >
                            <span className="format-quality">Best Quality</span>
                            <span className="format-meta">Auto</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-btn cancel"
                    onClick={handleCancelSearchFormatSelection}
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    className="modal-btn confirm"
                    onClick={handleConfirmSearchResultToQueue}
                    disabled={isLoadingSearchFormats}
                  >
                    ADD TO QUEUE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Multi-URL Batch Preview Modal */}
          {showMultiUrlModal && (
            <div className="multi-url-overlay">
              <div className="multi-url-modal">
                <div className="multi-url-header">
                  <span className="multi-url-title">BATCH URL DETECTED</span>
                  <button
                    type="button"
                    className="multi-url-close"
                    onClick={handleMultiUrlCancel}
                    disabled={isAddingBatch}
                  >
                    x
                  </button>
                </div>
                <div className="multi-url-summary">
                  <span className="summary-text">
                    Found <span className="summary-count">{detectedUrls.length}</span> URLs
                    ({detectedUrls.filter(u => u.isValid).length} valid YouTube)
                  </span>
                  <div className="summary-actions">
                    <button type="button" className="summary-btn" onClick={handleMultiUrlSelectAll}>
                      SELECT ALL
                    </button>
                    <button type="button" className="summary-btn" onClick={handleMultiUrlDeselectAll}>
                      DESELECT
                    </button>
                    <button type="button" className="summary-btn" onClick={handleMultiUrlSelectValid}>
                      VALID ONLY
                    </button>
                  </div>
                </div>
                <div className="multi-url-list">
                  {detectedUrls.map((item, idx) => (
                    <div
                      key={`${item.url}-${idx}`}
                      className={`multi-url-item ${item.selected ? 'selected' : ''} ${!item.isValid ? 'invalid' : ''}`}
                      onClick={() => handleMultiUrlToggle(idx)}
                    >
                      <div className={`item-checkbox ${item.selected ? 'checked' : ''}`}>
                        {item.selected && <span>v</span>}
                      </div>
                      <span className={`item-type-badge ${item.type}`}>{item.type.toUpperCase()}</span>
                      <div className="item-url-info">
                        <span className="item-url">{item.url}</span>
                        {item.id && <span className="item-id">ID: {item.id}</span>}
                      </div>
                      {!item.isValid && (
                        <span className="item-invalid-label">NOT YOUTUBE</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="multi-url-actions">
                  <button
                    type="button"
                    className="multi-url-btn cancel"
                    onClick={handleMultiUrlCancel}
                    disabled={isAddingBatch}
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    className="multi-url-btn confirm"
                    onClick={handleMultiUrlAddSelected}
                    disabled={isAddingBatch || detectedUrls.filter(u => u.selected && u.isValid).length === 0}
                  >
                    {isAddingBatch ? (
                      <>
                        <span className="btn-spinner" />
                        <span>ADDING...</span>
                      </>
                    ) : (
                      <>
                        <span>+</span>
                        <span>ADD {detectedUrls.filter(u => u.selected && u.isValid).length} TO QUEUE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Detection Modal */}
          {showDuplicateModal && duplicateInfo && (
            <div className="multi-url-overlay">
              <div className="multi-url-modal duplicate-modal">
                <div className="multi-url-header">
                  <span className="multi-url-title">DUPLICATE DETECTED</span>
                  <button
                    type="button"
                    className="multi-url-close"
                    onClick={() => {
                      setShowDuplicateModal(false)
                      setDuplicateInfo(null)
                      setPendingDownload(null)
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="duplicate-content">
                  <div className="duplicate-icon">⚠</div>
                  <p className="duplicate-message">
                    This video has already been downloaded:
                  </p>
                  <p className="duplicate-title">{duplicateInfo.title}</p>
                  <p className="duplicate-hint">
                    Do you want to download it again?
                  </p>
                </div>
                <div className="multi-url-actions">
                  <button
                    type="button"
                    className="multi-url-btn cancel"
                    onClick={() => {
                      setShowDuplicateModal(false)
                      setDuplicateInfo(null)
                      setPendingDownload(null)
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    className="multi-url-btn confirm"
                    onClick={async () => {
                      setShowDuplicateModal(false)
                      setDuplicateInfo(null)
                      if (pendingDownload) {
                        await pendingDownload()
                        setPendingDownload(null)
                      }
                    }}
                  >
                    DOWNLOAD ANYWAY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search Mode - Loading */}
          {inputMode === 'search' && isSearching && (
            <div className="preview-loading">
              <div className="loading-grid">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="grid-cell" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <div className="loading-info">
                <span className="loading-title">SEARCHING YOUTUBE</span>
                <span className="loading-sub">Finding matching videos...</span>
              </div>
              <div className="loading-progress">
                <div className="progress-bar" />
              </div>
            </div>
          )}

          {/* URL Mode - Empty State */}
          {inputMode === 'url' && !contentInfo && !isDetecting && (
            <div className="preview-empty">
              <div className="empty-terminal">
                <div className="terminal-line">{'>'} Initializing analyzer...</div>
                <div className="terminal-line">{'>'} Enter a URL to analyze<span className="blink">_</span></div>
                <div className="terminal-cursor" />
              </div>
              <div className="empty-hint">
                <span className="hint-key">PASTE</span>
                <span className="hint-text">a YouTube link to get available formats</span>
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
                      const hasOverride = qualityOverrides.has(video.id)
                      const isExpanded = expandedVideoId === video.id
                      return (
                        <div key={video.id} style={{ animationDelay: `${idx * 0.03}s` }}>
                          <div
                            className={`list-item ${isSelected ? 'selected' : ''} ${hasOverride ? 'has-override' : ''}`}
                            onClick={() => handleVideoSelect(video.index)}
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
                              <span className="item-duration">
                                {formatDuration(video.duration)}
                                {hasOverride && (
                                  <span className="quality-override-badge" title="Custom quality set">
                                    {qualityOverrides.get(video.id)!.quality}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="item-quality-actions" onClick={(e) => e.stopPropagation()}>
                              {hasOverride && (
                                <button
                                  type="button"
                                  className="item-quality-clear"
                                  onClick={() => handleClearQualityOverride(video.id)}
                                  title="Reset to global quality"
                                >✕</button>
                              )}
                              <button
                                type="button"
                                className={`item-quality-btn ${isExpanded ? 'active' : ''}`}
                                onClick={() => handleVideoExpand(video.id)}
                                title="Set custom quality for this video"
                              >
                                <span className="quality-btn-icon">⚙</span>
                                <span className="quality-btn-text">{isExpanded ? 'CLOSE' : 'QUALITY'}</span>
                              </button>
                            </div>
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
            {/* Per-video quality header when a playlist item is selected */}
            {expandedVideoId && expandedVideoTitle && (
              <div className="options-section per-video-header">
                <div className="section-header">
                  <span className="section-title">VIDEO QUALITY</span>
                  <button
                    type="button"
                    className="per-video-close"
                    onClick={() => setExpandedVideoId(null)}
                  >✕</button>
                </div>
                <div className="per-video-info">
                  <span className="per-video-name">{expandedVideoTitle}</span>
                  {qualityOverrides.has(expandedVideoId) && (
                    <button
                      type="button"
                      className="per-video-reset"
                      onClick={() => handleClearQualityOverride(expandedVideoId)}
                    >RESET TO GLOBAL</button>
                  )}
                </div>
              </div>
            )}

            {/* Video Quality Section - shows per-video formats when expanded, global otherwise */}
            <div className="options-section">
              <div className="section-header">
                <span className="section-title">
                  {expandedVideoId ? 'SELECT QUALITY' : 'QUALITY'}
                </span>
                <span className="section-count">
                  {expandedVideoId
                    ? expandedVideoFormats.filter(f => !f.isAudioOnly).length
                    : videoFormats.length}
                </span>
              </div>
              <div className="section-content">
                {(expandedVideoId ? isLoadingVideoFormats : isLoadingFormats) ? (
                  <div className="options-loading">
                    <div className="mini-spinner" />
                    <span>Loading formats...</span>
                  </div>
                ) : (
                  <div className="quality-grid">
                    {(expandedVideoId
                      ? expandedVideoFormats.filter(f => !f.isAudioOnly)
                      : videoFormats
                    ).map((format, idx) => {
                      const isSelected = expandedVideoId
                        ? qualityOverrides.get(expandedVideoId)?.formatId === format.formatId
                        : selectedFormat === format.formatId
                      return (
                        <button
                          key={format.formatId}
                          type="button"
                          className={`quality-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (expandedVideoId) {
                              handleSetQualityOverride(expandedVideoId, format)
                            } else {
                              setSelectedFormat(format.formatId)
                            }
                          }}
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
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Audio Only Section */}
            {((expandedVideoId ? expandedVideoFormats : formats).filter(f => f.isAudioOnly).length > 0) && (
              <div className="options-section">
                <div className="section-header">
                  <span className="section-title">AUDIO ONLY</span>
                  <span className="section-count">
                    {(expandedVideoId ? expandedVideoFormats : formats).filter(f => f.isAudioOnly).length}
                  </span>
                </div>
                <div className="section-content">
                  <div className="quality-grid">
                    {(expandedVideoId
                      ? expandedVideoFormats.filter(f => f.isAudioOnly)
                      : audioFormats
                    ).map((format, idx) => {
                      const isSelected = expandedVideoId
                        ? qualityOverrides.get(expandedVideoId)?.formatId === format.formatId
                        : selectedFormat === format.formatId
                      return (
                        <button
                          key={format.formatId}
                          type="button"
                          className={`quality-item audio ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (expandedVideoId) {
                              handleSetQualityOverride(expandedVideoId, format)
                            } else {
                              setSelectedFormat(format.formatId)
                            }
                          }}
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
                      )
                    })}
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
})
