// 설정 저장 — electron-store 래퍼. 스키마: docs/03-UI-커스터마이징.md 참고.
// electron-store v9+가 ESM 전용이라 CommonJS와 호환되는 8.2.0을 사용.

const Store = require("electron-store");

const DEFAULTS = {
  theme: {
    // 막대 색은 세션/주간을 독립적으로 설정한다.
    session: { preset: "claude", customGradient: { from: "#D97757", to: "#E8A87C", angle: 135 } },
    weekly: { preset: "ocean", customGradient: { from: "#667eea", to: "#64b5f6", angle: 135 } },
    background: "dark",
    opacity: 0.92,
  },
  layout: {
    mode: "horizontal", // horizontal | vertical | compact
    size: "M", // S | M | L
    fields: ["session", "weekly", "resetTime"],
  },
  behavior: {
    pollIntervalSec: 90,
    warnAt: 80,
    dangerAt: 95,
    notifications: true,
    autoStart: false,
    alwaysOnTop: true,
  },
  position: { x: null, y: null },
};

const store = new Store({ defaults: DEFAULTS });

// 구(舊) 단일 색상 테마({preset, customGradient})를 세션/주간 분리 형태로 변환.
function migrateTheme() {
  const t = store.get("theme");
  if (t && !t.session) {
    const preset = t.preset || "claude";
    const customGradient = t.customGradient || { from: "#D97757", to: "#E8A87C", angle: 135 };
    store.set("theme", {
      session: { preset, customGradient: { ...customGradient } },
      weekly: { preset, customGradient: { ...customGradient } },
      background: t.background || "dark",
      opacity: typeof t.opacity === "number" ? t.opacity : 0.92,
    });
  }
}
migrateTheme();

function getAll() {
  return store.store;
}

function getPosition() {
  return store.get("position");
}

function setPosition(position) {
  store.set("position", position);
}

/**
 * 설정 섹션 단위(theme/layout/behavior)로 얕은 병합해 저장.
 * theme.session/weekly처럼 중첩 객체는 렌더러가 완전한 하위 객체를 보낸다.
 */
function update(partial) {
  for (const key of Object.keys(partial)) {
    const value = partial[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      store.set(key, { ...store.get(key), ...value });
    } else {
      store.set(key, value);
    }
  }
  return getAll();
}

module.exports = { getAll, getPosition, setPosition, update };
