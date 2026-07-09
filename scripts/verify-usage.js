#!/usr/bin/env node
/**
 * Phase 1 검증 스크립트 — Electron 없이 순수 Node로
 * ~/.claude/.credentials.json의 토큰을 읽어 /api/oauth/usage를 호출하고
 * 응답 JSON 전체를 콘솔에 덤프한다.
 *
 * 사용법: node scripts/verify-usage.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function getCredentialsPath() {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  const base = configDir && configDir.trim() !== "" ? configDir : path.join(os.homedir(), ".claude");
  return path.join(base, ".credentials.json");
}

function readAccessToken() {
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) {
    throw new Error(
      `credentials 파일을 찾을 수 없습니다: ${credPath}\n` +
        `Claude Code CLI에 로그인되어 있는지 확인하세요 (claude login).`
    );
  }
  const raw = fs.readFileSync(credPath, "utf-8");
  const json = JSON.parse(raw);
  const token = json?.claudeAiOauth?.accessToken;
  if (!token) {
    throw new Error(`${credPath} 에서 claudeAiOauth.accessToken 필드를 찾을 수 없습니다.`);
  }
  return token;
}

function getClaudeCliVersion() {
  try {
    // `claude --version` 출력 예: "2.1.205 (Claude Code)"
    // Windows에서 claude.cmd 실행에는 shell 필요(Node child_process 제약).
    // 인자가 고정 리터럴("--version")뿐이라 셸 인젝션 위험은 없음.
    const out = execFileSync("claude --version", { encoding: "utf-8", shell: true }).trim();
    const match = out.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : out;
  } catch (err) {
    console.warn(`⚠️  'claude --version' 실행 실패, 기본값 사용: ${err.message}`);
    return "0.0.0";
  }
}

async function fetchUsage(accessToken, cliVersion) {
  const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": `claude-code/${cliVersion}`,
    },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    const err = new Error(`요청 실패: ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

/**
 * /api/oauth/usage 응답에서 위젯에 필요한 세션(5h)/주간(7d) 사용률과
 * 리셋 시각만 추려낸다. 상세 스키마는 docs/api-응답구조.md 참고.
 *
 * five_hour/seven_day의 utilization·resets_at을 1차 소스로 쓰고,
 * limits[] 배열에서 같은 구간의 severity·is_active를 보강한다.
 * (두 곳에 정보가 중복되어 있으나 top-level 쪽이 더 단순하고 안정적)
 */
function parseUsage(raw) {
  const findLimit = (kind) => (raw.limits || []).find((l) => l.kind === kind);

  const toBlock = (block, limit) => {
    if (!block) return null;
    return {
      utilizationPercent: block.utilization, // 0-100
      resetsAt: block.resets_at ? new Date(block.resets_at) : null,
      severity: limit?.severity ?? null, // "normal" | "warning" | ...
      isActive: limit?.is_active ?? null,
    };
  };

  return {
    session: toBlock(raw.five_hour, findLimit("session")),
    weekly: toBlock(raw.seven_day, findLimit("weekly_all")),
  };
}

async function main() {
  console.log("=== Phase 1: Claude 사용량 API 검증 ===\n");

  console.log(`credentials 경로: ${getCredentialsPath()}`);
  const accessToken = readAccessToken();
  console.log("토큰 읽기 성공 (값은 출력하지 않음)\n");

  const cliVersion = getClaudeCliVersion();
  console.log(`claude CLI 버전: ${cliVersion}\n`);

  console.log("GET https://api.anthropic.com/api/oauth/usage 호출 중...\n");
  const usage = await fetchUsage(accessToken, cliVersion);

  console.log("=== 응답 JSON 전체 ===");
  console.log(JSON.stringify(usage, null, 2));

  console.log("\n=== parseUsage() 결과 ===");
  console.log(JSON.stringify(parseUsage(usage), null, 2));
}

main().catch((err) => {
  console.error("\n❌ 오류 발생:");
  console.error(err.message);
  if (err.status) console.error(`HTTP 상태: ${err.status}`);
  if (err.body) console.error("응답 본문:", JSON.stringify(err.body, null, 2));
  process.exit(1);
});
