let settings = null;
let colorTarget = "session"; // 색상 편집 대상: session | weekly
let gridConcept = null; // 프리셋 그리드를 마지막으로 그린 컨셉

// 컨셉 전환 시 세션/주간에 채울 기본 프리셋
const CONCEPT_DEFAULTS = {
  classic: { s: "claude", w: "ocean" },
  aurora: { s: "ember-indigo", w: "ember-indigo" },
  brutal: { s: "tomato-sky", w: "tomato-sky" },
  ledger: { s: "terracotta", w: "terracotta" },
};

function patchTheme(delta) {
  window.claudeUsage.setSettings({ theme: delta });
}
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

// 프리셋 id → 특정 메트릭 색상 {from,to,angle}
function colorsFor(concept, presetId, kind) {
  const list = CONCEPT_PRESETS[concept] || CONCEPT_PRESETS.classic;
  const p = list.find((x) => x.id === presetId);
  if (!p) return { from: "#D97757", to: "#E8A87C", angle: 135 };
  if (p.accent) return { from: p.accent, to: p.accent, angle: 135 };
  if (p.session && p.weekly) {
    const g = p[kind];
    return { from: g.from, to: g.to, angle: 135 };
  }
  return { from: p.from, to: p.to, angle: 135 };
}

function metricObj(concept, presetId, kind) {
  return { preset: presetId, customGradient: colorsFor(concept, presetId, kind) };
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

// ── 컨셉 선택 ──
document.querySelectorAll("#concept-grid .concept-card").forEach((card) => {
  card.addEventListener("click", () => {
    const concept = card.dataset.concept;
    const d = CONCEPT_DEFAULTS[concept] || CONCEPT_DEFAULTS.classic;
    // 컨셉 + 해당 컨셉 기본 프리셋을 세션/주간에 적용 (레이아웃/투명도/동작은 유지)
    patchTheme({
      concept,
      session: metricObj(concept, d.s, "session"),
      weekly: metricObj(concept, d.w, "weekly"),
    });
  });
});

// ── 색상 적용 대상 ──
const targetHint = document.getElementById("target-hint");
document.querySelectorAll("#color-target button").forEach((btn) => {
  btn.addEventListener("click", () => {
    colorTarget = btn.dataset.value;
    renderForm(settings);
  });
});

// ── 프리셋 그리드 (컨셉별로 다시 그림) ──
const presetGrid = document.getElementById("preset-grid");

function swatchBackground(concept, p) {
  if (p.accent) return p.accent;
  if (p.session && p.weekly) return `linear-gradient(90deg, ${p.session.from} 0 50%, ${p.weekly.from} 50% 100%)`;
  return `linear-gradient(135deg, ${p.from}, ${p.to})`;
}

function buildPresetGrid(concept) {
  const list = CONCEPT_PRESETS[concept] || CONCEPT_PRESETS.classic;
  presetGrid.innerHTML = "";
  list.forEach((p) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "preset-swatch";
    swatch.title = p.name;
    swatch.style.background = swatchBackground(concept, p);
    swatch.dataset.presetId = p.id;
    swatch.addEventListener("click", () => {
      if (concept === "classic") {
        patchColorTarget({ preset: p.id });
      } else {
        patchTheme({ session: metricObj(concept, p.id, "session"), weekly: metricObj(concept, p.id, "weekly") });
      }
    });
    presetGrid.appendChild(swatch);
  });
  gridConcept = concept;
}

const customFrom = document.getElementById("custom-from");
const customTo = document.getElementById("custom-to");
const customAngle = document.getElementById("custom-angle");

function pushCustomGradient() {
  patchColorTarget({
    preset: "custom",
    customGradient: { from: customFrom.value, to: customTo.value, angle: Number(customAngle.value) },
  });
}
customFrom.addEventListener("input", pushCustomGradient);
customTo.addEventListener("input", pushCustomGradient);
customAngle.addEventListener("change", pushCustomGradient);

