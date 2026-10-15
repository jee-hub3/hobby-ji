-- 바다거북 스프 베타 스키마

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

-- 한 기기의 한 문제에는 진행 중인 판(active=1)이 하나만 있다. 다시 시작하면 이전 판은 active=0으로 남는다.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  puzzle_id TEXT NOT NULL,
  state TEXT NOT NULL,
  phase TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS games_by_device ON games (device_id, active, puzzle_id);

-- 문제별 최고 기록 (완식·완주)
CREATE TABLE IF NOT EXISTS records (
  device_id TEXT NOT NULL,
  puzzle_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  q INTEGER NOT NULL,
  hints INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (device_id, puzzle_id)
);

-- 하루 사용량. subject: 'all' | 'd:<기기>' | 'ip:<해시>'. day는 한국 날짜(YYYY-MM-DD).
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,
  subject TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  cost_micro INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, subject)
);

-- AI 호출 한 건마다 한 줄: 비용, 토큰, 응답 시간, 오류. 정확도와 비용을 나중에 따져 보는 근거가 된다.
CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  game_id TEXT,
  puzzle_id TEXT,
  kind TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  cache_write INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_micro INTEGER DEFAULT 0,
  ms INTEGER DEFAULT 0,
  ok INTEGER NOT NULL,
  err TEXT
);
CREATE INDEX IF NOT EXISTS ai_calls_by_device ON ai_calls (device_id, at);
CREATE INDEX IF NOT EXISTS ai_calls_by_at ON ai_calls (at);

-- 제품 지표: 시작, 장 해결, 완식, 포기, 힌트, 넘김 …
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  game_id TEXT,
  puzzle_id TEXT,
  type TEXT NOT NULL,
  data TEXT
);
CREATE INDEX IF NOT EXISTS events_by_at ON events (at);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  puzzle_id TEXT,
  text TEXT NOT NULL
);
