// PhishShield AI - Content Script
// Injected automatically on every page. Receives results from the background worker.

(function () {
  // Avoid injecting twice (e.g. on pushState navigations)
  if (document.getElementById("phishshield-toast")) return;

  // ─── Build the toast element ─────────────────────────────────────────────
  const toast = document.createElement("div");
  toast.id = "phishshield-toast";
  toast.innerHTML = `
    <div id="ps-inner">
      <span id="ps-icon">🛡️</span>
      <div id="ps-text">
        <div id="ps-title">PhishShield AI</div>
        <div id="ps-sub">Analyzing...</div>
      </div>
      <button id="ps-close" title="Dismiss">✕</button>
    </div>
    <div id="ps-bar-wrap"><div id="ps-bar"></div></div>
  `;

  // ─── Styles (injected inline so no external CSS needed) ──────────────────
  const style = document.createElement("style");
  style.textContent = `
    #phishshield-toast {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      min-width: 260px;
      max-width: 320px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      color: #f8fafc;
      overflow: hidden;
      opacity: 0;
      transform: translateY(-12px) scale(0.97);
      transition: opacity 0.35s ease, transform 0.35s ease;
      pointer-events: all;
    }
    #phishshield-toast.ps-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    #phishshield-toast.ps-hiding {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    #ps-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px 10px 14px;
    }
    #ps-icon { font-size: 22px; flex-shrink: 0; }
    #ps-text { flex: 1; line-height: 1.3; }
    #ps-title { font-weight: 700; font-size: 12px; letter-spacing: 0.4px; color: #94a3b8; text-transform: uppercase; }
    #ps-sub { font-weight: 600; font-size: 14px; margin-top: 1px; }
    #ps-close {
      background: none; border: none; color: #64748b; cursor: pointer;
      font-size: 14px; padding: 2px 4px; border-radius: 4px; flex-shrink: 0;
      transition: color 0.2s;
    }
    #ps-close:hover { color: #f8fafc; }
    #ps-bar-wrap { height: 3px; background: rgba(255,255,255,0.06); }
    #ps-bar { height: 100%; width: 0%; transition: width 0.9s cubic-bezier(0.25,1,0.5,1); border-radius: 0 3px 3px 0; }

    /* State colours */
    #phishshield-toast.ps-safe   { border-color: rgba(16,185,129,0.35); }
    #phishshield-toast.ps-safe   #ps-sub { color: #10b981; }
    #phishshield-toast.ps-safe   #ps-bar { background: #10b981; }

    #phishshield-toast.ps-danger { border-color: rgba(239,68,68,0.5);  }
    #phishshield-toast.ps-danger #ps-sub { color: #ef4444; }
    #phishshield-toast.ps-danger #ps-bar { background: #ef4444; }

    #phishshield-toast.ps-checking { border-color: rgba(250,204,21,0.35); }
    #phishshield-toast.ps-checking #ps-sub { color: #facc15; }
    #phishshield-toast.ps-checking #ps-bar { background: #facc15; width: 60% !important; }

    #phishshield-toast.ps-offline { border-color: rgba(148,163,184,0.25); }
    #phishshield-toast.ps-offline #ps-sub { color: #94a3b8; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(toast);

  let autoDismissTimer = null;

  // ─── Helpers ────────────────────────────────────────────────────────────
  function getEl(id) { return document.getElementById(id); }

  function showToast(stateClass, icon, subtitle, probPct, autoDismissMs) {
    const el = getEl("phishshield-toast");
    el.className = `ps-visible ${stateClass}`;
    getEl("ps-icon").textContent = icon;
    getEl("ps-sub").textContent = subtitle;

    // probability bar
    setTimeout(() => {
      if (probPct !== null) getEl("ps-bar").style.width = probPct + "%";
    }, 50);

    // auto-dismiss for safe/offline
    clearTimeout(autoDismissTimer);
    if (autoDismissMs) {
      autoDismissTimer = setTimeout(dismissToast, autoDismissMs);
    }
  }

  function dismissToast() {
    const el = getEl("phishshield-toast");
    if (!el) return;
    el.classList.add("ps-hiding");
    el.classList.remove("ps-visible");
    setTimeout(() => { if (el) el.style.display = "none"; }, 400);
  }

  getEl("ps-close").addEventListener("click", dismissToast);

  // Show "Analyzing" immediately
  showToast("ps-checking", "⏳", "Analyzing...", null, null);

  // ─── Listen for result from background ─────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "PHISHSHIELD_RESULT") return;

    const { status, probability } = message;
    const pct = probability !== null ? (probability * 100).toFixed(1) : null;

    if (status === "danger") {
      showToast("ps-danger", "🚨", `PHISHING DETECTED — ${pct}% threat`, pct, null);
      // Blocked page redirect handled by background — toast is just a warning flash
    } else if (status === "safe") {
      const label = pct !== null ? `Safe ✅  (${pct}% threat)` : "Safe ✅";
      showToast("ps-safe", "🛡️", label, pct, 4000); // auto-dismiss after 4s
    } else if (status === "offline") {
      showToast("ps-offline", "⚠️", "Server Offline — check not run", null, 5000);
    }
  });
})();
