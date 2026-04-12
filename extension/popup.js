// PhishShield AI - Popup Script
// Queries the API directly for the current tab URL — no background state relay needed.

const API_URL = "http://localhost:8000/predict";

function openDashboard() {
  chrome.tabs.create({ url: "http://localhost:8000" });
}

function updateUI({ status, probability, url }) {
  const statusIcon  = document.getElementById("statusIcon");
  const statusValue = document.getElementById("statusValue");
  const urlBox      = document.getElementById("urlBox");
  const probSection = document.getElementById("probSection");
  const probPct     = document.getElementById("probPct");
  const probFill    = document.getElementById("probFill");
  const loader      = document.getElementById("ps-loader");

  // URL display
  if (url) {
    urlBox.textContent = url.length > 60 ? url.substring(0, 57) + "..." : url;
  } else {
    urlBox.textContent = "No URL";
  }

  const MAP = {
    safe:     { icon: "✅", text: "SAFE",             cls: "safe"     },
    danger:   { icon: "🚨", text: "PHISHING BLOCKED", cls: "danger"   },
    checking: { icon: "⏳", text: "Analyzing...",     cls: "checking"  },
    offline:  { icon: "⚠️", text: "Server Offline",  cls: "offline"  },
    internal: { icon: "🔒", text: "Browser Page",    cls: "safe"     },
  };

  const info = MAP[status] || MAP.offline;
  statusIcon.textContent  = info.icon;
  statusValue.textContent = info.text;
  statusValue.className   = `status-value ${info.cls}`;

  // Spinner: hide once resolved
  if (loader) loader.style.display = status === "checking" ? "inline-block" : "none";

  // Probability bar
  if (probability !== null && probability !== undefined && status !== "internal") {
    probSection.style.display = "block";
    const pct = (probability * 100).toFixed(1);
    probPct.textContent = pct + "%";
    setTimeout(() => { probFill.style.width = pct + "%"; }, 50);
    probFill.className = `prob-fill ${status === "danger" ? "danger" : ""}`;
  } else {
    probSection.style.display = "none";
  }
}

// ─── Main: query API directly ─────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (!tabs || tabs.length === 0) {
    updateUI({ status: "offline", probability: null, url: null });
    return;
  }

  const url = tabs[0].url || "";

  // Still show the URL immediately
  updateUI({ status: "checking", probability: null, url });

  // Skip internal browser/extension pages
  if (!url ||
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("devtools://") ||
      url === "about:blank" ||
      url === "about:newtab") {
    updateUI({ status: "internal", probability: null, url });
    return;
  }

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    updateUI({
      status: data.is_phishing ? "danger" : "safe",
      probability: data.probability,
      url
    });

  } catch (err) {
    console.warn("[PhishShield Popup] API error:", err.message);
    updateUI({ status: "offline", probability: null, url });
  }
});
