// PhishShield AI - Background Service Worker
// Listens to every navigation and checks URL against the local PhishShield API

const API_URL = "http://localhost:8000/predict";

// Track tab states: tabId -> { status, probability, url }
const tabStates = {};

// Track URLs the user has chosen to bypass
const bypassedUrls = new Set();

// Icons — MUST use string keys for chrome.action.setIcon
const ICONS = {
  safe: { "16": "icons/icon-safe-16.png", "48": "icons/icon-safe-48.png", "128": "icons/icon-safe-128.png" },
  danger: { "16": "icons/icon-danger-16.png", "48": "icons/icon-danger-48.png", "128": "icons/icon-danger-128.png" },
  checking: { "16": "icons/icon-checking-16.png", "48": "icons/icon-checking-48.png", "128": "icons/icon-checking-128.png" }
};

function setIcon(tabId, state) {
  chrome.action.setIcon({ tabId, path: ICONS[state] }, () => {
    if (chrome.runtime.lastError) {
      // Tab may have been closed — safe to ignore
    }
  });
}

function setTitle(tabId, title) {
  chrome.action.setTitle({ tabId, title }, () => {
    if (chrome.runtime.lastError) { /* tab closed, ignore */ }
  });
}

// Check a URL against the PhishShield API
async function checkURL(tabId, url) {
  console.log(`[PhishShield] Checking: ${url}`);

  // Skip internal browser pages
  if (!url ||
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("about:") ||
      url.startsWith("edge://") ||
      url.startsWith("devtools://") ||
      url === "about:blank") {
    tabStates[tabId] = { status: "safe", probability: 0, url };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Internal Page");
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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const isPhishing = data.is_phishing;
    const probability = data.probability;

    console.log(`[PhishShield] Result for ${url}: ${data.status} (${(probability * 100).toFixed(1)}%)`);

    tabStates[tabId] = {
      status: isPhishing ? "danger" : "safe",
      probability,
      url
    };

    if (isPhishing) {
      setIcon(tabId, "danger");
      setTitle(tabId, `PhishShield AI — ⚠️ PHISHING (${(probability * 100).toFixed(0)}%)`);

      // Build blocked page URL and redirect
      const blockedUrl = chrome.runtime.getURL(
        `blocked.html?url=${encodeURIComponent(url)}&prob=${probability.toFixed(4)}`
      );
      chrome.tabs.update(tabId, { url: blockedUrl }, () => {
        if (chrome.runtime.lastError) {
          console.warn("[PhishShield] Could not redirect tab:", chrome.runtime.lastError);
        }
      });
    } else {
      setIcon(tabId, "safe");
      setTitle(tabId, `PhishShield AI — ✅ Safe (${(probability * 100).toFixed(0)}% threat)`);
    }

  } catch (err) {
    // Server offline — fail open (don't block browsing)
    console.warn("[PhishShield] API unreachable:", err.message);
    tabStates[tabId] = { status: "safe", probability: null, url, error: true };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Server Offline");
  }
}

// ─── Navigation Listener ───────────────────────────────────────────────────
chrome.webNavigation.onCommitted.addListener((details) => {
  // Only check top-level frame (not iframes)
  if (details.frameId !== 0) return;

  // Skip our own blocked page to avoid redirect loops
  if (details.url.startsWith(chrome.runtime.getURL("blocked.html"))) return;

  // Skip if user bypassed this URL
  if (bypassedUrls.has(details.url)) {
    tabStates[details.tabId] = { status: "safe", probability: null, url: details.url, bypassed: true };
    setIcon(details.tabId, "safe");
    setTitle(details.tabId, "PhishShield AI — Bypassed by user");
    return;
  }

  checkURL(details.tabId, details.url);
});

// ─── Message Handler (popup + blocked.html) ─────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    const state = tabStates[message.tabId] || { status: "safe", probability: null, url: null };
    sendResponse(state);
    return true;
  }

  if (message.type === "BYPASS_URL") {
    bypassedUrls.add(message.url);
    chrome.tabs.update(message.tabId, { url: message.url }, () => {
      sendResponse({ ok: true });
    });
    return true; // keep channel open for async
  }
});

console.log("[PhishShield] Background service worker started ✅");
