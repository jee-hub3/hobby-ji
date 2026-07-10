// 컨셉별 색상 프리셋 — widget/settings 렌더러가 <script>로 공유.
// 컨셉 추가 시 CONCEPT_PRESETS에 배열만 더하면 됨 (06-컨셉-스킨-명세.md).

// classic: 단일 그라데이션 6종 (세션/주간에 각각 독립 적용)
const CLASSIC_PRESETS = [
  { id: "claude", name: "Claude", from: "#D97757", to: "#E8A87C" },
  { id: "ocean", name: "Ocean", from: "#667eea", to: "#64b5f6" },
  { id: "sunset", name: "Sunset", from: "#f857a6", to: "#ff5858" },
  { id: "mint", name: "Mint", from: "#11998e", to: "#38ef7d" },
  { id: "night", name: "Night", from: "#232526", to: "#414345" },
  { id: "aurora", name: "Aurora", from: "#a18cd1", to: "#fbc2eb" },
];

// aurora: 세션 그라데이션 × 주간 그라데이션 페어
const AURORA_PRESETS = [
  { id: "ember-indigo", name: "Ember × Indigo", session: { from: "#FF8C59", to: "#FFC46B" }, weekly: { from: "#7C5CFF", to: "#5CD6FF" } },
  { id: "flare-ocean", name: "Flare × Ocean", session: { from: "#FF5E7A", to: "#FF9E6B" }, weekly: { from: "#38C6FF", to: "#6BE0E0" } },
  { id: "lime-violet", name: "Lime × Violet", session: { from: "#B8E986", to: "#7FD96B" }, weekly: { from: "#9B59FF", to: "#C89BFF" } },
  { id: "gold-teal", name: "Gold × Teal", session: { from: "#FFC46B", to: "#FFE29B" }, weekly: { from: "#2BD9C8", to: "#6BE8DC" } },
];

// brutal: 플랫 색 페어 (from == to)
const BRUTAL_PRESETS = [
  { id: "tomato-sky", name: "TOMATO × SKY", session: { from: "#FF6B36", to: "#FF6B36" }, weekly: { from: "#3B82F6", to: "#3B82F6" } },
  { id: "lemon-grape", name: "LEMON × GRAPE", session: { from: "#FFD432", to: "#FFD432" }, weekly: { from: "#8B5CF6", to: "#8B5CF6" } },
  { id: "mint-coral", name: "MINT × CORAL", session: { from: "#2DD4A8", to: "#2DD4A8" }, weekly: { from: "#FF5E7A", to: "#FF5E7A" } },
  { id: "ink-paper", name: "INK × PAPER", session: { from: "#1F1F1F", to: "#1F1F1F" }, weekly: { from: "#B8B2A6", to: "#B8B2A6" } },
];

// ledger: 단일 악센트 잉크
const LEDGER_PRESETS = [
  { id: "terracotta", name: "Terracotta", accent: "#C15F3C" },
  { id: "prussian", name: "Prussian", accent: "#2C4770" },
  { id: "forest", name: "Forest", accent: "#3E5F44" },
  { id: "burgundy", name: "Burgundy", accent: "#7A2E3A" },
];

const CONCEPT_PRESETS = {
  classic: CLASSIC_PRESETS,
  aurora: AURORA_PRESETS,
  brutal: BRUTAL_PRESETS,
  ledger: LEDGER_PRESETS,
};

// 기존 classic 설정 UI 호환용 별칭
const GRADIENT_PRESETS = CLASSIC_PRESETS;

const DEFAULT_GRADIENT = { from: "#D97757", to: "#E8A87C", angle: 135 };

// 위젯이 쓰는 색상 해석기: theme + metric('session'|'weekly') → {from, to, angle}.
// 컨셉/프리셋 형태(단일·페어·잉크·custom)를 모두 흡수해 항상 그라데이션으로 반환한다.
function metricColors(theme, kind) {
  const m = (theme && theme[kind]) || {};
  const concept = (theme && theme.concept) || "classic";

  if (m.preset === "custom" && m.customGradient) {
    return { from: m.customGradient.from, to: m.customGradient.to, angle: m.customGradient.angle ?? 135 };
  }

  const list = CONCEPT_PRESETS[concept] || CLASSIC_PRESETS;
  const p = list.find((x) => x.id === m.preset);
  if (!p) {
    if (m.customGradient) return { from: m.customGradient.from, to: m.customGradient.to, angle: m.customGradient.angle ?? 135 };
    return { ...DEFAULT_GRADIENT };
  }
  if (p.accent) return { from: p.accent, to: p.accent, angle: 135 }; // ledger
  if (p.session && p.weekly) {
    const g = p[kind] || p.session;
    return { from: g.from, to: g.to, angle: 135 }; // aurora/brutal 페어
  }
  return { from: p.from, to: p.to, angle: 135 }; // classic 단일
}

// 하위 호환: 예전 시그니처(단일 metricTheme)로 호출하던 곳을 위해 유지.
function resolveGradient(metricTheme) {
  if (metricTheme && metricTheme.preset === "custom") return metricTheme.customGradient;
  const preset = CLASSIC_PRESETS.find((p) => p.id === (metricTheme && metricTheme.preset));
  return preset ? { from: preset.from, to: preset.to, angle: 135 } : { ...DEFAULT_GRADIENT };
}
