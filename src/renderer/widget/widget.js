// 각 오류에 문구 + 안내 버튼 노출 여부(showActions)를 매핑.
const ERROR_INFO = {
  NO_CREDENTIALS: { text: "Claude Code에 로그인되어 있지 않아요.\n로그인 후 아래 버튼을 눌러주세요.", showActions: true },
  AUTH_EXPIRED: { text: "로그인이 만료됐어요.\nClaude Code에 다시 로그인해 주세요.", showActions: true },
  RATE_LIMITED: { text: "요청이 많아 잠시 후 자동으로 다시 시도합니다.", showActions: false },
  NETWORK_ERROR: { text: "네트워크에 연결할 수 없어요.\n연결을 확인해 주세요.", showActions: true },
  UNKNOWN_ERROR: { text: "사용량을 불러올 수 없어요.", showActions: true },
};

// classic 전용 DOM 참조 (index.html의 #widget 하위)
const el = {
  widget: document.getElementById("widget"),
  content: document.getElementById("content"),
  message: document.getElementById("message"),
  updated: document.getElementById("updated"),
  statusDot: document.getElementById("status-dot"),
  sessionRow: document.getElementById("session-fill").closest(".row"),
  sessionFill: document.getElementById("session-fill"),
  sessionPercent: document.getElementById("session-percent"),
  sessionReset: document.getElementById("session-reset"),
  weeklyRow: document.getElementById("weekly-fill").closest(".row"),
  weeklyFill: document.getElementById("weekly-fill"),
  weeklyPercent: document.getElementById("weekly-percent"),
  weeklyReset: document.getElementById("weekly-reset"),
  scopedLine: document.getElementById("scoped-line"),
  msgText: document.getElementById("msg-text"),
  msgActions: document.getElementById("msg-actions"),
  btnHelp: document.getElementById("btn-help"),
  btnRetry: document.getElementById("btn-retry"),
};
const conceptRoot = document.getElementById("concept-root");

el.btnHelp.addEventListener("click", () => window.claudeUsage.onboardingAction("help"));
el.btnRetry.addEventListener("click", () => window.claudeUsage.onboardingAction("retry"));

let currentSettings = null;
let lastPayload = null;
let activePanel = el.widget; // 창 크기 측정 대상(활성 컨셉의 패널)

// ── 창 크기 측정 → main 통보 (콘텐츠 맞춤) ──
let reportedW = 0;
let reportedH = 0;
function reportSize() {
  if (!activePanel) return;
  const rect = activePanel.getBoundingClientRect();
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);
  if (w > 0 && h > 0 && (w !== reportedW || h !== reportedH)) {
    reportedW = w;
    reportedH = h;
    window.claudeUsage.reportSize({ width: w, height: h });
  }
}
function scheduleReport() {
  requestAnimationFrame(reportSize);
}

// ── 공통 포맷터 ──
function formatClock(date) {
  let hour = date.getHours();
  const minute = date.getMinutes();
  const ampm = hour < 12 ? "오전" : "오후";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${ampm} ${hour}:${String(minute).padStart(2, "0")}`;
}

// 리셋 시각을 상대/절대/합본으로 반환 (컨셉별로 원하는 형태 사용).
function resetInfo(resetsAtIso) {
  if (!resetsAtIso) return { combined: "-", rel: "-", abs: "-", clock: "-" };
  const reset = new Date(resetsAtIso);
  const now = new Date();
  const diffMs = Math.max(0, reset.getTime() - now.getTime());
  const totalMin = Math.round(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const rel = h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`;
  const abs = formatClock(reset);
  const clock = `${String(reset.getHours()).padStart(2, "0")}:${String(reset.getMinutes()).padStart(2, "0")}`;
  const hm = `${h}:${String(m).padStart(2, "0")}`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][reset.getDay()];
  const absDay = `${weekday} ${abs}`;
  return { combined: `${rel} (${abs}) 초기화`, rel, abs, clock, hm, absDay, weekday };
}

