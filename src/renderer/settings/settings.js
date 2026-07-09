let settings = null;
let colorTarget = "session"; // 색상 편집 대상: session | weekly

// 변경된 필드만 델타로 보낸다. main이 섹션 단위로 얕은 병합하므로
// 다른 필드(예: preset)를 건드리지 않는다. (stale 상태로 서로 덮어쓰던 버그 방지)
function patchTheme(delta) {
  window.claudeUsage.setSettings({ theme: delta });
}
// theme.session / theme.weekly는 중첩 객체라 완전한 하위 객체를 보내야
// main의 얕은 병합에서 다른 키(customGradient 등)가 유실되지 않는다.
function patchColorTarget(delta) {
  const current = settings.theme[colorTarget];
  patchTheme({ [colorTarget]: { ...current, ...delta } });
}
function patchLayout(delta) {
  window.claudeUsage.setSettings({ layout: delta });
}
function patchBehavior(delta) {
  window.claudeUsage.setSettings({ behavior: delta });
}

// ── 탭 전환 ──
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

// ── 테마 탭 ──
const targetHint = document.getElementById("target-hint");
document.querySelectorAll("#color-target button").forEach((btn) => {
  btn.addEventListener("click", () => {
    colorTarget = btn.dataset.value;
    renderForm(settings); // 편집 대상 전환 → 그리드/피커를 그 대상 값으로 갱신
  });
});

const presetGrid = document.getElementById("preset-grid");
GRADIENT_PRESETS.forEach((preset) => {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "preset-swatch";
  swatch.title = preset.name;
  swatch.style.background = `linear-gradient(135deg, ${preset.from}, ${preset.to})`;
  swatch.dataset.presetId = preset.id;
  swatch.addEventListener("click", () => patchColorTarget({ preset: preset.id }));
  presetGrid.appendChild(swatch);
});

const customFrom = document.getElementById("custom-from");
const customTo = document.getElementById("custom-to");
const customAngle = document.getElementById("custom-angle");

function pushCustomGradient() {
  patchColorTarget({
    preset: "custom",
    customGradient: {
      from: customFrom.value,
      to: customTo.value,
      angle: Number(customAngle.value),
    },
  });
}
customFrom.addEventListener("input", pushCustomGradient);
customTo.addEventListener("input", pushCustomGradient);
customAngle.addEventListener("change", pushCustomGradient);

document.querySelectorAll("#bg-mode button").forEach((btn) => {
  btn.addEventListener("click", () => patchTheme({ background: btn.dataset.value }));
});

const opacityInput = document.getElementById("opacity");
const opacityValue = document.getElementById("opacity-value");
opacityInput.addEventListener("input", () => {
  opacityValue.textContent = `${opacityInput.value}%`;
  patchTheme({ opacity: Number(opacityInput.value) / 100 });
});

// ── 레이아웃 탭 ──
document.querySelectorAll("#layout-mode button").forEach((btn) => {
  btn.addEventListener("click", () => patchLayout({ mode: btn.dataset.value }));
});
document.querySelectorAll("#layout-size button").forEach((btn) => {
  btn.addEventListener("click", () => patchLayout({ size: btn.dataset.value }));
});
document.querySelectorAll(".field-check").forEach((cb) => {
  cb.addEventListener("change", () => {
    const fields = new Set(settings.layout.fields);
    if (cb.checked) fields.add(cb.value);
    else fields.delete(cb.value);
    patchLayout({ fields: Array.from(fields) });
  });
});

// ── 동작 탭 ──
const pollInterval = document.getElementById("poll-interval");
pollInterval.addEventListener("change", () => patchBehavior({ pollIntervalSec: Number(pollInterval.value) }));

const warnAt = document.getElementById("warn-at");
const dangerAt = document.getElementById("danger-at");
warnAt.addEventListener("change", () => patchBehavior({ warnAt: Number(warnAt.value) }));
dangerAt.addEventListener("change", () => patchBehavior({ dangerAt: Number(dangerAt.value) }));

const notifications = document.getElementById("notifications");
notifications.addEventListener("change", () => patchBehavior({ notifications: notifications.checked }));
const autoStart = document.getElementById("auto-start");
autoStart.addEventListener("change", () => patchBehavior({ autoStart: autoStart.checked }));
const alwaysOnTop = document.getElementById("always-on-top");
alwaysOnTop.addEventListener("change", () => patchBehavior({ alwaysOnTop: alwaysOnTop.checked }));

// ── 폼 상태 반영 (초기 + 변경 브로드캐스트 시) ──
function renderForm(s) {
  settings = s;

  const metric = s.theme[colorTarget];
  targetHint.textContent = colorTarget === "session" ? "(세션)" : "(주간)";
  document.querySelectorAll("#color-target button").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === colorTarget);
  });

  presetGrid.querySelectorAll(".preset-swatch").forEach((el) => {
    el.classList.toggle("selected", el.dataset.presetId === metric.preset);
  });
  // 값이 바뀔 때만 대입 → 사용자가 조작 중인 입력을 방해하지 않음
  if (document.activeElement !== customFrom) customFrom.value = metric.customGradient.from;
  if (document.activeElement !== customTo) customTo.value = metric.customGradient.to;
  if (document.activeElement !== customAngle) customAngle.value = String(metric.customGradient.angle);

  document.querySelectorAll("#bg-mode button").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === s.theme.background);
  });

  if (document.activeElement !== opacityInput) {
    opacityInput.value = String(Math.round(s.theme.opacity * 100));
  }
  opacityValue.textContent = `${Math.round(s.theme.opacity * 100)}%`;

  document.querySelectorAll("#layout-mode button").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === s.layout.mode);
  });
  document.querySelectorAll("#layout-size button").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === s.layout.size);
  });
  document.querySelectorAll(".field-check").forEach((cb) => {
    cb.checked = s.layout.fields.includes(cb.value);
  });

  pollInterval.value = String(s.behavior.pollIntervalSec);
  warnAt.value = String(s.behavior.warnAt);
  dangerAt.value = String(s.behavior.dangerAt);
  notifications.checked = s.behavior.notifications;
  autoStart.checked = s.behavior.autoStart;
  alwaysOnTop.checked = s.behavior.alwaysOnTop;
}

window.claudeUsage.getSettings().then(renderForm);
window.claudeUsage.onSettingsUpdate(renderForm); // 로컬 settings를 항상 최신으로 유지
