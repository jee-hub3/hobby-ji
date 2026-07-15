// Editorial Ledger 컨셉 렌더러 — 06-컨셉-스킨-명세.md §4
(function () {
  let panel = null;
  let mode = null;
  let refs = {};

  function ruler() {
    let ticks = "";
    [0, 25, 50, 75, 100].forEach((t) => {
      ticks += `<span class="led-ruler-tick" style="left:${t}%"></span>`;
    });
    return (
      '<div class="led-ruler"><div class="led-ruler-base"></div>' +
      ticks +
      '<div class="led-ruler-use"></div><div class="led-ruler-marker"></div></div>'
    );
  }

  function col(kind, label, sub) {
    return (
      '<div class="led-col led-col-' + kind + '">' +
      '<div class="led-label">' + label + ' <span class="led-sublabel">' + sub + "</span></div>" +
      '<div class="led-num"><span class="led-numval">--</span><span class="led-pctsign">%</span></div>' +
      ruler() +
      '<div class="led-reset"></div></div>'
    );
  }

  function masthead() {
    return '<div class="led-masthead"><span class="led-livedot"></span><span class="led-title">CLAUDE USAGE</span></div><hr class="led-rule">';
  }

  function build(root, m) {
    let html = '<div class="led-panel led-' + m + '">';
    if (m === "compact") {
      // 컴팩트는 리셋 정보를 표시하지 않는다 (전 컨셉 공통 규칙) — 구분자 '·'도 제거
      html +=
        '<div class="led-tick-item led-col-s">세션 <span class="led-tick-num"><span class="led-numval">--</span><span class="led-pctsign">%</span></span></div>' +
        '<div class="led-vsep"></div>' +
        '<div class="led-tick-item led-col-w">주간 <span class="led-tick-num"><span class="led-numval">--</span><span class="led-pctsign">%</span></span></div>';
    } else if (m === "vertical") {
      html += masthead() + col("s", "세션", "5시간") + '<div class="led-colsep"></div>' + col("w", "주간", "7일") +
        '<div class="led-scoped" hidden></div>' +
        '<div class="led-foot"><span class="led-foot-l"></span><span class="led-foot-r"></span></div>';
    } else {
      html +=
        masthead() +
        '<div class="led-cols">' + col("s", "세션", "5시간 한도") + col("w", "주간", "7일 한도") + "</div>" +
        '<div class="led-scoped" hidden></div>' +
        '<div class="led-foot"><span class="led-foot-l"></span><span class="led-foot-r"></span></div>';
    }
    html += "</div>";
    root.innerHTML = html;
    panel = root.querySelector(".led-panel");
    refs = {
      colS: panel.querySelector(".led-col-s"),
      colW: panel.querySelector(".led-col-w"),
      footL: panel.querySelector(".led-foot-l"),
      footR: panel.querySelector(".led-foot-r"),
      scoped: panel.querySelector(".led-scoped"),
    };
    mode = m;
  }

  function fillCol(colEl, blk, resetText) {
    if (!colEl) return;
    const numval = colEl.querySelector(".led-numval");
    numval.textContent = `${blk.pct}`;
    const numWrap = colEl.querySelector(".led-num") || colEl.querySelector(".led-tick-num");
    if (numWrap) {
      numWrap.classList.remove("warn", "danger");
      if (blk.severity !== "normal") numWrap.classList.add(blk.severity);
    }
    const use = colEl.querySelector(".led-ruler-use");
    const marker = colEl.querySelector(".led-ruler-marker");
    const pct = Math.max(0, Math.min(100, blk.pct));
    if (use) use.style.width = `${pct}%`;
    if (marker) marker.style.left = `${pct}%`;
    const reset = colEl.querySelector(".led-reset");
    if (reset) reset.textContent = resetText;
  }

  window.WIDGET_CONCEPTS = window.WIDGET_CONCEPTS || {};
  window.WIDGET_CONCEPTS.ledger = {
    getPanel: () => panel,
    render(vm, settings, root) {
      const m = settings.layout.mode;
      if (mode !== m || !root.querySelector(".led-panel")) build(root, m);

      const sReset = m === "compact" ? `${vm.session.resetHM} 후` : `${vm.session.resetAbs} 초기화`;
      const wReset = m === "compact" ? `${vm.weekly.resetWeekday} ${vm.weekly.resetClock}` : `${vm.weekly.resetAbsDay} 초기화`;
      fillCol(refs.colS, vm.session, vm.resetOn ? sReset : "");
      fillCol(refs.colW, vm.weekly, vm.resetOn ? wReset : "");
      if (refs.colS) refs.colS.hidden = !vm.sessionOn;
      if (refs.colW) refs.colW.hidden = !vm.weeklyOn;
      if (refs.scoped) {
        refs.scoped.textContent = vm.scopedText;
        refs.scoped.hidden = !(vm.scopedOn && vm.scopedText);
      }
      if (refs.footL) refs.footL.textContent = `마지막 갱신 ${vm.nowClock}`;
      if (refs.footR) refs.footR.textContent = `${vm.dateText} ${vm.weekdayEn}`;
    },
  };
})();