function severityOf(percent) {
  const { warnAt, dangerAt } = currentSettings.behavior;
  if (percent >= dangerAt) return "danger";
  if (percent >= warnAt) return "warn";
  return "normal";
}

// ── 공통 뷰모델 (모든 컨셉이 동일 계약으로 소비) ──
function buildViewModel(payload, settings) {
  const { data, stale, error } = payload;
  if (!data) {
    const info = ERROR_INFO[error] || ERROR_INFO.UNKNOWN_ERROR;
    return { state: "error", error, msgText: info.text, showActions: info.showActions };
  }
  const fields = settings.layout.fields || [];
  // 컴팩트 레이아웃은 '초기화 시각' 체크 여부와 무관하게 리셋 정보를 표시하지 않는다.
  const compact = settings.layout.mode === "compact";
  const block = (blk) => {
    const pct = Math.round((blk && blk.utilizationPercent) || 0);
    const r = resetInfo(blk && blk.resetsAt);
    return {
      pct,
      resetText: r.combined,
      resetRel: r.rel,
      resetAbs: r.abs,
      resetClock: r.clock,
      resetHM: r.hm,
      resetAbsDay: r.absDay,
      resetWeekday: r.weekday,
      severity: severityOf(pct),
    };
  };
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nowClock = timeStr;
  const dateText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const weekdayEn = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getDay()];
  return {
    state: "data",
    session: block(data.session),
    weekly: block(data.weekly),
    sessionOn: fields.includes("session"),
    weeklyOn: fields.includes("weekly"),
    resetOn: fields.includes("resetTime") && !compact,
    scopedOn: fields.includes("modelSpecific"),
    scopedText:
      data.scoped && data.scoped.length > 0
        ? "모델별 " + data.scoped.map((s) => `${s.label} ${s.percent}%`).join(", ")
        : "",
    updatedText: stale ? `${timeStr} 갱신 (오래된 데이터)` : `${timeStr} 갱신`,
    nowClock,
    dateText,
    weekdayEn,
    stale: !!stale,
  };
}

// ── CSS 변수/바디 속성 (공통) ──
function applyTheme(theme) {
  const root = document.documentElement;
  const s = metricColors(theme, "session");
  const w = metricColors(theme, "weekly");
  root.style.setProperty("--session-from", s.from);
  root.style.setProperty("--session-to", s.to);
  root.style.setProperty("--session-angle", `${s.angle ?? 135}deg`);
  root.style.setProperty("--weekly-from", w.from);
  root.style.setProperty("--weekly-to", w.to);
  root.style.setProperty("--weekly-angle", `${w.angle ?? 135}deg`);
  root.style.setProperty("--opacity", theme.opacity);
  // classic 배경 스타일: data-bgstyle로 배경 CSS 선택, data-bg로 텍스트 잉크 반전 결정
  const bgStyle = theme.bgStyle || "flat-dark";
  root.setAttribute("data-bgstyle", bgStyle);
  root.setAttribute("data-bg", isLightBgStyle(bgStyle) ? "light" : "dark");
}

function applyBodyClasses(layout, concept) {
  const body = document.body;
  body.classList.remove("layout-horizontal", "layout-vertical", "layout-compact", "size-S", "size-M", "size-L");
  body.classList.add(`layout-${layout.mode}`, `size-${layout.size}`);
  body.dataset.concept = concept;
  body.dataset.layout = layout.mode;
  body.dataset.size = layout.size;
}

// ── classic 렌더러 (기존 동작 그대로 보존) ──
function classicApplyLayoutFields(layout) {
  const fields = layout.fields || [];
  const sessionOn = fields.includes("session");
  const weeklyOn = fields.includes("weekly");
  // 컴팩트는 리셋 정보를 표시하지 않는다 (전 컨셉 공통 규칙; CSS와 이중 보장)
  const resetOn = fields.includes("resetTime") && layout.mode !== "compact";
  el.sessionRow.hidden = !sessionOn;
  el.weeklyRow.hidden = !weeklyOn;
  el.sessionReset.hidden = !(sessionOn && resetOn);
  el.weeklyReset.hidden = !(weeklyOn && resetOn);
}

