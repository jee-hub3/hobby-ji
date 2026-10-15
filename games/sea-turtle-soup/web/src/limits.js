// 베타 기간 비용 방어선. AI를 부르기 전에 확인하고, 부른 뒤에 기록한다.
//   AI_DAILY_BUDGET_USD     하루 전체 예산 (넘으면 그날은 AI 진행을 멈추고 친구 진행만 연다)
//   AI_DEVICE_DAILY_CALLS   기기 하나의 하루 AI 호출 수
//   AI_IP_DAILY_CALLS       IP 하나의 하루 AI 호출 수 (기기 ID를 새로 만들어 한도를 피하는 것을 막는다)
//   AI_DEVICE_PER_MINUTE    기기 하나의 1분 호출 수

import { sha256hex } from './auth.js';

export const kstDay = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export function limitsOf(env) {
  return {
    budgetMicro: Math.round(num(env.AI_DAILY_BUDGET_USD, 5) * 1e6),
    deviceDaily: num(env.AI_DEVICE_DAILY_CALLS, 150),
    ipDaily: num(env.AI_IP_DAILY_CALLS, 400),
    perMinute: num(env.AI_DEVICE_PER_MINUTE, 8),
  };
}

export async function ipSubject(req, env, day) {
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'local';
  return `ip:${(await sha256hex(`${ip}|${day}|${env.SESSION_SECRET}`)).slice(0, 20)}`;
}

async function usage(db, day, subject) {
  const r = await db.prepare('SELECT calls, cost_micro FROM usage_daily WHERE day = ? AND subject = ?').bind(day, subject).first();
  return r || { calls: 0, cost_micro: 0 };
}

/** Is the AI host open at all today? (used by /api/config so the page can say so up front) */
export async function aiOpen(env) {
  if (!env.ANTHROPIC_API_KEY || env.AI_ENABLED === 'false') return { open: false, reason: 'disabled' };
  const all = await usage(env.DB, kstDay(), 'all');
  if (all.cost_micro >= limitsOf(env).budgetMicro) return { open: false, reason: 'budget' };
  return { open: true, reason: null };
}

/** Throws a {code} object when this call must not go through. */
export async function checkAI(env, req, deviceId) {
  const day = kstDay();
  const L = limitsOf(env);
  const gate = await aiOpen(env);
  if (!gate.open) throw { code: gate.reason === 'budget' ? 'budget_exhausted' : 'ai_disabled' };
  const [dev, ip] = await Promise.all([usage(env.DB, day, `d:${deviceId}`), usage(env.DB, day, await ipSubject(req, env, day))]);
  if (dev.calls >= L.deviceDaily || ip.calls >= L.ipDaily) throw { code: 'daily_limit' };
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_calls WHERE device_id = ? AND at > ?')
    .bind(deviceId, Date.now() - 60_000).first();
  if (recent && recent.n >= L.perMinute) throw { code: 'too_fast' };
}

export async function recordAI(env, req, row) {
  const day = kstDay(row.at);
  const ipSub = await ipSubject(req, env, day);
  const up = 'INSERT INTO usage_daily (day, subject, calls, cost_micro) VALUES (?, ?, 1, ?) ON CONFLICT(day, subject) DO UPDATE SET calls = calls + 1, cost_micro = cost_micro + excluded.cost_micro';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO ai_calls (at, device_id, game_id, puzzle_id, kind, model, input_tokens, cache_read, cache_write, output_tokens, cost_micro, ms, ok, err) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(row.at, row.deviceId, row.gameId, row.puzzleId, row.kind, row.model, row.input, row.read, row.write, row.output, row.cost, row.ms, row.ok ? 1 : 0, row.err || null),
    env.DB.prepare(up).bind(day, 'all', row.cost),
    env.DB.prepare(up).bind(day, `d:${row.deviceId}`, row.cost),
    env.DB.prepare(up).bind(day, ipSub, row.cost),
  ]);
}

export async function remainingToday(env, deviceId) {
  const L = limitsOf(env);
  const dev = await usage(env.DB, kstDay(), `d:${deviceId}`);
  return Math.max(0, L.deviceDaily - dev.calls);
}
