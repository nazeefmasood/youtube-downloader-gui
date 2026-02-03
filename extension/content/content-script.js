// VidGrab Content Script for YouTube
// Injects download button and modal into YouTube video pages

let downloadButton = null;
let playlistButton = null;
let modal = null;
let currentVideoUrl = null;
let lastInjectedUrl = null;
let lastInjectedType = null;
let lastVideoId = null;
let observer = null;
let urlCheckInterval = null;
let injectionAttempts = 0;

// Detect page type
function getPageType() {
  const url = window.location.href;
  if (url.includes('youtube.com/watch')) return 'video';
  if (url.includes('youtube.com/shorts/')) return 'shorts';
  if (url.includes('youtube.com/playlist?list=')) return 'playlist';
  if (url.includes('youtube.com/@') || url.includes('youtube.com/channel/') || url.includes('youtube.com/c/')) return 'channel';
  return null;
}

// Extract video ID from URL
function getVideoId() {
  const url = window.location.href;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// Create the download button element for videos
function createDownloadButton() {
  const button = document.createElement('button');
  button.id = 'vidgrab-download-btn';
  button.className = 'vidgrab-btn';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Download</span>
  `;
  button.title = 'Download with VidGrab';
  button.addEventListener('click', handleDownloadClick);
  return button;
}

// Create download all button for playlists/channels
function createPlaylistButton(type, count) {
  const button = document.createElement('button');
  button.id = 'vidgrab-playlist-btn';
  button.className = 'vidgrab-playlist-btn';
  const label = type === 'playlist' ? 'Download Playlist' : 'Download Channel';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>${label}${count ? ` (${count})` : ''}</span>
  `;
  button.title = `${label} with VidGrab`;
  button.addEventListener('click', () => handlePlaylistDownloadClick(type));
  return button;
}

// Create modal for quality selection
function createModal() {
  const modalEl = document.createElement('div');
  modalEl.id = 'vidgrab-modal';
  modalEl.className = 'vidgrab-modal';
  modalEl.innerHTML = `
    <div class="vidgrab-modal-backdrop"></div>
    <div class="vidgrab-modal-content">
      <div class="vidgrab-modal-header">
        <div class="vidgrab-modal-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          <span>VIDGRAB</span>
        </div>
        <button class="vidgrab-modal-close" id="vidgrab-close-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="vidgrab-modal-body">
        <div id="vidgrab-loading" class="vidgrab-state">
          <div class="vidgrab-spinner"></div>
          <div class="vidgrab-state-text">CONNECTING<span class="vidgrab-blink">_</span></div>
        </div>

        <div id="vidgrab-not-running" class="vidgrab-state vidgrab-hidden">
          <div class="vidgrab-state-icon error">!</div>
          <div class="vidgrab-state-title">APP NOT RUNNING</div>
          <div class="vidgrab-state-text">// Start VidGrab desktop app first</div>
        </div>

        <div id="vidgrab-formats" class="vidgrab-hidden">
          <div class="vidgrab-video-info">
            <div class="vidgrab-video-thumb" id="vidgrab-thumb"></div>
            <div class="vidgrab-video-details">
              <div class="vidgrab-video-title" id="vidgrab-title">Loading...</div>
              <div class="vidgrab-video-meta" id="vidgrab-meta">VIDEO</div>
            </div>
          </div>

          <div class="vidgrab-section">
            <div class="vidgrab-section-title">// VIDEO QUALITY</div>
            <div class="vidgrab-format-list" id="vidgrab-video-formats"></div>
          </div>

          <div class="vidgrab-section">
            <div class="vidgrab-section-title">// AUDIO ONLY</div>
            <div class="vidgrab-format-list" id="vidgrab-audio-formats"></div>
          </div>

          <button class="vidgrab-download-btn" id="vidgrab-add-queue" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>ADD TO QUEUE</span>
          </button>
        </div>

        <div id="vidgrab-success" class="vidgrab-state vidgrab-hidden">
          <div class="vidgrab-state-icon success">✓</div>
          <div class="vidgrab-state-title">QUEUED</div>
          <div class="vidgrab-state-text" id="vidgrab-success-msg">// Download added to queue</div>
          <button class="vidgrab-btn-secondary" id="vidgrab-another">ADD ANOTHER</button>
        </div>

        <div id="vidgrab-error" class="vidgrab-state vidgrab-hidden">
          <div class="vidgrab-state-icon error">!</div>
          <div class="vidgrab-state-title">ERROR</div>
          <div class="vidgrab-state-text" id="vidgrab-error-msg">// Something went wrong</div>
          <button class="vidgrab-btn-secondary" id="vidgrab-retry">RETRY</button>
        </div>
      </div>

      <div class="vidgrab-modal-footer">
        <span>VIDGRAB v1.1.0</span>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Event listeners
  modalEl.querySelector('.vidgrab-modal-backdrop').addEventListener('click', closeModal);
  modalEl.querySelector('#vidgrab-close-btn').addEventListener('click', closeModal);
  modalEl.querySelector('#vidgrab-add-queue').addEventListener('click', addToQueue);
  modalEl.querySelector('#vidgrab-another').addEventListener('click', () => loadFormats(currentVideoUrl));
  modalEl.querySelector('#vidgrab-retry').addEventListener('click', () => loadFormats(currentVideoUrl));

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('vidgrab-hidden')) {
      closeModal();
    }
  });

  return modalEl;
}

// Show modal
function showModal() {
  if (!modal) {
    modal = createModal();
  }
  modal.classList.remove('vidgrab-hidden');
  document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
  if (modal) {
    modal.classList.add('vidgrab-hidden');
    document.body.style.overflow = '';
  }
}

// Show specific state in modal
function showState(stateId) {
  const states = ['vidgrab-loading', 'vidgrab-not-running', 'vidgrab-formats', 'vidgrab-success', 'vidgrab-error'];
  states.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('vidgrab-hidden', id !== stateId);
    }
  });
}

// Handle download button click for single video
async function handleDownloadClick(e) {
  e.preventDefault();
  e.stopPropagation();

  currentVideoUrl = getVideoUrl();
  if (!currentVideoUrl) {
    showNotification('Could not detect video URL', 'error');
    return;
  }

  showModal();
  await loadFormats(currentVideoUrl);
}

// Handle playlist/channel download button click
async function handlePlaylistDownloadClick(type) {
  const url = window.location.href;

  showModal();
  showState('vidgrab-loading');

  try {
    // Check if app is running
    const status = await sendMessage({ type: 'CHECK_STATUS' });

    if (!status || !status.running) {
      showState('vidgrab-not-running');
      return;
    }

    // Get info about the playlist/channel
    const data = await sendMessage({ type: 'GET_FORMATS', url });

    if (data.error) {
      throw new Error(data.error);
    }

    // Add directly to queue with best format
    const result = await sendMessage({
      type: 'ADD_TO_QUEUE',
      data: {
        url: url,
        format: 'bestvideo+bestaudio/best',
        audioOnly: false,
        title: data.title || (type === 'playlist' ? 'Playlist' : 'Channel'),
        thumbnail: data.thumbnail,
      },
    });

    if (result.error) {
      throw new Error(result.error);
    }

    document.getElementById('vidgrab-success-msg').textContent = `// ${type === 'playlist' ? 'Playlist' : 'Channel'} added at position ${result.position}`;
    showState('vidgrab-success');
  } catch (error) {
    console.error('VidGrab error:', error);
    document.getElementById('vidgrab-error-msg').textContent = `// ${error.message || 'Failed to add to queue'}`;
    showState('vidgrab-error');
  }
}

