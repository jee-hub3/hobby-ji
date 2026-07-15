let settings = null;
let colorTarget = "session"; // 색상 편집 대상: session | weekly
let gridConcept = null; // 프리셋 그리드를 마지막으로 그린 컨셉

// 컨셉 전환 시 세션/주간에 채울 기본 프리셋 (저장된 선택이 없을 때만 사용)
const CONCEPT_DEFAULTS = {
  classic: { s: "claude", w: "ocean" },
  aurora: { s: "ember", w: "indigo" },
  brutal: { s: "tomato-sky", w: "tomato-sky" },
  ledger: { s: "terracotta", w: "terracotta" },
};

// classic·aurora는 색상 적용 대상(세션/주간)을 골라 프리셋/커스텀을 개별 적용,
// brutal(페어)·ledger(단일 잉크)는 대상 구분 없이 한 번에 적용한다.
const HAS_COLOR_TARGET = { classic: true, aurora: true, brutal: false, ledger: false };

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
// 떠나는 컨셉의 색 선택(세션/주간)을 theme.perConcept에 저장해두고,
// 도착 컨셉에 저장분이 있으면 복원, 없으면 그 컨셉의 기본 프리셋 적용.
document.querySelectorAll("#concept-grid .concept-card").forEach((card) => {
  card.addEventListener("click", () => {
    const concept = card.dataset.concept;
    const current = (settings.theme && settings.theme.concept) || "classic";
    if (concept === current) return;
    const per = { ...((settings.theme && settings.theme.perConcept) || {}) };
    per[current] = { session: settings.theme.session, weekly: settings.theme.weekly };
    const saved = per[concept];
    const d = CONCEPT_DEFAULTS[concept] || CONCEPT_DEFAULTS.classic;
    patchTheme({
      concept,
      session: saved ? saved.session : metricObj(concept, d.s, "session"),
      weekly: saved ? saved.weekly : metricObj(concept, d.w, "weekly"),
      perConcept: per,
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
      if (HAS_COLOR_TARGET[concept]) {
        // classic·aurora: 선택된 대상(세션/주간)에만 적용
        patchColorTarget({ preset: p.id });
      } else {
        // brutal(페어)·ledger(잉크): 세션/주간 동시 적용
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
const customFromText = document.getElementById("custom-from-text");
const customToText = document.getElementById("custom-to-text");
const customToLabel = document.getElementById("custom-to-label");
const customAngleLabel = document.getElementById("custom-angle-label");
const targetSection = document.getElementById("target-section");

// 컨셉별 커스텀 색상 의미:
//  classic — 대상(세션/주간)에 시작/끝/방향 그라데이션
//  aurora  — 대상에 시작/끝 그라데이션 (방향은 링 SVG 고정이라 없음)
//  brutal  — 피커 2개가 곧 세션색/주간색 (플랫)
//  ledger  — 피커 1개 = 잉크색 (세션/주간 공통)
function pushCustomGradient() {
  const concept = (settings.theme && settings.theme.concept) || "classic";
  if (concept === "classic") {
    patchColorTarget({
      preset: "custom",
      customGradient: { from: customFrom.value, to: customTo.value, angle: Number(customAngle.value) },
    });
  } else if (concept === "aurora") {
    patchColorTarget({
      preset: "custom",
      customGradient: { from: customFrom.value, to: customTo.value, angle: 135 },
    });
  } else if (concept === "brutal") {
    patchTheme({
      session: { preset: "custom", customGradient: { from: customFrom.value, to: customFrom.value, angle: 135 } },
      weekly: { preset: "custom", customGradient: { from: customTo.value, to: customTo.value, angle: 135 } },
    });
  } else {
    const ink = customFrom.value;
    patchTheme({
      session: { preset: "custom", customGradient: { from: ink, to: ink, angle: 135 } },
      weekly: { preset: "custom", customGradient: { from: ink, to: ink, angle: 135 } },
    });
  }
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

  // 컨셉별 색상 UI 구성:
  //  - 색상 적용 대상: classic·aurora만 표시
  //  - 방향: classic만 표시
  //  - 끝 색: brutal(주간색으로 재사용)·classic·aurora 표시, ledger 숨김
  const hasTarget = !!HAS_COLOR_TARGET[concept];
  targetSection.hidden = !hasTarget;
  customAngleLabel.hidden = concept !== "classic";
  customToLabel.hidden = concept === "ledger";
  customFromText.textContent = concept === "brutal" ? "세션" : concept === "ledger" ? "잉크" : "시작";
  customToText.textContent = concept === "brutal" ? "주간" : "끝";

  const metric = s.theme[colorTarget];
  targetHint.textContent = colorTarget === "session" ? "(세션)" : "(주간)";
  document.querySelectorAll("#color-target button").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === colorTarget);
  });

  const activePreset = hasTarget ? metric.preset : s.theme.session.preset;
  presetGrid.querySelectorAll(".preset-swatch").forEach((elm) => {
    elm.classList.toggle("selected", elm.dataset.presetId === activePreset);
  });

  // 커스텀 피커 값: classic·aurora=대상 metric, brutal=세션/주간 from, ledger=세션 from(잉크)
  // customGradient가 누락된 옛 설정도 안전하게 처리 (옵셔널 체이닝 + 기본색 폴백)
  const DEF = "#D97757";
  const mc = metric && metric.customGradient;
  const sc = s.theme.session && s.theme.session.customGradient;
  const wc = s.theme.weekly && s.theme.weekly.customGradient;
  const fromVal = (hasTarget ? mc && mc.from : sc && sc.from) || DEF;
  const toVal = (concept === "brutal" ? wc && wc.from : hasTarget ? mc && mc.to : sc && sc.to) || DEF;
  if (document.activeElement !== customFrom) customFrom.value = fromVal;
  if (document.activeElement !== customTo) customTo.value = toVal;
  if (document.activeElement !== customAngle) customAngle.value = String((mc && mc.angle) ?? 135);

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
