// Aurora Glass 컨셉 렌더러 — 06-컨셉-스킨-명세.md §2
(function () {
  const CIRC = { outer: 2 * Math.PI * 52, inner: 2 * Math.PI * 38, mini: 2 * Math.PI * 24 };
  let panel = null;
  let mode = null;
  let refs = {};

  function defsSvg() {
    return (
      '<svg class="aur-defs" width="0" height="0" aria-hidden="true"><defs>' +
      '<linearGradient id="aurGradS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--session-from)"/><stop offset="1" stop-color="var(--session-to)"/></linearGradient>' +
      '<linearGradient id="aurGradW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--weekly-from)"/><stop offset="1" stop-color="var(--weekly-to)"/></linearGradient>' +
      "</defs></svg>"
    );
  }

  function dualRing() {
    return (
      '<svg class="aur-ring aur-ring-dual" viewBox="0 0 120 120">' +
      '<circle class="aur-track" cx="60" cy="60" r="52" stroke-width="9"/>' +
      '<circle class="aur-track" cx="60" cy="60" r="38" stroke-width="6"/>' +
      '<circle class="aur-arc aur-arc-s" cx="60" cy="60" r="52" stroke-width="9" stroke="url(#aurGradS)" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="0 999"/>' +
      '<circle class="aur-arc aur-arc-w" cx="60" cy="60" r="38" stroke-width="6" stroke="url(#aurGradW)" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="0 999"/>' +
      '<text class="aur-center-pct" x="60" y="60" text-anchor="middle" dominant-baseline="central">--%</text>' +
      '<text class="aur-center-lbl" x="60" y="78" text-anchor="middle">세션</text>' +
      "</svg>"
    );
  }

  function miniRing(kind) {
    const grad = kind === "s" ? "aurGradS" : "aurGradW";
    return (
      '<div class="aur-mini aur-mini-wrap-' + kind + '">' +
      '<svg class="aur-ring aur-ring-mini" viewBox="0 0 60 60">' +
      '<circle class="aur-track" cx="30" cy="30" r="24" stroke-width="4.5"/>' +
      '<circle class="aur-arc aur-arc-' + kind + '" cx="30" cy="30" r="24" stroke-width="4.5" stroke="url(#' + grad + ')" stroke-linecap="round" transform="rotate(-90 30 30)" stroke-dasharray="0 999"/>' +
      "</svg>" +
      '<span class="aur-mini-pct aur-mini-' + kind + '">--%</span>' +
      "</div>"
    );
  }

  function brand() {
    return '<div class="aur-brand"><span class="aur-wordmark">CLAUDE</span><span class="aur-live"><span class="aur-live-dot"></span>LIVE</span></div>';
  }

  function metric(kind, label) {
    return (
      '<div class="aur-metric aur-metric-' + kind + '"><span class="aur-tick"></span>' +
      '<div class="aur-metric-body"><div class="aur-mlabel">' + label + '</div>' +
      '<div class="aur-mabs"></div><div class="aur-mrel"></div></div></div>'
    );
  }

  function build(root, m) {
    let html = '<div class="aur-panel aur-' + m + '">' + defsSvg() + '<div class="aur-glow aur-glow-warm"></div><div class="aur-glow aur-glow-cool"></div>';
    if (m === "compact") {
      html += miniRing("s") + miniRing("w") + '<span class="aur-updated"></span>';
    } else if (m === "vertical") {
      html += '<div class="aur-gauge">' + dualRing() + "</div>" + brand() + '<div class="aur-info">' + metric("s", "세션") + metric("w", "주간") + "</div>";
    } else {
      html += '<div class="aur-gauge">' + dualRing() + '</div><div class="aur-info">' + brand() + metric("s", "세션") + metric("w", "주간") + '<span class="aur-updated"></span></div>';
    }
    html += "</div>";
    root.innerHTML = html;
    panel = root.querySelector(".aur-panel");
    refs = {
      arcS: panel.querySelector(".aur-arc-s"),
      arcW: panel.querySelector(".aur-arc-w"),
      centerPct: panel.querySelector(".aur-center-pct"),
      centerLbl: panel.querySelector(".aur-center-lbl"),
      miniS: panel.querySelector(".aur-mini-s"),
      miniW: panel.querySelector(".aur-mini-w"),
      miniWrapS: panel.querySelector(".aur-mini-wrap-s"),
      miniWrapW: panel.querySelector(".aur-mini-wrap-w"),
      metricS: panel.querySelector(".aur-metric-s"),
      metricW: panel.querySelector(".aur-metric-w"),
      updated: panel.querySelector(".aur-updated"),
    };
    mode = m;
  }

  function setArc(circle, pct, circ) {
    if (!circle) return;
    const arc = (Math.max(0, Math.min(100, pct)) / 100) * circ;
    circle.setAttribute("stroke-dasharray", `${arc.toFixed(2)} ${circ.toFixed(2)}`);
  }

  function sev(node, severity) {
    if (!node) return;
    node.classList.remove("warn", "danger");
    if (severity !== "normal") node.classList.add(severity);
  }

  function fillMetric(mEl, blk, resetOn) {
    if (!mEl) return;
    const abs = mEl.querySelector(".aur-mabs");
    const rel = mEl.querySelector(".aur-mrel");
    abs.textContent = `${blk.resetAbs} 초기화`;
    rel.textContent = blk.resetRel;
    abs.hidden = !resetOn;
    rel.hidden = !resetOn;
  }

  window.WIDGET_CONCEPTS = window.WIDGET_CONCEPTS || {};
  window.WIDGET_CONCEPTS.aurora = {
    getPanel: () => panel,
    render(vm, settings, root) {
      const m = settings.layout.mode;
      if (mode !== m || !root.querySelector(".aur-panel")) build(root, m);

      if (m === "compact") {
        setArc(refs.arcS, vm.session.pct, CIRC.mini);
        setArc(refs.arcW, vm.weekly.pct, CIRC.mini);
        if (refs.miniS) { refs.miniS.textContent = `${vm.session.pct}%`; sev(refs.miniS, vm.session.severity); }
        if (refs.miniW) { refs.miniW.textContent = `${vm.weekly.pct}%`; sev(refs.miniW, vm.weekly.severity); }
        if (refs.miniWrapS) refs.miniWrapS.hidden = !vm.sessionOn;
        if (refs.miniWrapW) refs.miniWrapW.hidden = !vm.weeklyOn;
        // 컴팩트 우측은 리셋 카운트다운(세션 기준)
        if (refs.updated) refs.updated.textContent = `↻ ${vm.session.resetHM}`;
        return;
      }

      // dual ring (가로/세로)
      setArc(refs.arcS, vm.session.pct, CIRC.outer);
      setArc(refs.arcW, vm.weekly.pct, CIRC.inner);
      const centerKind = vm.sessionOn ? "session" : "weekly";
      if (refs.centerPct) {
        refs.centerPct.textContent = `${vm[centerKind].pct}%`;
        sev(refs.centerPct, vm[centerKind].severity);
      }
      if (refs.centerLbl) refs.centerLbl.textContent = centerKind === "session" ? "세션" : "주간";
      if (refs.arcS) refs.arcS.style.display = vm.sessionOn ? "" : "none";
      if (refs.arcW) refs.arcW.style.display = vm.weeklyOn ? "" : "none";

      fillMetric(refs.metricS, vm.session, vm.resetOn);
      fillMetric(refs.metricW, vm.weekly, vm.resetOn);
      if (refs.metricS) refs.metricS.hidden = !vm.sessionOn;
      if (refs.metricW) refs.metricW.hidden = !vm.weeklyOn;
      if (refs.updated) refs.updated.textContent = `↻ ${vm.nowClock}`;
    },
  };
})();