// Load formats from VidGrab
let selectedFormat = null;
let videoInfo = null;

async function loadFormats(url) {
  showState('vidgrab-loading');
  selectedFormat = null;
  videoInfo = null;

  try {
    // Check if app is running
    const status = await sendMessage({ type: 'CHECK_STATUS' });

    if (!status || !status.running) {
      showState('vidgrab-not-running');
      return;
    }

    // Get formats
    const data = await sendMessage({ type: 'GET_FORMATS', url });

    if (data.error) {
      throw new Error(data.error);
    }

    videoInfo = {
      title: data.title,
      thumbnail: data.thumbnail,
      type: data.type,
    };

    // Update UI
    document.getElementById('vidgrab-title').textContent = data.title;
    document.getElementById('vidgrab-meta').textContent = (data.type || 'VIDEO').toUpperCase();

    const thumbEl = document.getElementById('vidgrab-thumb');
    if (data.thumbnail) {
      thumbEl.innerHTML = `<img src="${data.thumbnail}" alt="Thumbnail">`;
    } else {
      thumbEl.innerHTML = `<div class="vidgrab-thumb-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`;
    }

    // Populate formats
    const videoFormatsEl = document.getElementById('vidgrab-video-formats');
    const audioFormatsEl = document.getElementById('vidgrab-audio-formats');
    videoFormatsEl.innerHTML = '';
    audioFormatsEl.innerHTML = '';

    const videoFormats = data.formats.filter(f => !f.isAudioOnly);
    const audioFormats = data.formats.filter(f => f.isAudioOnly);

    videoFormats.forEach((format, index) => {
      const btn = createFormatButton(format, index === 0);
      videoFormatsEl.appendChild(btn);
    });

    audioFormats.forEach(format => {
      audioFormatsEl.appendChild(createFormatButton(format, false));
    });

    // Auto-select first format
    if (videoFormats.length > 0) {
      selectedFormat = videoFormats[0];
      document.getElementById('vidgrab-add-queue').disabled = false;
    }

    showState('vidgrab-formats');
  } catch (error) {
    console.error('VidGrab error:', error);
    document.getElementById('vidgrab-error-msg').textContent = `// ${error.message || 'Failed to load formats'}`;
    showState('vidgrab-error');
  }
}

