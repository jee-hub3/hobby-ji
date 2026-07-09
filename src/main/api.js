// usage 호출 + 오류 처리 — 유일한 네트워크 모듈. api.anthropic.com 외 통신 없음.
// 응답 스키마: docs/api-응답구조.md 참고.

const { execFileSync } = require("child_process");
const { readAccessToken } = require("./credentials");

function getClaudeCliVersion() {
  try {
    // Windows에서 claude.cmd 실행에는 shell 필요(Node child_process 제약).
    // 인자가 고정 리터럴("--version")뿐이라 셸 인젝션 위험은 없음.
    const out = execFileSync("claude --version", { encoding: "utf-8", shell: true }).trim();
    const match = out.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : out;
  } catch {
    return "0.0.0";
  }
}

async function fetchUsageRaw(accessToken, cliVersion) {
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
    const err = new Error(`usage 요청 실패: ${res.status}`);
    err.status = res.status;
    err.body = body;
    err.retryAfterSec = Number(res.headers.get("retry-after")) || null;
    throw err;
  }

  return body;
}

/**
 * /api/oauth/usage 응답에서 위젯에 필요한 세션(5h)/주간(7d) 사용률과
 * 리셋 시각만 추려낸다. 상세 스키마는 docs/api-응답구조.md 참고.
 */
function parseUsage(raw) {
  const findLimit = (kind) => (raw.limits || []).find((l) => l.kind === kind);

  const toBlock = (block, limit) => {
    if (!block) return null;
    return {
      utilizationPercent: block.utilization, // 0-100
      resetsAt: block.resets_at ?? null, // ISO 8601 문자열 (직렬화를 위해 Date로 변환하지 않음)
      severity: limit?.severity ?? null,
      isActive: limit?.is_active ?? null,
    };
  };

  const scoped = (raw.limits || [])
    .filter((l) => l.kind === "weekly_scoped" && l.scope?.model?.display_name)
    .map((l) => ({ label: l.scope.model.display_name, percent: l.percent }));

  return {
    session: toBlock(raw.five_hour, findLimit("session")),
    weekly: toBlock(raw.seven_day, findLimit("weekly_all")),
    scoped,
  };
}

async function tryClaudeUpdate() {
  try {
    execFileSync("claude update", { encoding: "utf-8", shell: true, timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 토큰 읽기 → API 호출 → 파싱까지 한 번에 수행.
 * 실패 시 err.code로 원인을 구분한다:
 *   NO_CREDENTIALS | AUTH_EXPIRED | RATE_LIMITED | NETWORK_ERROR
 */
async function getUsage() {
  const token = readAccessToken();
  if (!token) {
    const err = new Error("credentials 파일을 찾을 수 없습니다.");
    err.code = "NO_CREDENTIALS";
    throw err;
  }

  const cliVersion = getClaudeCliVersion();

  try {
    const raw = await fetchUsageRaw(token, cliVersion);
    return parseUsage(raw);
  } catch (err) {
    if (err.status === 401) {
      // 02-아키텍처.md 오류 처리 규칙: 토큰 만료 시 `claude update`로 갱신 시도
      const updated = await tryClaudeUpdate();
      const freshToken = updated ? readAccessToken() : null;
      if (freshToken) {
        try {
          const raw = await fetchUsageRaw(freshToken, cliVersion);
          return parseUsage(raw);
        } catch {
          // fall through to AUTH_EXPIRED
        }
      }
      const e = new Error("토큰이 만료되었습니다. Claude Code에 다시 로그인하세요.");
      e.code = "AUTH_EXPIRED";
      throw e;
    }

    if (err.status === 429) {
      const e = new Error("요청 한도 초과");
      e.code = "RATE_LIMITED";
      e.retryAfterSec = err.retryAfterSec ?? 30;
      throw e;
    }

    const e = new Error("네트워크 오류");
    e.code = "NETWORK_ERROR";
    e.cause = err;
    throw e;
  }
}

module.exports = { getUsage, parseUsage, getClaudeCliVersion };
