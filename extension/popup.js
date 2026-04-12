// PhishShield AI - Popup Script

function openDashboard() {
  chrome.tabs.create({ url: "http://localhost:8000" });
}

function updateUI(state) {
  const statusIcon = document.getElementById("statusIcon");
  const statusValue = document.getElementById("statusValue");
  const urlBox = document.getElementById("urlBox");
  const probSection = document.getElementById("probSection");
  const probPct = document.getElementById("probPct");
  const probFill = document.getElementById("probFill");
  const loader = document.getElementById("ps-loader");

  // Display truncated URL
  if (state.url) {
    let displayUrl = state.url;
    if (displayUrl.length > 60) displayUrl = displayUrl.substring(0, 57) + "...";
    urlBox.textContent = displayUrl;
  } else {
    urlBox.textContent = "No URL to check";
  }

  const statusMap = {
    safe:     { icon: "✅", text: "SAFE",            className: "safe"     },
    danger:   { icon: "🚨", text: "PHISHING BLOCKED", className: "danger"   },
    checking: { icon: "⏳", text: "Analyzing...",    className: "checking"  },
    offline:  { icon: "⚠️", text: "Server Offline",  className: "offline"  }
  };

  const info = statusMap[state.status] || statusMap.offline;
  statusIcon.textContent = info.icon;
  statusValue.textContent = info.text;
  statusValue.className = `status-value ${info.className}`;

  // Hide spinner once we have a result
  if (loader) loader.style.display = state.status === "checking" ? "inline-block" : "none";

  // Probability bar
  if (state.probability !== null && state.probability !== undefined) {
    probSection.style.display = "block";
    const pct = (state.probability * 100).toFixed(1);
    probPct.textContent = pct + "%";
    // Animate bar
    setTimeout(() => {
      probFill.style.width = pct + "%";
    }, 50);
    probFill.className = `prob-fill ${state.status === "danger" ? "danger" : ""}`;
  } else {
    probSection.style.display = "none";
  }
}

// ─── Poll until we have a resolved (non-checking) state ───────────────────────
let pollTimer = null;

function fetchState(tabId, tabUrl) {
  chrome.runtime.sendMessage({ type: "GET_STATE", tabId }, (response) => {
    if (chrome.runtime.lastError || !response) {
      updateUI({ status: "offline", probability: null, url: tabUrl });
      return;
    }

    updateUI(response);

    // If still checking, poll again in 600ms
    if (response.status === "checking") {
      pollTimer = setTimeout(() => fetchState(tabId, tabUrl), 600);
    }
  });
}

// Cleanup poll timer when popup is closed
window.addEventListener("unload", () => {
  clearTimeout(pollTimer);
});

// Also listen for direct pushes from background (instant update when result arrives)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PHISHSHIELD_RESULT") {
    clearTimeout(pollTimer); // stop polling — we got the answer
    updateUI({
      status: message.status,
      probability: message.probability,
      url: null // URL already shown, don't overwrite with null
    });
  }
});

// ─── Initialise ──────────────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || tabs.length === 0) {
    updateUI({ status: "offline", probability: null, url: null });
    return;
  }
  const tab = tabs[0];
  fetchState(tab.id, tab.url);
});
