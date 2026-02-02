const API_BASE = 'http://127.0.0.1:3847';

// Check if VidGrab app is running
async function checkAppStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.ok) {
      return await response.json();
    }
    return { running: false };
  } catch (error) {
    return { running: false, error: error.message };
  }
}

// Get available formats for a URL
async function getFormats(url) {
  try {
    const response = await fetch(`${API_BASE}/api/formats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (response.ok) {
      return await response.json();
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to get formats');
  } catch (error) {
    throw error;
  }
}

// Add download to queue
async function addToQueue(data) {
  try {
    const response = await fetch(`${API_BASE}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (response.ok) {
      return await response.json();
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to add to queue');
  } catch (error) {
    throw error;
  }
}

// Get queue status
async function getQueueStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/queue`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.ok) {
      return await response.json();
    }
    return { items: [], isProcessing: false, isPaused: false };
  } catch (error) {
    return { items: [], isProcessing: false, isPaused: false, error: error.message };
  }
}

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'CHECK_STATUS':
          sendResponse(await checkAppStatus());
          break;
        case 'GET_FORMATS':
          sendResponse(await getFormats(message.url));
          break;
        case 'ADD_TO_QUEUE':
          sendResponse(await addToQueue(message.data));
          break;
        case 'GET_QUEUE':
          sendResponse(await getQueueStatus());
          break;
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ error: error.message });
    }
  })();
  return true; // Keep message channel open for async response
});

// Update badge when queue changes
async function updateBadge() {
  try {
    const status = await checkAppStatus();
    if (status.running && status.queueLength > 0) {
      chrome.action.setBadgeText({ text: status.queueLength.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#00d4aa' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Check badge periodically when app is running
setInterval(updateBadge, 5000);
