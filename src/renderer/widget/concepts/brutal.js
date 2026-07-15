// Neo Brutal 컨셉 렌더러 — 06-컨셉-스킨-명세.md §3
(function () {
  let panel = null;
  let mode = null;
  let refs = {};

  function blocks(n) {
    let s = '<div class="br-blocks">';
    for (let i = 0; i < n; i++) s += '<span class="br-block"></span>';
    return s + "</div>";
  }

  function build(root, m) {
    let html = '<div class="br-panel br-' + m + '">';
    if (m === "horizontal") {
      html +=
        '<div class="br-topbar"><span class="br-head">CLAUDE 사용량</span><span class="br-badge"></span></div>' +
        '<div class="br-rows">' +
        '<div class="br-metric br-metric-s"><span class="br-label">세션</span>' + blocks(10) + '<span class="br-pct">--%</span></div>' +
        '<div class="br-metric br-metric-w"><span class="br-label">주간</span>' + blocks(10) + '<span class="br-pct">--%</span></div>' +
        "</div>" +
        '<div class="br-scoped" hidden></div>' +
        '<div class="br-footer"></div>';
    } else if (m === "vertical") {
      html +=
        '<span class="br-head">CLAUDE</span>' +
        '<div class="br-towers">' +
        '<div class="br-tower br-metric-s">' + blocks(10) + '<span class="br-pct">--%</span><span class="br-label">세션</span></div>' +
        '<div class="br-tower br-metric-w">' + blocks(10) + '<span class="br-pct">--%</span><span class="br-label">주간</span></div>' +
        "</div>" +
        '<div class="br-scoped" hidden></div>';
    } else {
      html +=
        '<div class="br-cmetric br-metric-s"><span class="br-label">세션</span>' + blocks(5) + '<span class="br-pct">--%</span></div>' +
        '<div class="br-cmetric br-metric-w"><span class="br-label">주간</span>' + blocks(5) + '<span class="br-pct">--%</span></div>';
    }
    html += "</div>";
    root.innerHTML = html;
    panel = root.querySelector(".br-panel");
    refs = {
      badge: panel.querySelector(".br-badge"),
      footer: panel.querySelector(".br-footer"),
      scoped: panel.querySelector(".br-scoped"),
      metricS: panel.querySelector(".br-metric-s"),
      metricW: panel.querySelector(".br-metric-w"),
    };
    mode = m;
  }

  function fillMetric(mEl, blk) {
    if (!mEl) return;
    const blockEls = mEl.querySelectorAll(".br-block");
    const n = blockEls.length;
    const filled = Math.round((Math.max(0, Math.min(100, blk.pct)) / 100) * n);
    blockEls.forEach((b, i) => b.classList.toggle("on", i < filled));
    const pctEl = mEl.querySelector(".br-pct");
    pctEl.textContent = `${blk.pct}%`;
    pctEl.classList.remove("warn", "danger");
    if (blk.severity !== "normal") pctEl.classList.add(blk.severity);
  }

  window.WIDGET_CONCEPTS = window.WIDGET_CONCEPTS || {};
  window.WIDGET_CONCEPTS.brutal = {
    getPanel: () => panel,
    render(vm, settings, root) {
      const m = settings.layout.mode;
      if (mode !== m || !root.querySelector(".br-panel")) build(root, m);

      fillMetric(refs.metricS, vm.session);
      fillMetric(refs.metricW, vm.weekly);
      if (refs.metricS) refs.metricS.hidden = !vm.sessionOn;
      if (refs.metricW) refs.metricW.hidden = !vm.weeklyOn;

      if (refs.badge) {
        refs.badge.textContent = `리셋까지 ${vm.session.resetHM}`;
        refs.badge.hidden = !vm.resetOn || !vm.sessionOn;
      }
      if (refs.footer) {
        const parts = [];
        if (vm.sessionOn) parts.push(`세션 → ${vm.session.resetAbs}`);
        if (vm.weeklyOn) parts.push(`주간 → ${vm.weekly.resetAbsDay}`);
        refs.footer.textContent = parts.join(" · ");
        refs.footer.hidden = !vm.resetOn || parts.length === 0;
      }
      if (refs.scoped) {
        refs.scoped.textContent = vm.scopedText;
        refs.scoped.hidden = !(vm.scopedOn && vm.scopedText);
      }
    },
  };
})();
