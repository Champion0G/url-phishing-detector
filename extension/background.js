// PhishShield AI - Background Service Worker

const API_URL = "http://localhost:8000/predict";

// Track tab states: tabId -> { status, probability, url }
const tabStates = {};

// Track URLs the user has chosen to bypass
const bypassedUrls = new Set();

// Icons — string keys required by chrome.action.setIcon
const ICONS = {
  safe:     { "16": "icons/icon-safe-16.png",     "48": "icons/icon-safe-48.png",     "128": "icons/icon-safe-128.png"     },
  danger:   { "16": "icons/icon-danger-16.png",   "48": "icons/icon-danger-48.png",   "128": "icons/icon-danger-128.png"   },
  checking: { "16": "icons/icon-checking-16.png", "48": "icons/icon-checking-48.png", "128": "icons/icon-checking-128.png" }
};

function setIcon(tabId, state) {
  chrome.action.setIcon({ tabId, path: ICONS[state] }, () => { chrome.runtime.lastError; });
}
function setTitle(tabId, title) {
  chrome.action.setTitle({ tabId, title }, () => { chrome.runtime.lastError; });
}

// ─── Main URL checker ────────────────────────────────────────────────────────
async function checkURL(tabId, url) {
  console.log(`[PhishShield] Checking: ${url}`);

  // Skip internal browser pages (no content script on these anyway)
  if (!url ||
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("devtools://") ||
      url === "about:blank" ||
      url === "about:newtab") {
    tabStates[tabId] = { status: "safe", probability: 0, url };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Internal page");
    return;
  }

  // Set checking state
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
    const { is_phishing: isPhishing, probability } = data;

    console.log(`[PhishShield] ${url} → ${data.status} (${(probability * 100).toFixed(1)}%)`);

    tabStates[tabId] = { status: isPhishing ? "danger" : "safe", probability, url };

    if (isPhishing) {
      setIcon(tabId, "danger");
      setTitle(tabId, `PhishShield AI — ⚠️ PHISHING (${(probability * 100).toFixed(0)}%)`);

      // Redirect to blocked page
      const blockedUrl = chrome.runtime.getURL(
        `blocked.html?url=${encodeURIComponent(url)}&prob=${probability.toFixed(4)}`
      );
      chrome.tabs.update(tabId, { url: blockedUrl }, () => { chrome.runtime.lastError; });
    } else {
      setIcon(tabId, "safe");
      setTitle(tabId, `PhishShield AI — ✅ Safe (${(probability * 100).toFixed(0)}% threat)`);
    }

  } catch (err) {
    console.warn("[PhishShield] API unreachable:", err.message);
    tabStates[tabId] = { status: "safe", probability: null, url, error: true };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Server Offline");
  }
}

// ─── Navigation Listeners ─────────────────────────────────────────────────────

// PRIMARY: tabs.onUpdated fires reliably for every navigation including new tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Wait until the page has started loading (we have the URL)
  if (changeInfo.status !== "loading") return;

  const url = tab.url || changeInfo.url;
  if (!url) return;

  // Skip our own blocked page
  if (url.startsWith(chrome.runtime.getURL("blocked.html"))) return;

  // Skip if user bypassed
  if (bypassedUrls.has(url)) {
    tabStates[tabId] = { status: "safe", probability: null, url, bypassed: true };
    setIcon(tabId, "safe");
    setTitle(tabId, "PhishShield AI — Bypassed by user");
    return;
  }

  checkURL(tabId, url);
});

// BACKUP: also listen to onCommitted for cases tabs.onUpdated misses (e.g. pushState)
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  if (details.url.startsWith(chrome.runtime.getURL("blocked.html"))) return;
  if (bypassedUrls.has(details.url)) return;

  // Only re-check if we don't already have a recent check for this URL
  const existing = tabStates[details.tabId];
  if (existing && existing.url === details.url && existing.status !== "checking") return;

  checkURL(details.tabId, details.url);
});

// ─── Message Handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    sendResponse(tabStates[message.tabId] || { status: "safe", probability: null, url: null });
    return true;
  }

  if (message.type === "BYPASS_URL") {
    bypassedUrls.add(message.url);
    chrome.tabs.update(message.tabId, { url: message.url }, () => {
      chrome.runtime.lastError;
      sendResponse({ ok: true });
    });
    return true;
  }
});

console.log("[PhishShield] Background service worker started ✅");
