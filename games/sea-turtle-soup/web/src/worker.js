// 바다거북 스프 API. 정적 페이지는 public/에서 그대로 나가고, /api/* 만 이 워커가 받는다.

import RAW from '../content/puzzles.json';
import { normalizePuzzles, menuEntry } from './content.js';
import * as E from './engine.js';
import { judgeQuestion, judgeGuess, costMicro, AIError } from './ai.js';
import { deviceFrom, randomId } from './auth.js';
import { aiOpen, checkAI, recordAI, remainingToday, limitsOf, kstDay } from './limits.js';

const PUZZLES = normalizePuzzles(RAW);
const BY_ID = Object.fromEntries(PUZZLES.map(p => [p.id, p]));
const VERSION = '0.1.0-beta';

const MAX_QUESTION = 300;
const MAX_GUESS = 1000;
const MAX_FEEDBACK = 2000;

/* ------------------------------------------------------------------ http helpers */
class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; }
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

async function body(req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > 16_384) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (text.length > 16_384) throw new HttpError(413, 'too_large');
  if (!text) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : {}; } catch { throw new HttpError(400, 'bad_json'); }
}

function sameOrigin(req) {
  const origin = req.headers.get('Origin');
  if (!origin) return true; // same-origin navigations and sendBeacon from old browsers
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

/* ------------------------------------------------------------------ storage */
async function touchDevice(env, deviceId, fresh) {
  const now = Date.now();
  if (fresh) await env.DB.prepare('INSERT OR IGNORE INTO devices (id, created_at, last_seen) VALUES (?, ?, ?)').bind(deviceId, now, now).run();
  else await env.DB.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').bind(now, deviceId).run();
}

async function event(env, deviceId, g, type, data) {
  await env.DB.prepare('INSERT INTO events (at, device_id, game_id, puzzle_id, type, data) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(Date.now(), deviceId, g ? g.id : null, g ? g.puzzleId : null, type, data ? JSON.stringify(data) : null).run();
}

async function loadGame(env, deviceId, id) {
  const row = await env.DB.prepare('SELECT state, updated_at FROM games WHERE id = ? AND device_id = ?').bind(id, deviceId).first();
  if (!row) throw new HttpError(404, 'no_game');
  const g = JSON.parse(row.state);
  const p = BY_ID[g.puzzleId];
  if (!p) throw new HttpError(410, 'puzzle_gone');
  return { g, p, version: row.updated_at };
}

/** Optimistic save: fails with 409 if another request changed the game since it was loaded. */
async function saveGame(env, g, version) {
  const now = Math.max(Date.now(), version + 1);
  g.updatedAt = now;
  const r = await env.DB.prepare('UPDATE games SET state = ?, phase = ?, updated_at = ? WHERE id = ? AND updated_at = ?')
    .bind(JSON.stringify(g), g.phase, now, g.id, version).run();
  if (!r.meta || r.meta.changes !== 1) throw new HttpError(409, 'conflict');
  return now;
}

async function saveRecord(env, deviceId, g) {
  const r = g.result;
  if (!r) return;
  const prev = await env.DB.prepare('SELECT stars, minutes FROM records WHERE device_id = ? AND puzzle_id = ?').bind(deviceId, g.puzzleId).first();
  if (prev && (prev.stars > r.stars || (prev.stars === r.stars && prev.minutes <= r.minutes))) return;
  await env.DB.prepare('INSERT OR REPLACE INTO records (device_id, puzzle_id, stars, minutes, q, hints, skipped, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(deviceId, g.puzzleId, r.stars, r.minutes, r.q, r.hints, r.skipped, Date.now()).run();
}

async function afterChange(env, deviceId, g, before, ev) {
  if (!ev.advanced) return;
  const last = ev.finished ? BY_ID[g.puzzleId].chapters.length : g.chapter - 1;
  for (let ch = before.chapter; ch <= last; ch++) {
    await event(env, deviceId, g, 'chapter_clear', { ch, q: E.countQ(g), ms: g.elapsed, skipped: g.skipped.includes(ch) });
  }
  if (ev.finished) {
    await saveRecord(env, deviceId, g);
    await event(env, deviceId, g, 'solved', g.result);
  }
}

const out = (p, g, extra = {}) => ({ game: E.gameView(g), puzzle: E.puzzleView(p, g), ...extra });

function canPlay(env, p) {
  // 결제를 붙이면 여기서 구매 여부를 확인한다. 베타에서는 access가 'free'인 문제만 있고, ALL_ACCESS=true면 모두 연다.
  return p.access === 'free' || env.ALL_ACCESS === 'true';
}

/* ------------------------------------------------------------------ handlers */
async function handleAI(env, req, deviceId, id, kind, b) {
  const text = String(b.text || '').trim();
  const max = kind === 'q' ? MAX_QUESTION : MAX_GUESS;
  if (!text) throw new HttpError(400, 'empty');
  if (text.length > max) throw new HttpError(400, 'too_long', { max });

  let { g, p } = await loadGame(env, deviceId, id);
  if (g.phase !== 'play') throw new HttpError(409, 'ended');
  try { await checkAI(env, req, deviceId); } catch (e) {
    if (e && e.code) throw new HttpError(429, e.code, { remaining: await remainingToday(env, deviceId) });
    throw e;
  }

  const t0 = Date.now();
  const chapter = g.chapter;
  let result = null, failure = null;
  try {
    result = kind === 'q' ? await judgeQuestion(env, p, g, text) : await judgeGuess(env, p, g, text);
  } catch (e) {
    failure = e instanceof AIError ? e : new AIError('upstream_error', String(e && e.message));
  }
  const usage = (result && result.usage) || (failure && failure.usage) || {};
  const model = result ? result.model : (kind === 'q' ? env.MODEL_ASK : env.MODEL_GUESS);
  await recordAI(env, req, {
    at: Date.now(), deviceId, gameId: g.id, puzzleId: g.puzzleId, kind, model,
    input: usage.input_tokens || 0, read: usage.cache_read_input_tokens || 0, write: usage.cache_creation_input_tokens || 0,
    output: usage.output_tokens || 0, cost: costMicro(env, model, usage), ms: Date.now() - t0, ok: !failure, err: failure ? failure.code : null,
  });
  if (failure) {
    const status = failure.code === 'refused' ? 422 : failure.code === 'upstream_busy' ? 503 : 502;
    throw new HttpError(status, failure.code);
  }

  // the AI took a while: apply its ruling to the latest state, unless the chapter moved on meanwhile
  for (let attempt = 0; attempt < 2; attempt++) {
    const fresh = await loadGame(env, deviceId, id);
    g = fresh.g; p = fresh.p;
    if (g.phase !== 'play' || g.chapter !== chapter) throw new HttpError(409, 'stale');
    E.syncElapsed(g, b.elapsed, Date.now());
    const before = { chapter: g.chapter };
    const ev = E.applyAI(p, g, kind, text, result.ruling);
    try {
      await saveGame(env, g, fresh.version);
      await afterChange(env, deviceId, g, before, ev);
      return out(p, g, { entry: ev.entry, events: { advanced: ev.advanced, finished: ev.finished }, remaining: await remainingToday(env, deviceId) });
    } catch (e) {
      if (!(e instanceof HttpError && e.code === 'conflict') || attempt === 1) throw e;
    }
  }
  throw new HttpError(409, 'conflict');
}

/** Generic state change: load → mutate → save, with the client's clock folded in. */
async function mutate(env, deviceId, id, b, fn) {
  for (let attempt = 0; ; attempt++) {
    const { g, p, version } = await loadGame(env, deviceId, id);
    E.syncElapsed(g, b.elapsed, Date.now());
    const before = { chapter: g.chapter, phase: g.phase };
    const ev = fn(p, g) || { advanced: false, finished: false };
    try {
      await saveGame(env, g, version);
    } catch (e) {
      // another request (often the clock beacon) saved first: re-read and apply again
      if (e instanceof HttpError && e.code === 'conflict' && attempt < 2) continue;
      throw e;
    }
    await afterChange(env, deviceId, g, before, ev);
    return { p, g, ev };
  }
}

async function route(req, env, ctx, dev) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  const deviceId = dev.deviceId;
  if (method === 'POST' && !sameOrigin(req)) throw new HttpError(403, 'cross_origin');

  if (path === '/api/config' && method === 'GET') {
    const ai = await aiOpen(env);
    return { version: VERSION, beta: true, ai, remaining: await remainingToday(env, deviceId), limits: { deviceDaily: limitsOf(env).deviceDaily } };
  }
  if (path === '/api/puzzles' && method === 'GET') return { puzzles: PUZZLES.map(menuEntry) };

  if (path === '/api/me' && method === 'GET') {
    const [recs, games] = await Promise.all([
      env.DB.prepare('SELECT puzzle_id, stars, minutes, q, hints, skipped, at FROM records WHERE device_id = ?').bind(deviceId).all(),
      env.DB.prepare('SELECT state FROM games WHERE device_id = ? AND active = 1').bind(deviceId).all(),
    ]);
    const solved = {};
    for (const r of recs.results || []) solved[r.puzzle_id] = { stars: r.stars, minutes: r.minutes, q: r.q, hints: r.hints, skipped: r.skipped, at: r.at };
    const gs = {};
    for (const r of games.results || []) { const g = JSON.parse(r.state); if (BY_ID[g.puzzleId]) gs[g.puzzleId] = E.gameView(g); }
    return { solved, games: gs };
  }
  if (path === '/api/me/reset' && method === 'POST') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM records WHERE device_id = ?').bind(deviceId),
      env.DB.prepare('UPDATE games SET active = 0 WHERE device_id = ?').bind(deviceId),
    ]);
    await event(env, deviceId, null, 'reset');
    return { ok: true };
  }

  if (path === '/api/games' && method === 'POST') {
    const b = await body(req);
    const p = BY_ID[String(b.puzzleId || '')];
    if (!p) throw new HttpError(404, 'no_puzzle');
    if (!canPlay(env, p)) throw new HttpError(402, 'locked');
    if (!b.restart) {
      const row = await env.DB.prepare('SELECT state FROM games WHERE device_id = ? AND puzzle_id = ? AND active = 1 ORDER BY updated_at DESC LIMIT 1')
        .bind(deviceId, p.id).first();
      if (row) { const g = JSON.parse(row.state); return out(p, g); }
    }
    const now = Date.now();
    const g = E.newGame(p, randomId(12), now);
    await env.DB.batch([
      env.DB.prepare('UPDATE games SET active = 0 WHERE device_id = ? AND puzzle_id = ? AND active = 1').bind(deviceId, p.id),
      env.DB.prepare('INSERT INTO games (id, device_id, puzzle_id, state, phase, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
        .bind(g.id, deviceId, p.id, JSON.stringify(g), g.phase, now, now),
    ]);
    await event(env, deviceId, g, b.restart ? 'restart' : 'start');
    return out(p, g);
  }

  const m = path.match(/^\/api\/games\/([A-Za-z0-9_-]{8,40})(?:\/([a-z-]+))?$/);
  if (m) {
    const [, id, action] = m;
    if (!action && method === 'GET') { const { g, p } = await loadGame(env, deviceId, id); return out(p, g); }
    if (action === 'host-note' && method === 'GET') {
      const { g, p } = await loadGame(env, deviceId, id);
      if (g.phase !== 'play') throw new HttpError(409, 'ended');
      await event(env, deviceId, g, 'host_note', { ch: g.chapter });
      return E.hostNote(p, g);
    }
    if (method !== 'POST') throw new HttpError(405, 'method');
    const b = await body(req);
    if (action === 'ask') return handleAI(env, req, deviceId, id, 'q', b);
    if (action === 'guess') return handleAI(env, req, deviceId, id, 'g', b);
    if (action === 'clock') { const r = await mutate(env, deviceId, id, b, () => null); return { elapsed: r.g.elapsed }; }
    const playing = (p, g) => { if (g.phase !== 'play') throw new HttpError(409, 'ended'); };
    let r;
    if (action === 'hint') {
      r = await mutate(env, deviceId, id, b, (p, g) => { playing(p, g); if (!E.openHint(p, g)) throw new HttpError(409, 'no_hint'); return null; });
      await event(env, deviceId, r.g, 'hint', { ch: r.g.chapter, n: r.g.hints[r.g.chapter - 1] });
    } else if (action === 'skip') {
      const ch = (await loadGame(env, deviceId, id)).g.chapter;
      r = await mutate(env, deviceId, id, b, (p, g) => { playing(p, g); return E.skipChapter(p, g); });
      await event(env, deviceId, r.g, 'skip', { ch });
    } else if (action === 'giveup') {
      r = await mutate(env, deviceId, id, b, (p, g) => { playing(p, g); E.finish(p, g, 'gaveup'); return { advanced: false, finished: false }; });
      await event(env, deviceId, r.g, 'gaveup', { ch: r.g.chapter, q: E.countQ(r.g), ms: r.g.elapsed });
    } else if (action === 'host') {
      const kind = b.kind === 'g' ? 'g' : 'q';
      const a = String(b.a || '');
      if (!(kind === 'q' ? E.ANSWER_CODES.includes(a) && a !== 'invalid' : E.VERDICT_CODES.includes(a))) throw new HttpError(400, 'bad_answer');
      const text = String(b.text || '').trim().slice(0, kind === 'q' ? MAX_QUESTION : MAX_GUESS);
      let entry = null;
      r = await mutate(env, deviceId, id, b, (p, g) => { playing(p, g); const ev = E.applyHost(p, g, kind, a, text); entry = ev.entry; return ev; });
      return out(r.p, r.g, { entry, events: { advanced: r.ev.advanced, finished: r.ev.finished } });
    } else if (action === 'found') {
      const n = Number(b.n);
      r = await mutate(env, deviceId, id, b, (p, g) => { playing(p, g); return E.toggleFound(p, g, n, !!b.on); });
    } else {
      throw new HttpError(404, 'no_route');
    }
    return out(r.p, r.g, { events: { advanced: r.ev.advanced, finished: r.ev.finished } });
  }

  if (path === '/api/feedback' && method === 'POST') {
    const b = await body(req);
    const text = String(b.text || '').trim();
    if (!text) throw new HttpError(400, 'empty');
    const pid = BY_ID[String(b.puzzleId || '')] ? String(b.puzzleId) : null;
    const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM feedback WHERE device_id = ? AND at > ?').bind(deviceId, Date.now() - 86400e3).first();
    if (today && today.n >= 20) throw new HttpError(429, 'daily_limit');
    await env.DB.prepare('INSERT INTO feedback (at, device_id, puzzle_id, text) VALUES (?, ?, ?, ?)').bind(Date.now(), deviceId, pid, text.slice(0, MAX_FEEDBACK)).run();
    return { ok: true };
  }

  if (path === '/api/admin/stats' && method === 'GET') return adminStats(req, env, url);
  throw new HttpError(404, 'no_route');
}