function classicRenderBlock(vmBlock, fillEl, percentEl, resetEl) {
  if (!vmBlock) {
    fillEl.style.width = "0%";
    percentEl.textContent = "--%";
    percentEl.classList.remove("warn", "danger");
    resetEl.textContent = "-";
    return;
  }
  fillEl.style.width = `${Math.min(100, Math.max(0, vmBlock.pct))}%`;
  percentEl.classList.remove("warn", "danger");
  if (vmBlock.severity !== "normal") percentEl.classList.add(vmBlock.severity);
  percentEl.textContent = `${vmBlock.pct}%`;
  resetEl.textContent = vmBlock.resetText;
}

const classicRenderer = {
  getPanel: () => el.widget,
  render(vm) {
    classicApplyLayoutFields(currentSettings.layout);
    if (vm.state === "error") {
      el.content.hidden = true;
      el.message.hidden = false;
      el.msgText.textContent = vm.msgText;
      el.msgActions.hidden = !vm.showActions;
      el.updated.textContent = "-";
      el.statusDot.style.opacity = "0.3";
      return;
    }
    el.content.hidden = false;
    el.message.hidden = true;
    el.statusDot.style.opacity = "1";
    classicRenderBlock(vm.session, el.sessionFill, el.sessionPercent, el.sessionReset);
    classicRenderBlock(vm.weekly, el.weeklyFill, el.weeklyPercent, el.weeklyReset);
    if (vm.scopedOn && vm.scopedText) {
      el.scopedLine.hidden = false;
      el.scopedLine.textContent = vm.scopedText;
    } else {
      el.scopedLine.hidden = true;
    }
    el.updated.textContent = vm.updatedText;
    el.updated.classList.toggle("stale", vm.stale);
  },
};

// 컨셉 렌더러 레지스트리 — aurora/brutal/ledger 스크립트가 자신을 등록한다.
window.WIDGET_CONCEPTS = window.WIDGET_CONCEPTS || {};
window.WIDGET_CONCEPTS.classic = classicRenderer;

function getRenderer(concept) {
  return window.WIDGET_CONCEPTS[concept] || window.WIDGET_CONCEPTS.classic;
}

// ── 메인 렌더 ──
function render() {
  if (!currentSettings || !lastPayload) return;
  const concept = (currentSettings.theme && currentSettings.theme.concept) || "classic";
  const vm = buildViewModel(lastPayload, currentSettings);

  // 오류/온보딩 화면은 모든 컨셉에서 공통(classic 메시지 UI)으로 표시 —
  // 버튼(설치·로그인 안내/다시 시도)을 재사용하고 컨셉별 깨짐을 방지한다.
  if (vm.state === "error") {
    el.widget.hidden = false;
    conceptRoot.hidden = true;
    classicRenderer.render(vm, currentSettings);
    activePanel = el.widget;
    scheduleReport();
    return;
  }

  const renderer = getRenderer(concept);
  const isClassic = renderer === window.WIDGET_CONCEPTS.classic;
  el.widget.hidden = !isClassic;
  conceptRoot.hidden = isClassic;

  renderer.render(vm, currentSettings, conceptRoot);
  // 비-classic은 #concept-root를 측정(컨셉별 패딩으로 그림자 공간 확보) → 창에 그림자 안 잘림
  activePanel = isClassic ? el.widget : conceptRoot;

  scheduleReport();
}

function onSettings(settings) {
  currentSettings = settings;
  applyTheme(settings.theme);
  applyBodyClasses(settings.layout, (settings.theme && settings.theme.concept) || "classic");
  render();
  scheduleReport();
}

function onUpdate(payload) {
  lastPayload = payload;
  render();
}

window.claudeUsage.getSettings().then(onSettings);
window.claudeUsage.onSettingsUpdate(onSettings);
window.claudeUsage.onUpdate(onUpdate);

document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.claudeUsage.requestContextMenu();
});
