// 그라데이션 프리셋 6종 — widget/settings 렌더러가 <script>로 공유.
// 새 프리셋 추가 시 이 배열에만 항목을 더하면 됨 (03-UI-커스터마이징.md).

const GRADIENT_PRESETS = [
  { id: "claude", name: "Claude", from: "#D97757", to: "#E8A87C" },
  { id: "ocean", name: "Ocean", from: "#667eea", to: "#64b5f6" },
  { id: "sunset", name: "Sunset", from: "#f857a6", to: "#ff5858" },
  { id: "mint", name: "Mint", from: "#11998e", to: "#38ef7d" },
  { id: "night", name: "Night", from: "#232526", to: "#414345" },
  { id: "aurora", name: "Aurora", from: "#a18cd1", to: "#fbc2eb" },
];

function resolveGradient(theme) {
  if (theme.preset === "custom") {
    return theme.customGradient;
  }
  const preset = GRADIENT_PRESETS.find((p) => p.id === theme.preset);
  return preset ? { from: preset.from, to: preset.to, angle: 135 } : { from: "#D97757", to: "#E8A87C", angle: 135 };
}