// ── 배경 스타일 그리드 (classic 전용) ──
const bgstyleGrid = document.getElementById("bgstyle-grid");
BG_STYLES.forEach((bs) => {
  const sw = document.createElement("button");
  sw.type = "button";
  sw.className = `bgstyle-swatch bgsw-${bs.id}`;
  sw.title = bs.name;
  sw.dataset.bgId = bs.id;
  sw.addEventListener("click", () => patchTheme({ bgStyle: bs.id }));
  bgstyleGrid.appendChild(sw);
});

// emerald/magma 추천 바 색 조합 적용 버튼
const bgRecoBtn = document.getElementById("bg-reco-btn");
bgRecoBtn.addEventListener("click", () => {
  const reco = BG_RECO[settings.theme.bgStyle];
  if (!reco) return;
  patchTheme({
    session: { preset: "custom", customGradient: { ...reco.session } },
    weekly: { preset: "custom", customGradient: { ...reco.weekly } },
  });
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
const autoStartNote = document.getElementById("auto-start-note");
autoStart.addEventListener("change", () => patchBehavior({ autoStart: autoStart.checked }));
window.claudeUsage.getAppInfo().then((info) => {
  if (!info.canAutoStart) {
    autoStart.disabled = true;
    autoStartNote.textContent = "(설치본에서만 지원)";
  }
});
const alwaysOnTop = document.getElementById("always-on-top");
alwaysOnTop.addEventListener("change", () => patchBehavior({ alwaysOnTop: alwaysOnTop.checked }));

// ── 폼 상태 반영 ──
function renderForm(s) {
  settings = s;
  const concept = (s.theme && s.theme.concept) || "classic";

  // 설정 패널도 현재 컨셉의 시각 언어로 리스킨 (settings.css의 [data-concept] 스코프)
  document.body.dataset.concept = concept;
  const rootEl = document.documentElement;
  const sg = metricColors(s.theme, "session");
  const wg = metricColors(s.theme, "weekly");
  rootEl.style.setProperty("--session-from", sg.from);
  rootEl.style.setProperty("--session-to", sg.to);
  rootEl.style.setProperty("--weekly-from", wg.from);
  rootEl.style.setProperty("--weekly-to", wg.to);

  document.querySelectorAll("#concept-grid .concept-card").forEach((c) => {
    c.classList.toggle("selected", c.dataset.concept === concept);
  });

  if (gridConcept !== concept) buildPresetGrid(concept);

  const metric = s.theme[colorTarget];
  targetHint.textContent = colorTarget === "session" ? "(세션)" : "(주간)";
  document.querySelectorAll("#color-target button").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === colorTarget);
  });

  const activePreset = concept === "classic" ? metric.preset : s.theme.session.preset;
  presetGrid.querySelectorAll(".preset-swatch").forEach((elm) => {
    elm.classList.toggle("selected", elm.dataset.presetId === activePreset);
  });

  if (document.activeElement !== customFrom) customFrom.value = metric.customGradient.from;
  if (document.activeElement !== customTo) customTo.value = metric.customGradient.to;
  if (document.activeElement !== customAngle) customAngle.value = String(metric.customGradient.angle);

  // 배경 스타일은 classic 전용
  const bgSection = document.getElementById("bgstyle-section");
  bgSection.hidden = concept !== "classic";
  bgstyleGrid.querySelectorAll(".bgstyle-swatch").forEach((sw) => {
    sw.classList.toggle("selected", sw.dataset.bgId === s.theme.bgStyle);
  });
  // emerald/magma일 때만 추천 조합 버튼 노출
  bgRecoBtn.hidden = !BG_RECO[s.theme.bgStyle];

  if (document.activeElement !== opacityInput) opacityInput.value = String(Math.round(s.theme.opacity * 100));
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
window.claudeUsage.onSettingsUpdate(renderForm);
