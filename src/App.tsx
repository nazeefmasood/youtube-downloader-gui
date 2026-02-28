import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { APP_VERSION } from "./version";
import { useDownloadStore } from "./stores/downloadStore";
import { AnalyzeTab } from "./components/tabs/AnalyzeTab";
import { DownloadsTab } from "./components/tabs/DownloadsTab";
import { DashboardTab } from "./components/tabs/DashboardTab";
import { UpdateModal } from "./components/UpdateModal";
import { ChangelogModal } from "./components/ChangelogModal";
import { ensureAudioContextReady, playNotificationSound } from "./utils/notificationSound";
import { applyTheme, getThemeByName, createCustomTheme, PRESET_THEMES } from "./utils/themes";
import type { DownloadProgress, LogEntry, UpdateInfo, UpdateProgress, UpdateStatus, PotTokenStatus, SoundNotificationMode } from "./types";

type ReactNode = React.ReactNode;

type View = "analyze" | "downloads" | "history" | "dashboard" | "settings";
type Theme = "dark" | "light";

// Detected URL for drag & drop
interface DetectedUrl {
  url: string;
  type: 'video' | 'playlist' | 'channel' | 'unknown';
  id: string | null;
  isValid: boolean;
  selected: boolean;
}

function App() {
  const [view, setView] = useState<View>("analyze");
  const [showSuccess, setShowSuccess] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiName, setConfettiName] = useState<string>('');
  const [binaryMissing, setBinaryMissing] = useState(false);
  const [binaryDownloading, setBinaryDownloading] = useState(false);
  const [binaryDownloadProgress, setBinaryDownloadProgress] = useState(0);
  const [binaryError, setBinaryError] = useState<string | null>(null);
  const [ffmpegMissing, setFfmpegMissing] = useState(false);
  const [ffmpegDownloading, setFfmpegDownloading] = useState(false);
  const [ffmpegDownloadProgress, setFfmpegDownloadProgress] = useState(0);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);

  // Update system state
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    info: null,
    progress: null,
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [updateNotification, setUpdateNotification] = useState<string | null>(null);

  // PO Token status
  const [potTokenStatus, setPotTokenStatus] = useState<PotTokenStatus | null>(null);
  const [potRestarting, setPotRestarting] = useState(false);

  // History search state
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "completed" | "failed" | "cancelled">("all");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const [showMultiUrlModal, setShowMultiUrlModal] = useState(false);
  const [detectedUrls, setDetectedUrls] = useState<DetectedUrl[]>([]);
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  const dragCounterRef = useRef(0);

  // Binary status for settings display
  const [binaryStatus, setBinaryStatus] = useState<{
    ytdlp: { installed: boolean; version: string | null; path: string | null };
    ffmpeg: { available: boolean; version: string | null; path: string | null };
    ffprobe: { available: boolean; path: string | null };
  } | null>(null);

  // Mini mode state
  const [isMiniMode, setIsMiniMode] = useState(false);

  // Close confirmation dialog state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const {
    contentInfo,
    isDownloading,
    downloadProgress,
    history,
    settings,
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
  } = useDownloadStore();

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("vidgrab-theme") as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  // Apply font size setting
  useEffect(() => {
    // Always set a font size - default to medium if not set
    const fontSize = settings.fontSize || 'medium';
    document.documentElement.setAttribute("data-font-size", fontSize);
  }, [settings.fontSize]);

  // Apply color theme based on settings
  useEffect(() => {
    const selectedTheme = settings.selectedTheme || 'purple';
    const customAccent = settings.customAccentColor || '#8b5cf6';

    let theme;
    if (selectedTheme === 'custom') {
      theme = createCustomTheme(customAccent);
    } else {
      theme = getThemeByName(selectedTheme) || getThemeByName('purple');
    }

    if (theme) {
      applyTheme(theme);
    }
  }, [settings.selectedTheme, settings.customAccentColor]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("vidgrab-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  }, [theme]);

  // Helper: highlight matching text in search results
  const highlightMatch = useCallback((text: string, query: string): ReactNode => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="history-search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  }, []);

  // Fuzzy match helper - calculates similarity score
  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    const str = text.toLowerCase();
    const q = query.toLowerCase();

    // Exact match
    if (str.includes(q)) return true;

    // If query is too short, don't do fuzzy match
    if (q.length < 2) return false;

    // Simple fuzzy match: check if all characters of query exist in text in order
    let queryIndex = 0;
    for (let i = 0; i < str.length && queryIndex < q.length; i++) {
      if (str[i] === q[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === q.length;
  }, []);

  // Filtered history based on search query and status filter
  const filteredHistory = useMemo(() => {
    let items = history;

    // Apply status filter
    if (historyStatusFilter !== "all") {
      items = items.filter((item) => item.status === historyStatusFilter);
    }

    // Apply search query
    if (historySearchQuery.trim()) {
      const query = historySearchQuery.trim();
      items = items.filter((item) =>
        fuzzyMatch(item.title, query) ||
        fuzzyMatch(item.url, query) ||
        fuzzyMatch(item.filePath || "", query) ||
        (item.type && fuzzyMatch(item.type, query))
      );
    }

    return items;
  }, [history, historySearchQuery, historyStatusFilter, fuzzyMatch]);

  // Handle keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search with Ctrl+F or / when in history view
      if ((e.ctrlKey && e.key === 'f') || (e.key === '/' && !e.ctrlKey)) {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement instanceof HTMLInputElement ||
                             activeElement instanceof HTMLTextAreaElement;

        if (view === "history" && !isInputFocused) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }

      // Clear search with Escape
      if (e.key === 'Escape' && historySearchQuery) {
        setHistorySearchQuery("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, historySearchQuery]);

  // Initialize settings, history, and queue
  useEffect(() => {
    loadSettings();
    loadHistory();
    loadQueue();
  }, [loadSettings, loadHistory, loadQueue]);

  // Check for binary on startup
  useEffect(() => {
    const checkBinary = async () => {
      const installed = await window.electronAPI.checkBinary();
      if (!installed) {
        setBinaryMissing(true);
      }
    };
    checkBinary();

    // Set up binary download listeners
    const unsubStart = window.electronAPI.onBinaryDownloadStart(() => {
      setBinaryDownloading(true);
      setBinaryDownloadProgress(0);
      setBinaryError(null);
    });

    const unsubProgress = window.electronAPI.onBinaryDownloadProgress(
      (data) => {
        setBinaryDownloadProgress(data.percent);
      },
    );

    const unsubComplete = window.electronAPI.onBinaryDownloadComplete(() => {
      setBinaryDownloading(false);
      setBinaryMissing(false);
      setBinaryDownloadProgress(100);
    });

    const unsubError = window.electronAPI.onBinaryDownloadError((data) => {
      setBinaryDownloading(false);
      setBinaryError(data.error);
    });

    return () => {
      unsubStart();
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, []);

  // Check for ffmpeg on startup
  useEffect(() => {
    const checkFfmpeg = async () => {
      const installed = await window.electronAPI.checkFfmpeg();
      if (!installed) {
        setFfmpegMissing(true);
      }
    };
    checkFfmpeg();

    // Reuse binary download listeners for ffmpeg (they share the same events)
    const unsubStart = window.electronAPI.onBinaryDownloadStart((data) => {
      // Check if it's ffmpeg being downloaded
      if (data.name.includes('ffmpeg')) {
        setFfmpegDownloading(true);
        setFfmpegDownloadProgress(0);
        setFfmpegError(null);
      }
    });

    const unsubProgress = window.electronAPI.onBinaryDownloadProgress(
      (data) => {
        if (ffmpegDownloading) {
          setFfmpegDownloadProgress(data.percent);
        }
      },
    );

    const unsubComplete = window.electronAPI.onBinaryDownloadComplete(() => {
      if (ffmpegDownloading) {
        setFfmpegDownloading(false);
        setFfmpegMissing(false);
        setFfmpegDownloadProgress(100);
      }
    });

    const unsubError = window.electronAPI.onBinaryDownloadError((data) => {
      if (ffmpegDownloading) {
        setFfmpegDownloading(false);
        setFfmpegError(data.error);
      }
    });

    return () => {
      unsubStart();
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [ffmpegDownloading]);

  // Set up update event listeners
  useEffect(() => {
    const unsubChecking = window.electronAPI.onUpdateChecking(() => {
      setUpdateStatus((prev) => ({ ...prev, checking: true, error: null }));
    });

    const unsubAvailable = window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateStatus((prev) => ({
        ...prev,
        checking: false,
        available: true,
        info,
      }));
      setShowUpdateModal(true);
    });

    const unsubNotAvailable = window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateStatus((prev) => ({ ...prev, checking: false, available: false }));
      setUpdateNotification("You're running the latest version!");
      setTimeout(() => setUpdateNotification(null), 3000);
    });

    const unsubProgress = window.electronAPI.onUpdateProgress((progress: UpdateProgress) => {
      setUpdateStatus((prev) => ({ ...prev, progress }));
    });

    const unsubDownloaded = window.electronAPI.onUpdateDownloaded(() => {
      setUpdateStatus((prev) => ({
        ...prev,
        downloading: false,
        downloaded: true,
        progress: null,
      }));
    });

    const unsubError = window.electronAPI.onUpdateError((error: string) => {
      setUpdateStatus((prev) => ({
        ...prev,
        checking: false,
        downloading: false,
        error,
      }));
      setUpdateNotification(`Update error: ${error}`);
      setTimeout(() => setUpdateNotification(null), 5000);
    });

    const unsubCancelled = window.electronAPI.onUpdateCancelled(() => {
      setUpdateStatus((prev) => ({
        ...prev,
        downloading: false,
        progress: null,
      }));
    });

    const unsubShowChangelog = window.electronAPI.onShowChangelog((_version: string) => {
      setShowChangelogModal(true);
      window.electronAPI.markChangelogSeen();
    });

    return () => {
      unsubChecking();
      unsubAvailable();
      unsubNotAvailable();
      unsubProgress();
      unsubDownloaded();
      unsubError();
      unsubCancelled();
      unsubShowChangelog();
    };
  }, []);

  // Subscribe to queue updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.onQueueUpdate((status) => {
      // Debug: Log all queue updates for debugging priority
      console.log('[App] Queue update received:', {
        itemCount: status.items.length,
        itemsWithPriority: status.items.filter(i => i.priority && i.priority > 0).map(i => ({ id: i.id, title: i.title.substring(0, 30), priority: i.priority }))
      })
      const previousStatus = queueStatus;
      setQueueStatus(status);

      // Play notification sounds for status changes
      if (settings.soundEnabled) {
        const notificationMode = settings.soundNotificationMode || 'every';

        // Check for items that completed since last update
        status.items.forEach((item) => {
          const prevItem = previousStatus.items.find((i) => i.id === item.id);
          if (prevItem && prevItem.status !== item.status) {
            if (item.status === 'completed' && prevItem.status === 'downloading') {
              // Determine if we should play sound based on notification mode
              const isPartOfBatch = !!item.batchGroupId;

              // For single videos (not part of batch), always play sound
              // For batch items, respect the notification mode
              if (!isPartOfBatch) {
                // Single video - always play sound
                playNotificationSound('success', settings.soundVolume);
              } else if (notificationMode === 'every' || notificationMode === 'each-item') {
                // Part of batch and mode is to play for each item
                playNotificationSound('success', settings.soundVolume);
              }
              // For 'batch-complete' mode with batch items, sound is played via onBatchComplete listener
            } else if (item.status === 'failed' && prevItem.status !== 'failed' && prevItem.status !== 'cancelled') {
              // Always play error sound
              playNotificationSound('error', settings.soundVolume);
            }
          }
        });
      }
    });
    return () => unsubscribe();
  }, [setQueueStatus, queueStatus, settings.soundEnabled, settings.soundVolume, settings.soundNotificationMode]);

  // Subscribe to batch complete events (for 'batch-complete' notification mode)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onBatchComplete(() => {
      // Play sound when entire batch/playlist is complete
      if (settings.soundEnabled && settings.soundNotificationMode === 'batch-complete') {
        playNotificationSound('success', settings.soundVolume);
      }
    });
    return () => unsubscribe();
  }, [settings.soundEnabled, settings.soundVolume, settings.soundNotificationMode]);

  // Subscribe to history updates (for queue items)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onHistoryAdded(() => {
      loadHistory();
    });
    return () => unsubscribe();
  }, [loadHistory]);

  // Subscribe to PO token status updates
  useEffect(() => {
    // Load initial status
    window.electronAPI.getPotTokenStatus().then(setPotTokenStatus).catch(console.error);

    const unsubscribe = window.electronAPI.onPotTokenStatus((status) => {
      setPotTokenStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to mini mode changes
  useEffect(() => {
    // Load initial state
    window.electronAPI.getMiniModeState().then(setIsMiniMode).catch(console.error);

    const unsubscribe = window.electronAPI.onMiniModeChanged((isMini) => {
      setIsMiniMode(isMini);
    });
    return () => unsubscribe();
  }, []);

  // Set up download event listeners
  useEffect(() => {
    const unsubProgress = window.electronAPI.onDownloadProgress(
      (progress: DownloadProgress) => {
        setDownloadProgress(progress);
      },
    );

    const unsubComplete = window.electronAPI.onDownloadComplete((result) => {
      setIsDownloading(false);
      if (result.success) {
        setDownloadProgress(null);
        setShowSuccess(true);
        const currentState = useDownloadStore.getState();
        if (
          currentState.contentInfo &&
          currentState.contentInfo.type === "video"
        ) {
          addToHistory({
            id: Date.now().toString(),
            title: currentState.contentInfo.title,
            url: currentState.url,
            thumbnail: currentState.contentInfo.thumbnail,
            downloadDate: new Date().toISOString(),
            filePath: result.filePath || "",
            duration: currentState.contentInfo.duration,
            status: "completed",
            type: currentState.contentInfo.type,
            videoCount: currentState.contentInfo.videoCount,
          });
        }
      } else {
        setDownloadError(result.error || "Download failed");
      }
    });

    const unsubVideoComplete = window.electronAPI.onVideoComplete(
      (videoInfo) => {
        const currentState = useDownloadStore.getState();
        addToHistory({
          id: `${Date.now()}-${videoInfo.index}`,
          title: videoInfo.title,
          url: currentState.url,
          thumbnail: currentState.contentInfo?.thumbnail,
          downloadDate: new Date().toISOString(),
          filePath: videoInfo.filePath,
          status: "completed",
          type: "video",
        });
      },
    );

    const unsubError = window.electronAPI.onDownloadError((error: string) => {
      setIsDownloading(false);
      setDownloadError(error);
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubVideoComplete();
      unsubError();
    };
  }, [setDownloadProgress, setIsDownloading, setDownloadError, addToHistory]);

  const handleReset = useCallback(() => {
    setShowSuccess(false);
    reset();
  }, [reset]);

  const handleOpenFolder = useCallback(() => {
    window.electronAPI.openFolder(settings.downloadPath || "");
  }, [settings.downloadPath]);

  // Load error logs when settings view is active
  const loadErrorLogs = useCallback(async () => {
    try {
      const logs = await window.electronAPI.getErrorLogs();
      setErrorLogs(logs);
    } catch (err) {
      console.error("Failed to load error logs:", err);
    }
  }, []);

  const handleCopyLogs = useCallback(() => {
    const logText = errorLogs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.details ? "\n  " + log.details : ""}`,
      )
      .join("\n");
    navigator.clipboard.writeText(logText);
  }, [errorLogs]);

  const handleOpenLogFile = useCallback(() => {
    window.electronAPI.openLogFile();
  }, []);

  // Detect if a URL is a valid YouTube URL
  const detectYouTubeUrl = useCallback((url: string): DetectedUrl => {
    try {
      const trimmedUrl = url.trim();
      const urlObj = new URL(trimmedUrl);

      // Only accept YouTube URLs
      if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
        return { url: trimmedUrl, type: 'unknown', id: null, isValid: false, selected: false };
      }

      const pathname = urlObj.pathname;

      // youtu.be shortened URLs
      if (urlObj.hostname === 'youtu.be') {
        const videoId = pathname.slice(1).split('?')[0];
        if (videoId) {
          return { url: trimmedUrl, type: 'video', id: videoId, isValid: true, selected: true };
        }
      }

      // youtube.com URLs
      // Standard watch: /watch?v=VIDEO_ID
      if (pathname.startsWith('/watch')) {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) {
          return { url: trimmedUrl, type: 'video', id: videoId, isValid: true, selected: true };
        }
      }

      // Playlist: /playlist?list=PLAYLIST_ID
      if (pathname.startsWith('/playlist')) {
        const playlistId = urlObj.searchParams.get('list');
        if (playlistId) {
          return { url: trimmedUrl, type: 'playlist', id: playlistId, isValid: true, selected: true };
        }
      }

      // Shorts: /shorts/VIDEO_ID
      if (pathname.startsWith('/shorts/')) {
        const videoId = pathname.split('/')[2];
        if (videoId) {
          return { url: trimmedUrl, type: 'video', id: videoId, isValid: true, selected: true };
        }
      }

      // Live: /live/VIDEO_ID
      if (pathname.startsWith('/live/')) {
        const videoId = pathname.split('/')[2];
        if (videoId) {
          return { url: trimmedUrl, type: 'video', id: videoId, isValid: true, selected: true };
        }
      }

      // Embed: /embed/VIDEO_ID
      if (pathname.startsWith('/embed/')) {
        const videoId = pathname.split('/')[2];
        if (videoId) {
          return { url: trimmedUrl, type: 'video', id: videoId, isValid: true, selected: true };
        }
      }

      return { url: trimmedUrl, type: 'unknown', id: null, isValid: false, selected: false };
    } catch {
      return { url: url.trim(), type: 'unknown', id: null, isValid: false, selected: false };
    }
  }, []);

  // Parse multiple URLs from text (newline or comma separated)
  const parseMultipleUrls = useCallback((text: string): DetectedUrl[] => {
    const lines = text
      .split(/[\n,]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const results: DetectedUrl[] = [];
    const seenUrls = new Set<string>();

    for (const line of lines) {
      let urlMatch = line;

      // Try to extract URL from the line
      const urlPattern = /(https?:\/\/[^\s]+)/i;
      const match = line.match(urlPattern);
      if (match) {
        urlMatch = match[1];
      } else if (!line.startsWith('http')) {
        continue;
      }

      // Normalize URL
      urlMatch = urlMatch.replace(/[.,;:!?\])]+$/, '');

      // Deduplicate
      if (seenUrls.has(urlMatch)) {
        continue;
      }

      seenUrls.add(urlMatch);
      const detected = detectYouTubeUrl(urlMatch);
      results.push(detected);
    }

    return results;
  }, [detectYouTubeUrl]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const droppedText = e.dataTransfer.getData('text/plain');
    if (!droppedText) {
      return;
    }

    const urls = parseMultipleUrls(droppedText);

    if (urls.length === 0) {
      return;
    }

    // Switch to analyze view
    setView('analyze');

    if (urls.length === 1) {
      // Single URL - let the AnalyzeTab handle it
      // We'll trigger the detection via a small delay to allow the view switch
      setTimeout(() => {
        const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (inputElement) {
          // Use native value setter and dispatch events
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(inputElement, urls[0].url);
          }
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      }, 100);
    } else {
      // Multiple URLs - show the batch modal
      setDetectedUrls(urls);
      setShowMultiUrlModal(true);
    }
  }, [parseMultipleUrls]);

  // Multi-URL modal handlers
  const handleMultiUrlToggle = useCallback((index: number) => {
    setDetectedUrls(prev => prev.map((u, i) =>
      i === index ? { ...u, selected: !u.selected } : u
    ));
  }, []);

  const handleMultiUrlCancel = useCallback(() => {
    setDetectedUrls([]);
    setShowMultiUrlModal(false);
  }, []);

  const handleMultiUrlSelectAll = useCallback(() => {
    setDetectedUrls(prev => prev.map(u =>
      u.isValid ? { ...u, selected: true } : u
    ));
  }, []);

  const handleMultiUrlSelectNone = useCallback(() => {
    setDetectedUrls(prev => prev.map(u => ({ ...u, selected: false })));
  }, []);

  const handleMultiUrlAddSelected = useCallback(async () => {
    const selectedUrls = detectedUrls.filter(u => u.selected && u.isValid);
    if (selectedUrls.length === 0) return;

    setIsAddingBatch(true);
    const batchGroupId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    try {
      for (const item of selectedUrls) {
        const srcType = item.type === 'playlist' ? 'playlist' : item.type === 'channel' ? 'channel' : 'single';
        await window.electronAPI.addToQueue({
          url: item.url,
          title: item.type === 'video' ? `Video (${item.id})` : item.type === 'playlist' ? `Playlist (${item.id})` : `Channel (${item.id})`,
          format: 'mp4',
          qualityLabel: '1080p',
          audioOnly: false,
          source: 'app',
          sourceType: srcType,
          contentType: 'video',
          batchGroupId,
        });
      }

      setDetectedUrls([]);
      setShowMultiUrlModal(false);
      // Switch to downloads view to see the queue
      setView('downloads');
    } catch (error) {
      console.error('Failed to add batch URLs:', error);
    } finally {
      setIsAddingBatch(false);
    }
  }, [detectedUrls]);

  // Load logs and binary status when settings view is opened
  useEffect(() => {
    if (view === "settings") {
      loadErrorLogs();
      // Fetch binary status
      window.electronAPI.getBinaryStatus().then(setBinaryStatus).catch(console.error);
    }
  }, [view, loadErrorLogs]);

  // Handle confetti easter egg
  const handleCreditsClick = useCallback((name: string) => {
    setConfettiName(name);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  // Handle binary download
  const handleDownloadBinary = useCallback(async () => {
    setBinaryError(null);
    await window.electronAPI.downloadBinary();
  }, []);

  // Handle ffmpeg download
  const handleDownloadFfmpeg = useCallback(async () => {
    setFfmpegError(null);
    await window.electronAPI.downloadFfmpeg();
  }, []);

  // Handle update actions
  const handleCheckUpdates = useCallback(async () => {
    setUpdateStatus((prev) => ({ ...prev, error: null }));
    await window.electronAPI.checkForUpdates();
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    setUpdateStatus((prev) => ({ ...prev, downloading: true, error: null }));
    await window.electronAPI.downloadUpdate();
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    await window.electronAPI.installUpdate();
  }, []);

  const handleCloseUpdateModal = useCallback(() => {
    setShowUpdateModal(false);
    window.electronAPI.resetUpdate();
  }, []);

  const handleCloseChangelogModal = useCallback(() => {
    setShowChangelogModal(false);
  }, []);

  const handleShowChangelog = useCallback(() => {
    setShowChangelogModal(true);
  }, []);

  // Handle callback when items are added to queue
  const handleAddToQueue = useCallback(() => {
    setView("downloads");
  }, []);

  // Format countdown time (seconds to M:SS)
  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle PO token server restart
  const handleRestartPotServer = useCallback(async () => {
    setPotRestarting(true);
    try {
      await window.electronAPI.restartPotTokenServer();
      // Status will be updated via the subscription
    } catch (error) {
      console.error('Failed to restart PO token server:', error);
    } finally {
      setTimeout(() => setPotRestarting(false), 1000);
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        if (showSuccess) {
          e.preventDefault();
          handleReset();
        }
        return;
      }

      if (isInputField) return;

      if (e.ctrlKey && e.key === "o" && showSuccess) {
        e.preventDefault();
        handleOpenFolder();
        return;
      }

      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        handleReset();
        return;
      }

      if (e.ctrlKey && e.key === "1") {
        e.preventDefault();
        setView("analyze");
        return;
      }

      if (e.ctrlKey && e.key === "2") {
        e.preventDefault();
        setView("downloads");
        return;
      }

      if (e.ctrlKey && e.key === "3") {
        e.preventDefault();
        setView("history");
        return;
      }

      if (e.ctrlKey && e.key === "4") {
        e.preventDefault();
        setView("settings");
        return;
      }

      if (e.ctrlKey && e.key === "5") {
        e.preventDefault();
        setView("dashboard");
        return;
      }

      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        toggleTheme();
        return;
      }

      if (e.ctrlKey && e.key === "m") {
        e.preventDefault();
        window.electronAPI.toggleMiniMode();
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    showSuccess,
    handleReset,
    handleOpenFolder,
    toggleTheme,
  ]);

  // Clear taskbar badge when user views the downloads tab
  useEffect(() => {
    if (view === 'downloads') {
      window.electronAPI.clearTaskbarBadge().catch(console.error);
    }
  }, [view]);

  // Track previous queue processing state to detect completion
  const wasProcessingRef = useRef(false);

  // Queue counts
  const activeQueueItems = queueStatus.items.filter(
    (i) =>
      i.status === "pending" ||
      i.status === "downloading" ||
      i.status === "paused",
  );
  const completedQueueItems = queueStatus.items.filter(
    (i) => i.status === "completed",
  );

  // Check if queue just finished
  const queueJustFinished =
    completedQueueItems.length > 0 &&
    activeQueueItems.length === 0 &&
    !queueStatus.isProcessing;

  // Show success overlay when queue finishes
  useEffect(() => {
    const wasProcessing = wasProcessingRef.current;
    const isNowFinished = queueJustFinished && !queueStatus.isPaused;

    // Queue transitioned from processing to finished
    if (wasProcessing && isNowFinished && !showSuccess) {
      setShowSuccess(true);
    }

    // Update ref for next render
    wasProcessingRef.current = queueStatus.isProcessing || activeQueueItems.length > 0;
  }, [queueJustFinished, queueStatus.isProcessing, queueStatus.isPaused, activeQueueItems.length, showSuccess]);

  const isActiveDownload = isDownloading || queueStatus.isProcessing;

  // Get current downloading item for mini mode display
  const currentDownloadingItem = queueStatus.items.find(i => i.status === 'downloading');

  // Toggle mini mode handler
  const handleToggleMiniMode = useCallback(() => {
    window.electronAPI.toggleMiniMode();
  }, []);

  // Pause/resume queue for mini mode
  const handleMiniPauseResume = useCallback(() => {
    if (queueStatus.isPaused) {
      window.electronAPI.resumeQueue();
    } else {
      window.electronAPI.pauseQueue();
    }
  }, [queueStatus.isPaused]);

  // Handle close button - always show confirmation dialog
  const handleCloseRequest = useCallback(() => {
    setShowCloseConfirm(true);
  }, []);

  // Handle close confirmation actions
  const handleCloseConfirmMinimize = useCallback(() => {
    setShowCloseConfirm(false);
    // Minimize to system tray
    window.electronAPI.minimizeToTray();
  }, []);

  const handleCloseConfirmQuit = useCallback(() => {
    setShowCloseConfirm(false);
    // Force quit - exit completely
    window.electronAPI.forceQuit();
  }, []);

  const handleCloseConfirmCancel = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Check if there are active downloads for dialog message
  const hasActiveDownloads = queueStatus.items.some(
    item => item.status === 'downloading' || item.status === 'retrying'
  );

  return (
    <>
      {/* Binary Download Modal */}
      {binaryMissing && (
        <div className="binary-modal-overlay">
          <div className="binary-modal">
            <div className="binary-modal-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="binary-modal-title">REQUIRED COMPONENT MISSING</div>
            <div className="binary-modal-text">
              VidGrab requires yt-dlp to download videos. Click below to
              download it automatically.
            </div>
            {binaryError && (
              <div className="binary-modal-error">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {binaryError}
              </div>
            )}
            {binaryDownloading ? (
              <div className="binary-modal-progress">
                <div className="binary-progress-bar">
                  <div
                    className="binary-progress-fill"
                    style={{ width: `${binaryDownloadProgress}%` }}
                  />
                </div>
                <div className="binary-progress-text">
                  Downloading... {binaryDownloadProgress}%
                </div>
              </div>
            ) : (
              <button
                className="binary-modal-btn"
                onClick={handleDownloadBinary}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                DOWNLOAD YT-DLP
              </button>
            )}
          </div>
        </div>
      )}

      {/* FFmpeg Download Modal - only show if yt-dlp is installed but ffmpeg is missing */}
      {!binaryMissing && ffmpegMissing && (
        <div className="binary-modal-overlay">
          <div className="binary-modal">
            <div className="binary-modal-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <div className="binary-modal-title">FFMPEG REQUIRED</div>
            <div className="binary-modal-text">
              VidGrab requires FFmpeg to merge video and audio streams. Without it, videos will be downloaded as separate files. Click below to download it automatically.
            </div>
            {ffmpegError && (
              <div className="binary-modal-error">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                {ffmpegError}
              </div>
            )}
            {ffmpegDownloading ? (
              <div className="binary-modal-progress">
                <div className="binary-progress-bar">
                  <div
                    className="binary-progress-fill"
                    style={{ width: `${ffmpegDownloadProgress}%` }}
                  />
                </div>
                <div className="binary-progress-text">
                  Downloading FFmpeg... {ffmpegDownloadProgress}%
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="binary-modal-btn"
                onClick={handleDownloadFfmpeg}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                DOWNLOAD FFMPEG
              </button>
            )}
          </div>
        </div>
      )}

      {/* Update Notification - Simple */}
      {updateNotification && (
        <div className="notify-simple">
          <span className="notify-simple-dot" />
          <span className="notify-simple-text">{updateNotification}</span>
        </div>
      )}

      {/* Title Bar */}
      <div className="title-bar">
        <div className="title-bar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
          <span>VIDGRAB</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            v{APP_VERSION}
          </span>
        </div>
        <div className="title-bar-controls">
          <button
            className="title-bar-btn"
            onClick={() => window.electronAPI.minimizeWindow()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect y="4" width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="title-bar-btn"
            onClick={() => window.electronAPI.maximizeWindow()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="0.5"
                y="0.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
              />
            </svg>
          </button>
          <button
            className="title-bar-btn close"
            onClick={handleCloseRequest}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M1 1l8 8M9 1l-8 8"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mini Mode */}
      {isMiniMode && (
        <div className="mini-mode-overlay">
          <div className="mini-mode">
            <div className="mini-header" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
              <div className="mini-header-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
                <span>VidGrab</span>
              </div>
              <div className="mini-header-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button className="mini-header-btn" onClick={handleToggleMiniMode} title="Expand">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
                <button className="mini-header-btn" onClick={() => window.electronAPI.minimizeWindow()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button className="mini-header-btn close" onClick={() => window.electronAPI.closeWindow()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="mini-content">
              {currentDownloadingItem ? (
                <>
                  <div className="mini-section">
                    <div className="mini-section-title">NOW DOWNLOADING</div>
                    <div className="mini-title">{currentDownloadingItem.title}</div>
                    {currentDownloadingItem.thumbnail && (
                      <div className="mini-thumbnail">
                        <img src={currentDownloadingItem.thumbnail} alt="" />
                      </div>
                    )}
                    <div className="mini-progress-bar">
                      <div className="mini-progress-fill" style={{ width: `${currentDownloadingItem.progress?.percent || 0}%` }} />
                    </div>
                    <div className="mini-progress-info">
                      <span>{currentDownloadingItem.progress?.percent || 0}%</span>
                      <span>{currentDownloadingItem.progress?.speed || ''}</span>
                    </div>
                    {currentDownloadingItem.progress?.eta && (
                      <div className="mini-eta">ETA: {currentDownloadingItem.progress.eta}</div>
                    )}
                  </div>
                  <div className="mini-divider" />
                  <div className="mini-section">
                    <div className="mini-queue-info">
                      <span className="mini-queue-count">{activeQueueItems.length}</span>
                      <span>{activeQueueItems.length === 1 ? 'item' : 'items'} in queue</span>
                    </div>
                  </div>
                  <div className="mini-actions">
                    <button className="mini-action-btn" onClick={handleMiniPauseResume}>
                      {queueStatus.isPaused ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Resume
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                          Pause
                        </>
                      )}
                    </button>
                    <button className="mini-action-btn primary" onClick={handleToggleMiniMode}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                      Expand
                    </button>
                  </div>
                </>
              ) : (
                <div className="mini-idle">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <div className="mini-idle-title">No downloads</div>
                  <div className="mini-idle-text">
                    {activeQueueItems.length > 0
                      ? `${activeQueueItems.length} ${activeQueueItems.length === 1 ? 'item' : 'items'} in queue`
                      : 'Queue is empty'}
                  </div>
                  {activeQueueItems.length > 0 && (
                    <button className="mini-action-btn primary" onClick={handleMiniPauseResume}>
                      {queueStatus.isPaused ? 'Resume Queue' : 'Start Queue'}
                    </button>
                  )}
                  <button className="mini-action-btn" onClick={handleToggleMiniMode}>
                    Expand Window
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Toolbar */}
      <div className="toolbar">
        <button
          className={`toolbar-btn ${view === "analyze" ? "active" : ""}`}
          onClick={() => setView("analyze")}
          title="Analyze (Ctrl+1)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Analyze</span>
        </button>

        <button
          className={`toolbar-btn ${view === "downloads" ? "active" : ""}`}
          onClick={() => setView("downloads")}
          title="Downloads (Ctrl+2)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Downloads</span>
          {activeQueueItems.length > 0 && (
            <span className="queue-count">{activeQueueItems.length}</span>
          )}
        </button>

        <button
          className={`toolbar-btn ${view === "history" ? "active" : ""}`}
          onClick={() => setView("history")}
          title="History (Ctrl+3)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>History</span>
        </button>

        <button
          type="button"
          className={`toolbar-btn ${view === "dashboard" ? "active" : ""}`}
          onClick={() => setView("dashboard")}
          title="Dashboard (Ctrl+5)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          className={`toolbar-btn ${view === "settings" ? "active" : ""}`}
          onClick={() => setView("settings")}
          title="Settings (Ctrl+4)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Settings</span>
        </button>

        <div className="toolbar-spacer" />

        {/* Theme Toggle */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode (Ctrl+L)`}
        >
          {theme === "dark" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          className="toolbar-btn"
          onClick={handleReset}
          disabled={isDownloading}
          title="New Download (Ctrl+N)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Clear</span>
        </button>
      </div>

      {/* Main Content */}
      <div
        className="main-content"
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Always render AnalyzeTab but hide when not active to preserve state */}
        <div style={{ display: view === "analyze" ? "block" : "none", height: "100%", width: "100%" }}>
          <AnalyzeTab onAddToQueue={handleAddToQueue} />
        </div>

        {view === "downloads" && (
          <DownloadsTab
            queueStatus={queueStatus}
            downloadProgress={downloadProgress}
            settings={settings}
          />
        )}

        {/* History View */}
        {view === "history" && (
          <div className="history-panel">
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="empty-state-title">
                  NO RECORDS<span className="blink">_</span>
                </div>
                <div className="empty-state-text">
                  // Download history will appear here
                </div>
              </div>
            ) : (
              <>
                <div className="history-header">
                  <span className="history-title">DOWNLOAD LOG</span>
                  <div className="history-header-actions">
                    <select
                      className="history-status-filter"
                      value={historyStatusFilter}
                      onChange={(e) => setHistoryStatusFilter(e.target.value as "all" | "completed" | "failed" | "cancelled")}
                    >
                      <option value="all">All Status</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button className="btn-clear" onClick={clearHistory}>
                      CLEAR ALL
                    </button>
                  </div>
                </div>
                {/* History Search Bar */}
                <div className="history-search-wrapper">
                  <div className={`history-search-input ${isSearchFocused ? 'focused' : ''}`}>
                    <svg
                      className="history-search-icon"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by title, URL, or file path... (Ctrl+F)"
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      className="history-search-field"
                    />
                    {historySearchQuery && (
                      <button
                        className="history-search-clear"
                        onClick={() => setHistorySearchQuery("")}
                        title="Clear search"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {(historySearchQuery || historyStatusFilter !== "all") && (
                    <div className="history-search-results-count">
                      {filteredHistory.length} {filteredHistory.length === 1 ? 'result' : 'results'}
                      {historyStatusFilter !== "all" && <span> ({historyStatusFilter})</span>}
                    </div>
                  )}
                </div>
                {filteredHistory.length === 0 && (historySearchQuery || historyStatusFilter !== "all") ? (
                  <div className="history-search-empty">
                    <div className="history-search-empty-icon">
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <div className="history-search-empty-title">NO RESULTS</div>
                    <div className="history-search-empty-text">
                      {historySearchQuery && historyStatusFilter !== "all"
                        ? `// No history items match "${historySearchQuery}" with status "${historyStatusFilter}"`
                        : historySearchQuery
                        ? `// No history items match "${historySearchQuery}"`
                        : `// No ${historyStatusFilter} history items found`
                      }
                    </div>
                  </div>
                ) : (
                  <div className="history-list">
                    {filteredHistory.map((item) => (
                      <div key={item.id} className="history-item">
                        <div className="history-thumbnail">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} />
                          ) : (
                            <div className="thumbnail-placeholder">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="history-info">
                          <div className="history-title-text">
                            {highlightMatch(item.title, historySearchQuery)}
                          </div>
                          {historySearchQuery && item.filePath && (
                            <div className="history-filepath" title={item.filePath}>
                              {highlightMatch(item.filePath, historySearchQuery)}
                            </div>
                          )}
                          <div className="history-meta">
                            <span>
                              {new Date(item.downloadDate).toLocaleDateString()}
                            </span>
                            <span className={`history-status ${item.status}`}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                        <div className="history-actions">
                          <button
                            onClick={() =>
                              window.electronAPI.openFolder(item.filePath)
                            }
                            title="Open folder"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeFromHistory(item.id)}
                            title="Remove"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Settings View */}
        {view === "settings" && (
          <div className="settings-panel">
            <div className="settings-group">
              <div className="settings-group-title">APPEARANCE</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Theme</div>
                  <div className="setting-description">
                    Light or dark mode
                  </div>
                </div>
                <div className="theme-toggle-group">
                  <button
                    className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => {
                      const newTheme = 'dark' as Theme;
                      setTheme(newTheme);
                      localStorage.setItem("vidgrab-theme", newTheme);
                      document.documentElement.setAttribute("data-theme", newTheme);
                      updateSettings({ theme: newTheme });
                    }}
                  >
                    Dark
                  </button>
                  <button
                    className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => {
                      const newTheme = 'light' as Theme;
                      setTheme(newTheme);
                      localStorage.setItem("vidgrab-theme", newTheme);
                      document.documentElement.setAttribute("data-theme", newTheme);
                      updateSettings({ theme: newTheme });
                    }}
                  >
                    Light
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Accent Color</div>
                  <div className="setting-description">
                    Choose a preset color theme
                  </div>
                </div>
              </div>

              <div className="theme-presets">
                {PRESET_THEMES.map((preset) => (
                  <button
                    key={preset.name}
                    className={`theme-preset-btn ${settings.selectedTheme === preset.name ? 'active' : ''}`}
                    onClick={() => updateSettings({ selectedTheme: preset.name })}
                    title={preset.displayName}
                    style={{
                      backgroundColor: preset.colors.accent,
                      borderColor: settings.selectedTheme === preset.name ? preset.colors.accentHover : 'transparent',
                    }}
                  >
                    {settings.selectedTheme === preset.name && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {settings.selectedTheme === 'custom' && (
                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Custom Accent</div>
                    <div className="setting-description">
                      Pick your own accent color
                    </div>
                  </div>
                  <div className="custom-color-picker">
                    <input
                      type="color"
                      value={settings.customAccentColor || '#8b5cf6'}
                      onChange={(e) => updateSettings({ customAccentColor: e.target.value })}
                      className="color-input"
                    />
                    <span className="color-hex">{settings.customAccentColor || '#8b5cf6'}</span>
                  </div>
                </div>
              )}

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Font Size</div>
                  <div className="setting-description">
                    Adjust text size
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.fontSize}
                  onChange={(e) =>
                    updateSettings({
                      fontSize: e.target.value as 'small' | 'medium' | 'large' | 'x-large',
                    })
                  }
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="x-large">Extra Large</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">DOWNLOAD CONFIGURATION</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download Location</div>
                  <div className="setting-value">
                    {settings.downloadPath || "~/Downloads/Youtube Downloads"}
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    const folder = await window.electronAPI.selectFolder();
                    if (folder) updateSettings({ downloadPath: folder });
                  }}
                >
                  BROWSE
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Auto Best Quality</div>
                  <div className="setting-description">
                    Automatically select highest available quality
                  </div>
                </div>
                <button
                  className={`toggle ${settings.autoBestQuality ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      autoBestQuality: !settings.autoBestQuality,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Organize by Type</div>
                  <div className="setting-description">
                    Create folders for playlists and channels
                  </div>
                </div>
                <button
                  className={`toggle ${settings.organizeByType ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({ organizeByType: !settings.organizeByType })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download Delay</div>
                  <div className="setting-description">
                    Delay between playlist videos
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.delayBetweenDownloads}
                  onChange={(e) =>
                    updateSettings({
                      delayBetweenDownloads: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="1000">1 second</option>
                  <option value="2000">2 seconds</option>
                  <option value="3000">3 seconds</option>
                  <option value="5000">5 seconds</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">EXTRA OPTIONS</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Shutdown After Complete</div>
                  <div className="setting-description">
                    Auto-shutdown computer when all downloads finish
                  </div>
                </div>
                <button
                  className={`toggle ${settings.shutdownAfterComplete ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      shutdownAfterComplete: !settings.shutdownAfterComplete,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Save Thumbnails</div>
                  <div className="setting-description">
                    Download video thumbnail as image file
                  </div>
                </div>
                <button
                  className={`toggle ${settings.writeThumbnail ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      writeThumbnail: !settings.writeThumbnail,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Save Descriptions</div>
                  <div className="setting-description">
                    Save video description as text file
                  </div>
                </div>
                <button
                  className={`toggle ${settings.writeDescription ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      writeDescription: !settings.writeDescription,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Smart Filenames</div>
                  <div className="setting-description">
                    Clean up filenames (remove emojis, special characters)
                  </div>
                </div>
                <button
                  className={`toggle ${settings.smartFilename !== false ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      smartFilename: settings.smartFilename === false ? true : false,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download All Subtitles</div>
                  <div className="setting-description">
                    Download all available subtitle languages automatically
                  </div>
                </div>
                <button
                  className={`toggle ${settings.downloadAllSubtitles ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      downloadAllSubtitles: !settings.downloadAllSubtitles,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">BATCH DOWNLOADS</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Enable Batch Pausing</div>
                  <div className="setting-description">
                    Pause between batches to avoid rate limits
                  </div>
                </div>
                <button
                  className={`toggle ${settings.batchDownloadEnabled !== false ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      batchDownloadEnabled: settings.batchDownloadEnabled !== false ? false : true,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Batch Size</div>
                  <div className="setting-description">
                    Videos per batch before pausing
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.batchSize || 25}
                  onChange={(e) =>
                    updateSettings({
                      batchSize: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={10}>10 videos</option>
                  <option value={15}>15 videos</option>
                  <option value={25}>25 videos</option>
                  <option value={50}>50 videos</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Short Pause (≤50 videos)</div>
                  <div className="setting-description">
                    Pause for small playlists/channels
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.batchPauseShort || 5}
                  onChange={(e) =>
                    updateSettings({
                      batchPauseShort: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={3}>3 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Long Pause (&gt;50 videos)</div>
                  <div className="setting-description">
                    Pause for large playlists/channels
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.batchPauseLong || 10}
                  onChange={(e) =>
                    updateSettings({
                      batchPauseLong: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">SPEED LIMITER</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Download Speed Limit</div>
                  <div className="setting-description">
                    Throttle bandwidth to avoid network congestion
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.speedLimit || ''}
                  onChange={(e) =>
                    updateSettings({
                      speedLimit: e.target.value,
                    })
                  }
                >
                  <option value="">Unlimited</option>
                  <option value="1M">1 MB/s</option>
                  <option value="2M">2 MB/s</option>
                  <option value="5M">5 MB/s</option>
                  <option value="10M">10 MB/s</option>
                  <option value="20M">20 MB/s</option>
                  <option value="50M">50 MB/s</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">AUTO-RETRY</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Auto-Retry Failed Downloads</div>
                  <div className="setting-description">
                    Automatically retry failed downloads with exponential backoff
                  </div>
                </div>
                <button
                  className={`toggle ${settings.autoRetryEnabled !== false ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      autoRetryEnabled: settings.autoRetryEnabled !== false ? false : true,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Max Retry Attempts</div>
                  <div className="setting-description">
                    Maximum number of retry attempts per download
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.maxRetries || 3}
                  onChange={(e) =>
                    updateSettings({
                      maxRetries: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={1}>1 attempt</option>
                  <option value={2}>2 attempts</option>
                  <option value={3}>3 attempts</option>
                  <option value={5}>5 attempts</option>
                  <option value={10}>10 attempts</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">PO TOKEN SERVER</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Server Status</div>
                  <div className="setting-description">
                    {potTokenStatus?.running
                      ? `Running on port ${potTokenStatus.port} • ${potTokenStatus.tokenCount} tokens generated`
                      : 'Not running'
                    }
                  </div>
                </div>
                <span className={`pot-status-badge ${potTokenStatus?.running ? 'running' : 'stopped'}`}>
                  {potTokenStatus?.running ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Enable PO Token</div>
                  <div className="setting-description">
                    Generate tokens to avoid bot detection
                  </div>
                </div>
                <button
                  className={`toggle ${settings.potTokenEnabled !== false ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      potTokenEnabled: settings.potTokenEnabled !== false ? false : true,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Token Cache TTL</div>
                  <div className="setting-description">
                    How long to cache tokens before regenerating
                  </div>
                </div>
                <select
                  className="setting-select"
                  value={settings.potTokenTTL || 360}
                  onChange={(e) =>
                    updateSettings({
                      potTokenTTL: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={60}>1 hour</option>
                  <option value={180}>3 hours</option>
                  <option value={360}>6 hours</option>
                  <option value={720}>12 hours</option>
                </select>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Restart Server</div>
                  <div className="setting-description">
                    Force regenerate a new token
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  onClick={handleRestartPotServer}
                  disabled={potRestarting}
                >
                  {potRestarting ? 'RESTARTING...' : 'RESTART'}
                </button>
              </div>

              {potTokenStatus?.error && (
                <div className="setting-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {potTokenStatus.error}
                </div>
              )}
            </div>

            {/* System Status - Binary indicators */}
            <div className="settings-group">
              <div className="settings-group-title">SYSTEM STATUS</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">yt-dlp</div>
                  <div className="setting-description">
                    {binaryStatus?.ytdlp.installed
                      ? binaryStatus.ytdlp.version || 'Installed'
                      : 'Not installed'
                    }
                  </div>
                </div>
                <span className={`binary-status-badge ${binaryStatus?.ytdlp.installed ? 'installed' : 'missing'}`}>
                  {binaryStatus?.ytdlp.installed ? 'FOUND' : 'MISSING'}
                </span>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">FFmpeg</div>
                  <div className="setting-description">
                    {binaryStatus?.ffmpeg.available
                      ? binaryStatus.ffmpeg.version || 'Available'
                      : 'Not available - video/audio merge will fail'
                    }
                  </div>
                </div>
                <span className={`binary-status-badge ${binaryStatus?.ffmpeg.available ? 'installed' : 'missing'}`}>
                  {binaryStatus?.ffmpeg.available ? 'FOUND' : 'MISSING'}
                </span>
              </div>

              {(!binaryStatus?.ytdlp.installed || !binaryStatus?.ffmpeg.available) && (
                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Download Components</div>
                    <div className="setting-description">
                      Click to download missing components
                    </div>
                  </div>
                  <div className="binary-download-actions">
                    {!binaryStatus?.ytdlp.installed && (
                      <button
                        className="btn-secondary"
                        onClick={handleDownloadBinary}
                        disabled={binaryDownloading}
                      >
                        {binaryDownloading ? `${binaryDownloadProgress}%` : 'DOWNLOAD YT-DLP'}
                      </button>
                    )}
                    {!binaryStatus?.ffmpeg.available && binaryStatus?.ytdlp.installed && (
                      <button
                        className="btn-secondary"
                        onClick={handleDownloadFfmpeg}
                        disabled={ffmpegDownloading}
                      >
                        {ffmpegDownloading ? `${ffmpegDownloadProgress}%` : 'DOWNLOAD FFMPEG'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="settings-group">
              <div className="settings-group-title">NOTIFICATION SOUNDS</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Enable Sounds</div>
                  <div className="setting-description">
                    Play sounds on download completion and failure
                  </div>
                </div>
                <button
                  className={`toggle ${settings.soundEnabled !== false ? "on" : ""}`}
                  onClick={() =>
                    updateSettings({
                      soundEnabled: settings.soundEnabled === false ? true : false,
                    })
                  }
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Volume</div>
                  <div className="setting-description">
                    {settings.soundVolume || 50}%
                  </div>
                </div>
                <div className="volume-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.soundVolume || 50}
                    onChange={(e) => {
                      const volume = parseInt(e.target.value);
                      updateSettings({ soundVolume: volume });
                      // Preview sound when adjusting
                      if (settings.soundEnabled) {
                        ensureAudioContextReady();
                        playNotificationSound('success', volume);
                      }
                    }}
                    className="volume-slider"
                    disabled={settings.soundEnabled === false}
                  />
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Playlist Sound Mode</div>
                  <div className="setting-description">
                    When to play sounds for playlist/channel downloads
                  </div>
                </div>
                <div className="sound-mode-control">
                  <select
                    value={settings.soundNotificationMode || 'every'}
                    onChange={(e) => {
                      updateSettings({ soundNotificationMode: e.target.value as SoundNotificationMode });
                    }}
                    className="sound-mode-select"
                    disabled={settings.soundEnabled === false}
                  >
                    <option value="every">Every download</option>
                    <option value="each-item">Each playlist item</option>
                    <option value="batch-complete">Playlist complete only</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Test Sounds</div>
                  <div className="setting-description">
                    Preview notification sounds
                  </div>
                </div>
                <div className="sound-test-buttons">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      ensureAudioContextReady();
                      playNotificationSound('success', settings.soundVolume || 50);
                    }}
                    disabled={settings.soundEnabled === false}
                  >
                    SUCCESS
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      ensureAudioContextReady();
                      playNotificationSound('error', settings.soundVolume || 50);
                    }}
                    disabled={settings.soundEnabled === false}
                  >
                    ERROR
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">DATA MANAGEMENT</div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Export Download History</div>
                  <div className="setting-description">
                    Export your download history as CSV, JSON, or Markdown
                  </div>
                </div>
                <div className="export-actions">
                  <button
                    className="btn-secondary"
                    onClick={async () => {
                      const result = await window.electronAPI.exportHistory('csv')
                      if (result.success) {
                        setShowSuccess(true)
                        setTimeout(() => setShowSuccess(false), 2000)
                      }
                    }}
                  >
                    CSV
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={async () => {
                      const result = await window.electronAPI.exportHistory('json')
                      if (result.success) {
                        setShowSuccess(true)
                        setTimeout(() => setShowSuccess(false), 2000)
                      }
                    }}
                  >
                    JSON
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={async () => {
                      const result = await window.electronAPI.exportHistory('markdown')
                      if (result.success) {
                        setShowSuccess(true)
                        setTimeout(() => setShowSuccess(false), 2000)
                      }
                    }}
                  >
                    MARKDOWN
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">DEBUG LOGS</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Error History</div>
                  <div className="setting-description">
                    {errorLogs.length} recent errors/warnings
                  </div>
                </div>
                <div className="log-actions">
                  <button className="btn-secondary" onClick={loadErrorLogs}>
                    REFRESH
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={handleCopyLogs}
                    disabled={errorLogs.length === 0}
                  >
                    COPY
                  </button>
                  <button className="btn-secondary" onClick={handleOpenLogFile}>
                    OPEN FILE
                  </button>
                </div>
              </div>
              {errorLogs.length > 0 && (
                <div className="error-log-list">
                  {errorLogs.slice(0, 20).map((log, index) => (
                    <div key={index} className={`error-log-item ${log.level}`}>
                      <div className="error-log-header">
                        <span className={`error-log-level ${log.level}`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="error-log-time">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="error-log-message">{log.message}</div>
                      {log.details && (
                        <div className="error-log-details">{log.details}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="settings-group">
              <div className="settings-group-title">UPDATES</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Current Version</div>
                  <div className="setting-description">
                    VidGrab v{APP_VERSION}
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  onClick={handleCheckUpdates}
                  disabled={updateStatus.checking}
                >
                  {updateStatus.checking ? "CHECKING..." : "CHECK FOR UPDATES"}
                </button>
              </div>
              <div
                className="setting-item clickable"
                onClick={handleShowChangelog}
              >
                <div className="setting-info">
                  <div className="setting-label">View Changelog</div>
                  <div className="setting-description">
                    See what's new in this version
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ opacity: 0.5 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-title">ABOUT</div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">VidGrab</div>
                  <div className="setting-description">
                    Version {APP_VERSION} // Powered by yt-dlp
                  </div>
                </div>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">Developer</div>
                  <div className="setting-description">
                    Developed by Nazeef Masood
                  </div>
                </div>
              </div>
              <div
                className="setting-item clickable"
                onClick={() => handleCreditsClick('Ali Awan')}
              >
                <div className="setting-info">
                  <div className="setting-label">Special Thanks</div>
                  <div className="setting-description credits-name">
                    Ali Awan - First tester & supporter
                  </div>
                </div>
                <span className="credits-hint">Click me!</span>
              </div>
              <div
                className="setting-item clickable"
                onClick={() => handleCreditsClick('Abdullah Awan')}
              >
                <div className="setting-info">
                  <div className="setting-label">Bug Hunter</div>
                  <div className="setting-description credits-name">
                    Abdullah Awan - First to identify issues
                  </div>
                </div>
                <span className="credits-hint">Click me!</span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {view === "dashboard" && (
          <DashboardTab isActive={true} theme={theme} />
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
                  backgroundColor: [
                    "#00ff88",
                    "#ffaa00",
                    "#ff6b6b",
                    "#00d4ff",
                    "#ff00ff",
                    "#ffd700",
                    "#7b68ee",
                  ][Math.floor(Math.random() * 7)],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
            <div className="confetti-text">Thank you {confettiName}!</div>
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="success-title">DOWNLOAD COMPLETE</div>
            <div className="success-subtitle">{contentInfo?.title}</div>
            <div className="success-message">
              // All files have been successfully downloaded to your system
            </div>
            <div className="success-actions">
              <button
                className="btn-success"
                onClick={handleOpenFolder}
                title="Ctrl+O"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ marginRight: 8 }}
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                OPEN FOLDER
                <span className="shortcut-hint">Ctrl+O</span>
              </button>
              <button
                className="btn-outline"
                onClick={handleReset}
                title="Ctrl+N"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ marginRight: 8 }}
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                NEW DOWNLOAD
                <span className="shortcut-hint">Ctrl+N</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-left">
          <div
            className={`status-indicator ${isActiveDownload ? "downloading" : ""} ${queueStatus.isPaused ? "paused" : ""} ${queueJustFinished ? "complete" : ""} ${queueStatus.countdownInfo?.type === 'batch-pause' ? 'batch-paused' : ''} ${updateStatus.checking ? "checking" : ""} ${updateStatus.downloading ? "downloading" : ""} ${updateStatus.downloaded ? "complete" : ""}`}
          />
          <span>
            {/* Batch pause countdown - highest priority */}
            {queueStatus.countdownInfo?.type === 'batch-pause' && (
              <span className="status-countdown">
                Batch pause: resuming in {formatCountdown(queueStatus.countdownInfo.remaining)}
                {queueStatus.batchStatus && (
                  <span className="status-batch-info">
                    {' '}Batch {queueStatus.batchStatus.batchNumber}/{queueStatus.batchStatus.totalBatches} ({queueStatus.batchStatus.completedItems}/{queueStatus.batchStatus.totalItems})
                  </span>
                )}
              </span>
            )}
            {/* Download delay countdown */}
            {queueStatus.countdownInfo?.type === 'download-delay' && (
              <span className="status-countdown-small">
                Next download in {queueStatus.countdownInfo.remaining}s
              </span>
            )}
            {/* No countdown - show regular status */}
            {(!queueStatus.countdownInfo || queueStatus.countdownInfo.type === 'none') && (
              <>
                {/* Update status takes priority */}
                {updateStatus.checking && "CHECKING FOR UPDATES..."}
                {updateStatus.downloading && updateStatus.progress &&
                  `DOWNLOADING UPDATE ${updateStatus.progress.percent}%`}
                {updateStatus.downloaded && "UPDATE READY - CLICK TO INSTALL"}
                {/* Regular status */}
                {!updateStatus.checking && !updateStatus.downloading && !updateStatus.downloaded && (
                  <>
                    {isActiveDownload && downloadProgress?.status === "downloading" &&
                      `DOWNLOADING ${downloadProgress.percent?.toFixed(0)}%`}
                    {isActiveDownload && downloadProgress?.status === "merging" &&
                      "MERGING FILES"}
                    {isActiveDownload && downloadProgress?.status === "waiting" &&
                      "WAITING FOR NEXT"}
                    {isActiveDownload && !downloadProgress && "PROCESSING"}
                    {!isActiveDownload &&
                      queueStatus.isPaused &&
                      activeQueueItems.length > 0 &&
                      "PAUSED"}
                    {!isActiveDownload &&
                      !queueStatus.isPaused &&
                      (showSuccess || queueJustFinished) &&
                      `COMPLETE (${completedQueueItems.length} DOWNLOADED)`}
                    {!isActiveDownload &&
                      !queueStatus.isPaused &&
                      !showSuccess &&
                      !queueJustFinished &&
                      activeQueueItems.length > 0 &&
                      `${activeQueueItems.length} IN QUEUE`}
                    {!isActiveDownload &&
                      !queueStatus.isPaused &&
                      !showSuccess &&
                      !queueJustFinished &&
                      activeQueueItems.length === 0 &&
                      "READY"}
                  </>
                )}
              </>
            )}
          </span>
        </div>
        <div className="status-bar-right">
          {/* PO Token indicator */}
          <span
            className={`pot-indicator ${potTokenStatus?.running ? 'active' : 'inactive'}`}
            title={potTokenStatus?.running
              ? `PO Token Server running on port ${potTokenStatus.port} (${potTokenStatus.tokenCount} tokens generated)`
              : 'PO Token Server not running'
            }
          >
            POT
          </span>
          {/* Batch info during active download */}
          {queueStatus.batchStatus?.active && !queueStatus.countdownInfo && (
            <span className="status-batch-info">
              BATCH {queueStatus.batchStatus.batchNumber}/{queueStatus.batchStatus.totalBatches}
            </span>
          )}
          <span>
            {history.length} DOWNLOADS LOGGED // {theme.toUpperCase()} MODE
          </span>
        </div>
      </div>

      {/* Update Modal */}
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateStatus.info}
        downloading={updateStatus.downloading}
        downloaded={updateStatus.downloaded}
        progress={updateStatus.progress}
        error={updateStatus.error}
        onDownload={handleDownloadUpdate}
        onInstall={handleInstallUpdate}
        onClose={handleCloseUpdateModal}
      />

      {/* Changelog Modal */}
      <ChangelogModal
        visible={showChangelogModal}
        onClose={handleCloseChangelogModal}
      />

      {/* Close Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="close-confirm-overlay">
          <div className="close-confirm-dialog">
            <div className="close-confirm-title">
              {hasActiveDownloads ? 'DOWNLOADS IN PROGRESS' : 'EXIT VIDGRAB'}
            </div>
            <div className="close-confirm-message">
              {hasActiveDownloads
                ? 'Active downloads detected. Select an action.'
                : 'Minimize to system tray or quit completely?'
              }
            </div>
            <div className="close-confirm-options">
              <button className="close-confirm-btn secondary" onClick={handleCloseConfirmCancel}>
                CANCEL
              </button>
              <button className="close-confirm-btn primary" onClick={handleCloseConfirmMinimize}>
                MINIMIZE
              </button>
              <button className="close-confirm-btn danger" onClick={handleCloseConfirmQuit}>
                QUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="drag-drop-overlay">
          <div className="drag-drop-content">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="drag-drop-text">DROP URLS HERE</div>
            <div className="drag-drop-subtext">YouTube videos, playlists, or channels</div>
          </div>
        </div>
      )}

      {/* Multi-URL Batch Modal */}
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
              <span>
                {detectedUrls.filter(u => u.isValid).length} valid URL{detectedUrls.filter(u => u.isValid).length !== 1 ? 's' : ''} detected
              </span>
              <div className="summary-actions">
                <button
                  type="button"
                  className="summary-btn"
                  onClick={handleMultiUrlSelectAll}
                  disabled={isAddingBatch}
                >
                  ALL
                </button>
                <button
                  type="button"
                  className="summary-btn"
                  onClick={handleMultiUrlSelectNone}
                  disabled={isAddingBatch}
                >
                  NONE
                </button>
              </div>
            </div>

            <div className="multi-url-list">
              {detectedUrls.map((url, index) => (
                <div
                  key={index}
                  className={`multi-url-item ${url.selected ? 'selected' : ''} ${!url.isValid ? 'invalid' : ''}`}
                  onClick={() => handleMultiUrlToggle(index)}
                >
                  <div className="item-checkbox">
                    {url.selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div className="item-content">
                    <div className="item-url">{url.url}</div>
                    <div className="item-type">{url.type.toUpperCase()}</div>
                  </div>
                  {!url.isValid && (
                    <div className="item-invalid">INVALID</div>
                  )}
                </div>
              ))}
            </div>

            <div className="multi-url-footer">
              <span className="footer-count">
                {detectedUrls.filter(u => u.selected && u.isValid).length} selected
              </span>
              <div className="footer-actions">
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
                    'ADD TO QUEUE'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
