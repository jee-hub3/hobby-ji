// 토큰 읽기 — 유일하게 토큰을 다루는 모듈. 여기서 읽은 값은 renderer로 절대 전달하지 않는다.

const fs = require("fs");
const os = require("os");
const path = require("path");

function getCredentialsPath() {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  const base = configDir && configDir.trim() !== "" ? configDir : path.join(os.homedir(), ".claude");
  return path.join(base, ".credentials.json");
}

function readAccessToken() {
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) return null;
  try {
    const raw = fs.readFileSync(credPath, "utf-8");
    const json = JSON.parse(raw);
    return json?.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

module.exports = { getCredentialsPath, readAccessToken };