/* ------------------------------------------------------------------ admin */
async function adminStats(req, env, url) {
  const auth = req.headers.get('Authorization') || '';
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) throw new HttpError(401, 'unauthorized');
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 7));
  const since = Date.now() - days * 86400e3;
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then(r => r.results || []);
  const [spend, calls, funnel, perPuzzle, feedback, devices] = await Promise.all([
    q("SELECT day, calls, cost_micro FROM usage_daily WHERE subject = 'all' AND day >= ? ORDER BY day", kstDay(since)),
    q('SELECT kind, model, COUNT(*) AS n, SUM(ok) AS ok, AVG(ms) AS avg_ms, SUM(cost_micro) AS cost_micro, SUM(input_tokens) AS input, SUM(cache_read) AS cache_read, SUM(cache_write) AS cache_write, SUM(output_tokens) AS output FROM ai_calls WHERE at > ? GROUP BY kind, model', since),
    q('SELECT type, COUNT(*) AS n, COUNT(DISTINCT device_id) AS devices FROM events WHERE at > ? GROUP BY type ORDER BY n DESC', since),
    q("SELECT puzzle_id, SUM(type = 'start') AS starts, SUM(type = 'solved') AS solved, SUM(type = 'gaveup') AS gaveup, SUM(type = 'hint') AS hints, SUM(type = 'skip') AS skips FROM events WHERE at > ? AND puzzle_id IS NOT NULL GROUP BY puzzle_id", since),
    q('SELECT at, puzzle_id, text FROM feedback WHERE at > ? ORDER BY at DESC LIMIT 100', since),
    q('SELECT COUNT(*) AS total, SUM(created_at > ?) AS new FROM devices', since),
  ]);
  const costPerGame = await q("SELECT g.puzzle_id, COUNT(DISTINCT a.game_id) AS games, SUM(a.cost_micro) AS cost_micro, COUNT(*) AS calls FROM ai_calls a JOIN games g ON g.id = a.game_id WHERE a.at > ? GROUP BY g.puzzle_id", since);
  return { days, spend, calls, funnel, perPuzzle, costPerGame, devices: devices[0] || {}, feedback };
}

