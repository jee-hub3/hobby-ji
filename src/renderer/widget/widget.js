// 각 오류에 문구 + 안내 버튼 노출 여부(showActions)를 매핑.
// showActions=true면 "설치·로그인 안내"/"다시 시도" 버튼을 함께 보여준다.
const ERROR_INFO = {
  NO_CREDENTIALS: {
    text: "Claude Code에 로그인되어 있지 않아요.\n로그인 후 아래 버튼을 눌러주세요.",
    showActions: true,
  },
  AUTH_EXPIRED: {
    text: "로그인이 만료됐어요.\nClaude Code에 다시 로그인해 주세요.",
    showActions: true,
  },
  RATE_LIMITED: {
    text: "요청이 많아 잠시 후 자동으로 다시 시도합니다.",
    showActions: false,
  },
  NETWORK_ERROR: {
    text: "네트워크에 연결할 수 없어요.\n연결을 확인해 주세요.",
    showActions: true,
  },
  UNKNOWN_ERROR: {
    text: "사용량을 불러올 수 없어요.",
    showActions: true,
  },
};

const el = {
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

el.btnHelp.addEventListener("click", () => window.claudeUsage.onboardingAction("help"));
el.btnRetry.addEventListener("click", () => window.claudeUsage.onboardingAction("retry"));

let currentSettings = null;
let lastPayload = null;

// 렌더된 위젯 박스의 실제 크기를 측정해 main에 전달 → 창을 콘텐츠에 딱 맞춤.
// 레이아웃/크기/데이터가 바뀌면 폭·높이가 달라지므로 매 렌더 후 호출.
let reportedW = 0;
let reportedH = 0;
function reportSize() {
  const widgetEl = document.querySelector(".widget");
  if (!widgetEl) return;
  const rect = widgetEl.getBoundingClientRect();
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);
  if (w !== reportedW || h !== reportedH) {
    reportedW = w;
    reportedH = h;
    window.claudeUsage.reportSize({ width: w, height: h });
  }
}
function scheduleReport() {
  requestAnimationFrame(reportSize);
}

function formatClock(date) {
  let hour = date.getHours();
  const minute = date.getMinutes();
  const ampm = hour < 12 ? "오전" : "오후";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${ampm} ${hour}:${String(minute).padStart(2, "0")}`;
}

function formatResetCountdown(resetsAtIso) {
  if (!resetsAtIso) return "-";
  const reset = new Date(resetsAtIso);
  const now = new Date();
  const diffMs = Math.max(0, reset.getTime() - now.getTime());
  const totalMin = Math.round(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const relative = h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`;
  return `${relative} (${formatClock(reset)}) 초기화`;
}

// 임계값 경고는 막대가 아니라 % 숫자 색으로 표시(막대는 선택한 색 유지).
function applyThresholdClass(percentEl, percent) {
  const { warnAt, dangerAt } = currentSettings.behavior;
  percentEl.classList.remove("warn", "danger");
  if (percent >= dangerAt) percentEl.classList.add("danger");
  else if (percent >= warnAt) percentEl.classList.add("warn");
}

function renderBlock(block, fillEl, percentEl, resetEl) {
  if (!block) {
    fillEl.style.width = "0%";
    percentEl.textContent = "--%";
    percentEl.classList.remove("warn", "danger");
    resetEl.textContent = "-";
    return;
  }
  const percent = Math.round(block.utilizationPercent ?? 0);
  fillEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  applyThresholdClass(percentEl, percent);
  percentEl.textContent = `${percent}%`;
  resetEl.textContent = formatResetCountdown(block.resetsAt);
}

function applySplitGradient(root, prefix, metricTheme) {
  const g = resolveGradient(metricTheme);
  root.style.setProperty(`--${prefix}-from`, g.from);
  root.style.setProperty(`--${prefix}-to`, g.to);
  root.style.setProperty(`--${prefix}-angle`, `${g.angle ?? 135}deg`);
}

function applyTheme(theme) {
  const root = document.documentElement;
  applySplitGradient(root, "session", theme.session);
  applySplitGradient(root, "weekly", theme.weekly);
  root.style.setProperty("--opacity", theme.opacity);
  root.setAttribute("data-bg", theme.background);
}

function applyLayout(layout) {
  const body = document.body;
  body.classList.remove("layout-horizontal", "layout-vertical", "layout-compact", "size-S", "size-M", "size-L");
  body.classList.add(`layout-${layout.mode}`, `size-${layout.size}`);

  const fields = layout.fields || [];
  const sessionOn = fields.includes("session");
  const weeklyOn = fields.includes("weekly");
  const resetOn = fields.includes("resetTime");
  el.sessionRow.hidden = !sessionOn;
  el.weeklyRow.hidden = !weeklyOn;
  // 사용량 행을 끄면 그 행의 초기화 시각도 함께 숨김
  el.sessionReset.hidden = !(sessionOn && resetOn);
  el.weeklyReset.hidden = !(weeklyOn && resetOn);
}

function render() {
  if (!currentSettings) return;

  const payload = lastPayload;
  if (!payload) return;

  const { data, stale, error } = payload;
  const fields = currentSettings.layout.fields || [];

  if (!data) {
    const info = ERROR_INFO[error] || ERROR_INFO.UNKNOWN_ERROR;
    el.content.hidden = true;
    el.message.hidden = false;
    el.msgText.textContent = info.text;
    el.msgActions.hidden = !info.showActions;
    el.updated.textContent = "-";
    el.statusDot.style.opacity = "0.3";
    scheduleReport();
    return;
  }

  el.content.hidden = false;
  el.message.hidden = true;
  el.statusDot.style.opacity = "1";

  renderBlock(data.session, el.sessionFill, el.sessionPercent, el.sessionReset);
  renderBlock(data.weekly, el.weeklyFill, el.weeklyPercent, el.weeklyReset);

  if (fields.includes("modelSpecific") && data.scoped && data.scoped.length > 0) {
    el.scopedLine.hidden = false;
    el.scopedLine.textContent = "모델별 " + data.scoped.map((s) => `${s.label} ${s.percent}%`).join(", ");
  } else {
    el.scopedLine.hidden = true;
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  el.updated.textContent = stale ? `${timeStr} 갱신 (오래된 데이터)` : `${timeStr} 갱신`;
  el.updated.classList.toggle("stale", !!stale);

  scheduleReport();
}

function onSettings(settings) {
  currentSettings = settings;
  applyTheme(settings.theme);
  applyLayout(settings.layout);
  render();
  scheduleReport(); // 데이터가 아직 없어도 레이아웃 크기는 창에 반영
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
