// VidGrab Extension Popup

let currentUrl = null;
let currentFormats = null;
let selectedFormat = null;
let videoInfo = null;

// DOM Elements
const elements = {
  status: document.getElementById('status'),
  loading: document.getElementById('loading'),
  notRunning: document.getElementById('not-running'),
  noVideo: document.getElementById('no-video'),
  videoFound: document.getElementById('video-found'),
  success: document.getElementById('success'),
  error: document.getElementById('error'),
  videoThumbnail: document.querySelector('#video-thumbnail img'),
  videoTitle: document.getElementById('video-title'),
  videoType: document.getElementById('video-type'),
  videoFormats: document.getElementById('video-formats'),
  audioFormats: document.getElementById('audio-formats'),
  downloadBtn: document.getElementById('download-btn'),
  addAnotherBtn: document.getElementById('add-another-btn'),
  retryBtn: document.getElementById('retry-btn'),
  errorMessage: document.getElementById('error-message'),
  successMessage: document.getElementById('success-message'),
};

// Show a specific state
function showState(stateId) {
  const states = ['loading', 'notRunning', 'noVideo', 'videoFound', 'success', 'error'];
  states.forEach(id => {
    const el = elements[id];
    if (el) {
      el.classList.toggle('hidden', id !== stateId);
    }
  });
}

// Update status indicator
function updateStatus(isRunning) {
  const statusEl = elements.status;
  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');

  if (isRunning) {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
    text.textContent = 'Connected';
  } else {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
    text.textContent = 'Disconnected';
  }
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

// Get current tab URL
async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || null;
}

// Check if URL is a valid YouTube video
function isValidYouTubeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const isYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com']
      .some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));

    if (!isYouTube) return false;

    // Check if it's a video, shorts, or music page
    return parsed.pathname.includes('/watch') ||
           parsed.pathname.includes('/shorts/') ||
           parsed.searchParams.has('v');
  } catch {
    return false;
  }
}

// Normalize YouTube URL
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    // Handle shorts
    if (parsed.pathname.includes('/shorts/')) {
      const videoId = parsed.pathname.match(/shorts\/([^/?]+)/)?.[1];
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    // Handle youtu.be
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1);
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // Clean up the URL (remove extra parameters)
    const videoId = parsed.searchParams.get('v');
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    return url;
  } catch {
    return url;
  }
}

// Create format button
function createFormatButton(format) {
  const button = document.createElement('button');
  button.className = 'format-btn';
  button.dataset.formatId = format.formatId;
  button.dataset.isAudioOnly = format.isAudioOnly;

  button.innerHTML = `
    <span class="format-quality">${format.quality}</span>
    <span class="format-ext">${format.ext.toUpperCase()}</span>
  `;

  button.addEventListener('click', () => {
    // Deselect all
    document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('selected'));
    // Select this one
    button.classList.add('selected');
    selectedFormat = format;
    elements.downloadBtn.disabled = false;
  });

  return button;
}

// Load video formats
async function loadFormats(url) {
  try {
    showState('loading');

    const data = await sendMessage({ type: 'GET_FORMATS', url });

    videoInfo = {
      title: data.title,
      thumbnail: data.thumbnail,
      type: data.type,
    };

    currentFormats = data.formats;

    // Update UI
    elements.videoTitle.textContent = data.title;
    elements.videoType.textContent = data.type?.toUpperCase() || 'VIDEO';

    if (data.thumbnail) {
      elements.videoThumbnail.src = data.thumbnail;
      elements.videoThumbnail.parentElement.classList.remove('hidden');
    }

    // Populate format lists
    elements.videoFormats.innerHTML = '';
    elements.audioFormats.innerHTML = '';

    const videoFormats = data.formats.filter(f => !f.isAudioOnly);
    const audioFormats = data.formats.filter(f => f.isAudioOnly);

    videoFormats.forEach(format => {
      elements.videoFormats.appendChild(createFormatButton(format));
    });

    audioFormats.forEach(format => {
      elements.audioFormats.appendChild(createFormatButton(format));
    });

    // Auto-select first video format
    if (videoFormats.length > 0) {
      const firstBtn = elements.videoFormats.querySelector('.format-btn');
      if (firstBtn) {
        firstBtn.click();
      }
    }

    showState('videoFound');
  } catch (error) {
    console.error('Failed to load formats:', error);
    elements.errorMessage.textContent = error.message || 'Failed to load video formats';
    showState('error');
  }
}

// Add to download queue
async function addToQueue() {
  if (!selectedFormat || !currentUrl || !videoInfo) return;

  const btn = elements.downloadBtn;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-small"></div><span>Adding...</span>';

  try {
    const result = await sendMessage({
      type: 'ADD_TO_QUEUE',
      data: {
        url: currentUrl,
        format: selectedFormat.formatId,
        audioOnly: selectedFormat.isAudioOnly,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
      },
    });

    elements.successMessage.textContent = `Added to queue at position ${result.position}`;
    showState('success');
  } catch (error) {
    console.error('Failed to add to queue:', error);
    elements.errorMessage.textContent = error.message || 'Failed to add to queue';
    showState('error');
  }
}

// Initialize popup
async function init() {
  showState('loading');

  // Check if app is running
  try {
    const status = await sendMessage({ type: 'CHECK_STATUS' });
    updateStatus(status.running);

    if (!status.running) {
      showState('notRunning');
      return;
    }
  } catch (error) {
    console.error('Failed to check status:', error);
    updateStatus(false);
    showState('notRunning');
    return;
  }

  // Check for pending URL from content script
  const stored = await chrome.storage.local.get('pendingDownloadUrl');
  if (stored.pendingDownloadUrl) {
    currentUrl = normalizeUrl(stored.pendingDownloadUrl);
    await chrome.storage.local.remove('pendingDownloadUrl');
    await loadFormats(currentUrl);
    return;
  }

  // Get current tab URL
  const tabUrl = await getCurrentTabUrl();

  if (!isValidYouTubeUrl(tabUrl)) {
    showState('noVideo');
    return;
  }

  currentUrl = normalizeUrl(tabUrl);
  await loadFormats(currentUrl);
}

// Event listeners
elements.downloadBtn.addEventListener('click', addToQueue);

elements.addAnotherBtn.addEventListener('click', () => {
  selectedFormat = null;
  elements.downloadBtn.disabled = true;
  elements.downloadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Add to Queue</span>
  `;
  document.querySelectorAll('.format-btn').forEach(btn => btn.classList.remove('selected'));
  showState('videoFound');
});

elements.retryBtn.addEventListener('click', () => {
  init();
});

// Start
init();