/* ------------------------------------------------------------------ entry */
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    let dev;
    try {
      dev = await deviceFrom(req, env);
      await touchDevice(env, dev.deviceId, dev.fresh);
      const data = await route(req, env, ctx, dev);
      return json(data, 200, dev.setCookie ? { 'Set-Cookie': dev.setCookie } : {});
    } catch (e) {
      const headers = dev && dev.setCookie ? { 'Set-Cookie': dev.setCookie } : {};
      if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status, headers);
      console.error('unhandled', e && e.stack || e);
      return json({ error: 'server_error' }, 500, headers);
    }
  },

  // 매일 새벽 정리: 오래된 호출 기록과 끝난 판을 지운다(개인정보 처리방침의 보관 기간과 맞춘다).
  async scheduled(event, env) {
    const day = 86400e3, now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ai_calls WHERE at < ?').bind(now - 90 * day),
      env.DB.prepare('DELETE FROM events WHERE at < ?').bind(now - 365 * day),
      env.DB.prepare('DELETE FROM games WHERE updated_at < ?').bind(now - 180 * day),
      env.DB.prepare('DELETE FROM feedback WHERE at < ?').bind(now - 365 * day),
      env.DB.prepare("DELETE FROM usage_daily WHERE day < ?").bind(kstDay(now - 120 * day)),
    ]);
  },
};