// Create format button
function createFormatButton(format, selected) {
  const btn = document.createElement('button');
  btn.className = `vidgrab-format-btn ${selected ? 'selected' : ''}`;
  btn.innerHTML = `
    <span class="vidgrab-format-quality">${format.quality}</span>
    <span class="vidgrab-format-ext">${format.ext.toUpperCase()}</span>
  `;

  btn.addEventListener('click', () => {
    document.querySelectorAll('.vidgrab-format-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedFormat = format;
    document.getElementById('vidgrab-add-queue').disabled = false;
  });

  return btn;
}

// Add to queue
async function addToQueue() {
  if (!selectedFormat || !currentVideoUrl || !videoInfo) return;

  const btn = document.getElementById('vidgrab-add-queue');
  btn.disabled = true;
  btn.innerHTML = '<div class="vidgrab-spinner-small"></div><span>ADDING...</span>';

  try {
    const result = await sendMessage({
      type: 'ADD_TO_QUEUE',
      data: {
        url: currentVideoUrl,
        format: selectedFormat.formatId,
        audioOnly: selectedFormat.isAudioOnly,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
      },
    });

    if (result.error) {
      throw new Error(result.error);
    }

    document.getElementById('vidgrab-success-msg').textContent = `// Added at position ${result.position}`;
    showState('vidgrab-success');
  } catch (error) {
    document.getElementById('vidgrab-error-msg').textContent = `// ${error.message || 'Failed to add to queue'}`;
    showState('vidgrab-error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>ADD TO QUEUE</span>
    `;
  }
}

// Get current video URL
function getVideoUrl() {
  const url = window.location.href;

  // Check if it's a video page
  if (url.includes('youtube.com/watch')) {
    return url.split('&list=')[0]; // Remove playlist parameter for single video
  }

  // Check if it's a shorts page
  if (url.includes('youtube.com/shorts/')) {
    const videoId = url.match(/shorts\/([^/?]+)/)?.[1];
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  return url;
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || {});
      }
    });
  });
}

// Show notification toast
function showNotification(message, type = 'info') {
  const existing = document.querySelector('.vidgrab-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `vidgrab-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Remove all injected buttons
function removeAllButtons() {
  const videoWrapper = document.getElementById('vidgrab-btn-wrapper');
  if (videoWrapper) videoWrapper.remove();

  const playlistWrapper = document.getElementById('vidgrab-playlist-wrapper');
  if (playlistWrapper) playlistWrapper.remove();

  downloadButton = null;
  playlistButton = null;
}

// Get video count from page
function getVideoCount() {
  // Try to find video count from playlist header
  const statsEl = document.querySelector('yt-formatted-string.byline-item');
  if (statsEl) {
    const match = statsEl.textContent.match(/(\d+)\s*video/i);
    if (match) return parseInt(match[1]);
  }

  // Count visible videos in playlist
  const videos = document.querySelectorAll('ytd-playlist-video-renderer, ytd-grid-video-renderer');
  return videos.length || null;
}

// Inject button for video pages
function injectVideoButton() {
  // Don't inject if already present
  if (document.getElementById('vidgrab-download-btn')) return true;

  // Try to find the action buttons container (below video)
  const actionBar = document.querySelector('#top-level-buttons-computed');

  if (actionBar) {
    downloadButton = createDownloadButton();

    // Create a wrapper to match YouTube's button styling
    const wrapper = document.createElement('div');
    wrapper.id = 'vidgrab-btn-wrapper';
    wrapper.className = 'vidgrab-btn-wrapper';
    wrapper.appendChild(downloadButton);

    // Insert after the share button or at the end
    const shareButton = actionBar.querySelector('ytd-button-renderer:has([aria-label*="Share"])') ||
                        actionBar.querySelector('yt-button-view-model:has([aria-label*="Share"])');

    if (shareButton) {
      shareButton.insertAdjacentElement('afterend', wrapper);
    } else {
      actionBar.appendChild(wrapper);
    }

    currentVideoUrl = getVideoUrl();
    return true;
  }
  return false;
}

// Inject button for playlist pages
function injectPlaylistButton() {
  // Don't inject if already present
  if (document.getElementById('vidgrab-playlist-btn')) return true;

  // Find playlist header area - try multiple selectors for different playlist layouts
  const selectors = [
    'ytd-playlist-header-renderer #top-level-buttons-computed',
    'ytd-playlist-header-renderer .metadata-action-bar',
    'ytd-playlist-header-renderer #menu',
    'ytd-playlist-header-renderer #top-level-buttons',
    'ytd-playlist-header-renderer ytd-button-renderer',
    '#page-header-banner-container',
    'ytd-playlist-header-renderer #header-container',
    'ytd-playlist-header-renderer',
    // New YouTube layout selectors
    'ytd-playlist-header-renderer yt-flexible-actions-view-model',
    '.page-header-view-model-wiz__page-header-headline-info',
    // Additional selectors for new layouts
    'ytd-playlist-header-renderer #actions',
    'ytd-playlist-header-renderer .yt-flexible-actions-view-model-wiz',
  ];

  let headerArea = null;
  for (const selector of selectors) {
    headerArea = document.querySelector(selector);
    if (headerArea) break;
  }

  if (headerArea) {
    const count = getVideoCount();
    playlistButton = createPlaylistButton('playlist', count);

    const wrapper = document.createElement('div');
    wrapper.id = 'vidgrab-playlist-wrapper';
    wrapper.className = 'vidgrab-playlist-wrapper';
    wrapper.appendChild(playlistButton);

    // Try to insert in a good spot
    const buttonsContainer = headerArea.querySelector('#top-level-buttons-computed') ||
                             headerArea.querySelector('#top-level-buttons') ||
                             headerArea.querySelector('.metadata-action-bar') ||
                             headerArea.querySelector('yt-flexible-actions-view-model') ||
                             headerArea.querySelector('#buttons') ||
                             headerArea.querySelector('#menu');

    if (buttonsContainer) {
      buttonsContainer.appendChild(wrapper);
    } else {
      headerArea.appendChild(wrapper);
    }

    return true;
  }
  return false;
}

// Inject button for channel pages
function injectChannelButton() {
  // Don't inject if already present
  if (document.getElementById('vidgrab-playlist-btn')) return true;

  // Find channel header area - try multiple selectors for different channel layouts
  const selectors = [
    '#channel-header #buttons',
    '#channel-header-container #buttons',
    'ytd-c4-tabbed-header-renderer #buttons',
    '#channel-header-container',
    'ytd-c4-tabbed-header-renderer #inner-header-container',
    'ytd-c4-tabbed-header-renderer',
    '#inner-header-container',
    // New YouTube layout selectors
    '.page-header-view-model-wiz__page-header-headline-info',
    'yt-page-header-renderer',
    // Additional selectors for channel layouts
    'yt-page-header-renderer #buttons',
    '.yt-flexible-actions-view-model-wiz',
  ];

  let headerArea = null;
  for (const selector of selectors) {
    headerArea = document.querySelector(selector);
    if (headerArea) break;
  }

  if (headerArea) {
    playlistButton = createPlaylistButton('channel');

    const wrapper = document.createElement('div');
    wrapper.id = 'vidgrab-playlist-wrapper';
    wrapper.className = 'vidgrab-playlist-wrapper vidgrab-channel-wrapper';
    wrapper.appendChild(playlistButton);

    // Find buttons area in channel header
    const buttonsContainer = headerArea.querySelector('#buttons') ||
                             headerArea.querySelector('#subscribe-button')?.parentElement ||
                             headerArea.querySelector('.yt-flexible-actions-view-model-wiz__action') ||
                             headerArea.querySelector('yt-flexible-actions-view-model') ||
                             headerArea.querySelector('#inner-header-container');

    if (buttonsContainer) {
      buttonsContainer.appendChild(wrapper);
    } else {
      headerArea.appendChild(wrapper);
    }

    return true;
  }
  return false;
}

// Main injection function
function injectButton() {
  const currentUrl = window.location.href;
  const pageType = getPageType();

  // If page type changed or URL changed, remove old buttons
  if (lastInjectedUrl !== currentUrl || lastInjectedType !== pageType) {
    removeAllButtons();
    lastInjectedUrl = currentUrl;
    lastInjectedType = pageType;
    injectionAttempts = 0;
  }

  if (!pageType) return;

  let success = false;

  switch (pageType) {
    case 'video':
    case 'shorts':
      success = injectVideoButton();
      break;
    case 'playlist':
      success = injectPlaylistButton();
      break;
    case 'channel':
      success = injectChannelButton();
      break;
  }

  return success;
}

// Watch for page navigation (YouTube is a SPA)
let injectionDebounceTimer = null;
let lastInjectionTime = 0;

function debounceInject(delay = 100) {
  if (injectionDebounceTimer) {
    clearTimeout(injectionDebounceTimer);
  }
  injectionDebounceTimer = setTimeout(() => {
    const now = Date.now();
    // Prevent too frequent injections
    if (now - lastInjectionTime < 50) return;
    lastInjectionTime = now;
    injectButton();
  }, delay);
}

function watchForNavigation() {
  let lastUrl = window.location.href;

  // Helper to check for video ID changes
  function checkVideoIdChange() {
    const pageType = getPageType();
    if (pageType === 'video') {
      const newVideoId = getVideoId();
      if (newVideoId && newVideoId !== lastVideoId) {
        lastVideoId = newVideoId;
        removeAllButtons();
        injectionAttempts = 0;
        debounceInject(100);
        setTimeout(() => debounceInject(300), 300);
        setTimeout(() => debounceInject(600), 600);
        return true;
      }
    }
    return false;
  }

  // Listen for YouTube navigation events (most reliable)
  window.addEventListener('yt-navigate-finish', () => {
    injectionAttempts = 0;
    lastUrl = window.location.href;
    lastVideoId = getVideoId();
    // Staggered injection attempts for reliability
    debounceInject(100);
    setTimeout(() => debounceInject(300), 300);
    setTimeout(() => debounceInject(600), 600);
    setTimeout(() => debounceInject(1000), 1000);
    setTimeout(() => debounceInject(1500), 1500);
  });

  window.addEventListener('yt-navigate-start', () => {
    removeAllButtons();
    injectionAttempts = 0;
    lastVideoId = null;
  });

  // Listen for YouTube page data updates (catches video changes within same page)
  window.addEventListener('yt-page-data-updated', () => {
    const newUrl = window.location.href;
    const videoIdChanged = checkVideoIdChange();

    if (newUrl !== lastUrl || videoIdChanged) {
      lastUrl = newUrl;
      if (!videoIdChanged) {
        injectionAttempts = 0;
        removeAllButtons();
      }
      debounceInject(100);
      setTimeout(() => debounceInject(300), 300);
    }
  });

  // Also listen for popstate (back/forward)
  window.addEventListener('popstate', () => {
    injectionAttempts = 0;
    lastVideoId = getVideoId();
    debounceInject(100);
    setTimeout(() => debounceInject(300), 300);
    setTimeout(() => debounceInject(600), 600);
  });

  // Use MutationObserver only for detecting when action bar appears
  observer = new MutationObserver((mutations) => {
    const newUrl = window.location.href;
    const pageType = getPageType();

    // Check for video ID change (SPA navigation within video pages)
    if (pageType === 'video') {
      const newVideoId = getVideoId();
      if (newVideoId && newVideoId !== lastVideoId) {
        lastVideoId = newVideoId;
        removeAllButtons();
        injectionAttempts = 0;
        debounceInject(100);
        return;
      }
    }

    // URL changed - need to reinject
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      lastVideoId = getVideoId();
      injectionAttempts = 0;
      removeAllButtons();
      debounceInject(100);
      return;
    }

    // Check if relevant elements appeared
    if (!pageType) return;

    const hasButton = (pageType === 'video' || pageType === 'shorts')
      ? document.getElementById('vidgrab-download-btn')
      : document.getElementById('vidgrab-playlist-btn');

    if (!hasButton && injectionAttempts < 50) {
      // Check if action bar exists now
      const actionBar = document.querySelector('#top-level-buttons-computed');
      const playlistHeader = document.querySelector('ytd-playlist-header-renderer');
      const channelHeader = document.querySelector('#channel-header-container, ytd-c4-tabbed-header-renderer, yt-page-header-renderer');

      if ((pageType === 'video' || pageType === 'shorts') && actionBar) {
        debounceInject(50);
      } else if (pageType === 'playlist' && playlistHeader) {
        debounceInject(50);
      } else if (pageType === 'channel' && channelHeader) {
        debounceInject(50);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Poll for missing buttons as a fallback (less aggressive)
  urlCheckInterval = setInterval(() => {
    const newUrl = window.location.href;
    const pageType = getPageType();

    // Check for video ID change
    if (pageType === 'video') {
      const newVideoId = getVideoId();
      if (newVideoId && newVideoId !== lastVideoId) {
        lastVideoId = newVideoId;
        removeAllButtons();
        injectionAttempts = 0;
        debounceInject(100);
        return;
      }
    }

    // URL changed
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      lastVideoId = getVideoId();
      injectionAttempts = 0;
      removeAllButtons();
      debounceInject(100);
      return;
    }

    // Check if button should be there but isn't
    if (pageType && injectionAttempts < 50) {
      const hasButton = (pageType === 'video' || pageType === 'shorts')
        ? document.getElementById('vidgrab-download-btn')
        : document.getElementById('vidgrab-playlist-btn');

      if (!hasButton) {
        injectionAttempts++;
        debounceInject(100);
      }
    }
  }, 500);
}

// Initialize
function init() {
  // Initial injection with multiple attempts
  const tryInject = (attempt = 0) => {
    if (attempt >= 15) return;

    const success = injectButton();
    if (!success) {
      setTimeout(() => tryInject(attempt + 1), 300);
    }
  };

  // Start trying after a short delay
  setTimeout(() => tryInject(), 300);
  watchForNavigation();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
