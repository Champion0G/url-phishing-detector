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

  // Display truncated URL
  if (state.url) {
    let displayUrl = state.url;
    if (displayUrl.length > 60) displayUrl = displayUrl.substring(0, 57) + "...";
    urlBox.textContent = displayUrl;
  } else {
    urlBox.textContent = "No URL to check";
  }

  // Update status display
  const statusMap = {
    safe: {
      icon: "✅",
      text: "SAFE",
      className: "safe"
    },
    danger: {
      icon: "🚨",
      text: "PHISHING BLOCKED",
      className: "danger"
    },
    checking: {
      icon: "⏳",
      text: "Analyzing...",
      className: "checking"
    },
    offline: {
      icon: "⚠️",
      text: "Server Offline",
      className: "offline"
    }
  };

  const info = statusMap[state.status] || statusMap.offline;
  statusIcon.textContent = info.icon;
  statusValue.textContent = info.text;
  statusValue.className = `status-value ${info.className}`;

  // Update probability bar if available
  if (state.probability !== null && state.probability !== undefined) {
    probSection.style.display = "block";
    const pct = (state.probability * 100).toFixed(1);
    probPct.textContent = pct + "%";
    probFill.style.width = pct + "%";
    probFill.className = `prob-fill ${state.status === "danger" ? "danger" : ""}`;
  } else {
    probSection.style.display = "none";
  }
}

// Get the active tab and request its state from the background worker
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || tabs.length === 0) {
    updateUI({ status: "offline", probability: null, url: null });
    return;
  }

  const tabId = tabs[0].id;

  chrome.runtime.sendMessage({ type: "GET_STATE", tabId }, (response) => {
    if (chrome.runtime.lastError || !response) {
      updateUI({ status: "offline", probability: null, url: tabs[0].url });
      return;
    }
    updateUI(response);
  });
});
