// PhishShield AI - Background Service Worker
// Listens to every navigation and checks URL against the local PhishShield API

const API_URL = "http://localhost:8000/predict";
const PHISHING_THRESHOLD = 0.9;

// Track tab states: tabId -> { status, probability, url }
const tabStates = {};

// Track URLs the user has chosen to bypass
const bypassedUrls = new Set();

// Icons for safe and danger states
const ICONS = {
  safe: {
    16: "icons/icon-safe-16.png",
    48: "icons/icon-safe-48.png",
    128: "icons/icon-safe-128.png"
  },
  danger: {
    16: "icons/icon-danger-16.png",
    48: "icons/icon-danger-48.png",
    128: "icons/icon-danger-128.png"
  },
  checking: {
    16: "icons/icon-checking-16.png",
    48: "icons/icon-checking-48.png",
    128: "icons/icon-checking-128.png"
  }
};

function setIcon(tabId, state) {
  chrome.action.setIcon({
    tabId,
    path: ICONS[state]
  });
}

function setTitle(tabId, title) {
  chrome.action.setTitle({ tabId, title });
}

// Check a URL against the PhishShield API
async function checkURL(tabId, url) {
  // Skip internal Chrome pages and extension pages
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:") || url.startsWith("edge://")) {
    tabStates[tabId] = { status: "safe", probability: 0, url };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Safe Page");
    return;
  }

  // Show checking state
  tabStates[tabId] = { status: "checking", probability: null, url };
  setIcon(tabId, "checking");
  setTitle(tabId, "PhishShield AI — Analyzing...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) throw new Error("API error");

    const data = await response.json();
    const isPhishing = data.is_phishing;
    const probability = data.probability;

    tabStates[tabId] = {
      status: isPhishing ? "danger" : "safe",
      probability,
      url
    };

    if (isPhishing) {
      setIcon(tabId, "danger");
      setTitle(tabId, `PhishShield AI — ⚠️ PHISHING DETECTED (${(probability * 100).toFixed(0)}%)`);

      // Redirect the tab to the blocked warning page
      const blockedUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(url)}&prob=${probability.toFixed(4)}`);
      chrome.tabs.update(tabId, { url: blockedUrl });
    } else {
      setIcon(tabId, "safe");
      setTitle(tabId, `PhishShield AI — ✅ Safe (Threat: ${(probability * 100).toFixed(0)}%)`);
    }
  } catch (err) {
    // If server is offline, fail open (don't block)
    tabStates[tabId] = { status: "safe", probability: null, url, error: true };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Server Offline");
    console.warn("PhishShield: could not reach API:", err.message);
  }
}

// Listen on every committed navigation (page actually loaded)
chrome.webNavigation.onCommitted.addListener((details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  // Don't re-check if we navigated to our own blocked page
  if (details.url.startsWith(chrome.runtime.getURL("blocked.html"))) return;

  // Skip if the user explicitly chose to bypass this URL
  if (bypassedUrls.has(details.url)) {
    tabStates[details.tabId] = { status: "safe", probability: null, url: details.url, bypassed: true };
    setIcon(details.tabId, "safe");
    setTitle(details.tabId, "PhishShield AI — Bypassed by user");
    return;
  }

  checkURL(details.tabId, details.url);
});

// Expose state to popup via a simple message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    const state = tabStates[message.tabId] || { status: "safe", probability: null, url: null };
    sendResponse(state);
  }

  if (message.type === "BYPASS_URL") {
    bypassedUrls.add(message.url);
    // Navigate the tab to the actual URL now
    chrome.tabs.update(message.tabId, { url: message.url });
    sendResponse({ ok: true });
  }

  return true; // Keep message channel open for async response
});

