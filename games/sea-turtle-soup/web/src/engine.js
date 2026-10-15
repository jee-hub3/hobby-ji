// 게임 규칙. 원래 한 파일짜리 게임의 엔진(advance, finish, score, rate …)을 그대로 옮겨 서버가 판정의 주인이 되게 했다.
// 순수 함수만 있어서 Node 테스트에서도 그대로 불러 쓸 수 있다.

export const HINT_PENALTY = 5;
export const WRONG_PENALTY = 3;
export const SKIP_PENALTY = 20;
export const ANSWER_CODES = ['yes', 'no', 'irrelevant', 'partly', 'invalid'];
export const VERDICT_CODES = ['correct', 'close', 'wrong'];

export function newGame(p, id, now) {
  return {
    id, puzzleId: p.id, log: [], phase: 'play', chapter: 1, found: [],
    hints: p.chapters.map(() => 0), skipped: [], elapsed: 0, createdAt: now, updatedAt: now, result: null,
  };
}

export const countQ = g => g.log.filter(e => e.kind === 'q').length;
export const countG = g => g.log.filter(e => e.kind === 'g').length;
export const totalHints = g => g.hints.reduce((a, b) => a + b, 0);
export const wrongGuesses = g => g.log.filter(e => e.kind === 'g' && e.a === 'wrong').length;

export function score(g) {
  return g.elapsed / 60000 + totalHints(g) * HINT_PENALTY + wrongGuesses(g) * WRONG_PENALTY + g.skipped.length * SKIP_PENALTY;
}
export function rate(p, g) {
  const pts = score(g);
  return pts <= p.minutes ? 3 : pts <= p.minutes * 1.5 ? 2 : 1;
}

export function addFound(g, nums) {
  const fresh = nums.filter(n => !g.found.includes(n));
  g.found.push(...fresh);
  g.found.sort((a, b) => a - b);
  return fresh;
}

/**
 * The client reports its own clock (the timer only runs while the play screen is visible).
 * Never let it go backwards, and never past the wall-clock time since the game began.
 */
export function syncElapsed(g, clientMs, now) {
  const ms = Number(clientMs);
  if (!Number.isFinite(ms) || ms < 0) return;
  const ceiling = Math.max(0, now - g.createdAt) + 60000;
  g.elapsed = Math.max(g.elapsed, Math.min(ms, ceiling));
}

export function finish(p, g, phase) {
  g.phase = phase;
  if (phase === 'solved') {
    g.found = p.keyList.map(k => k.n);
    const stars = rate(p, g);
    g.result = {
      stars, score: Math.round(score(g) * 10) / 10,
      minutes: Math.max(1, Math.round(g.elapsed / 60000)), q: countQ(g), hints: totalHints(g), skipped: g.skipped.length,
    };
  }
}

/** Close every chapter whose keys are all found and open the next. Returns what changed. */
export function advance(p, g) {
  let advanced = false;
  while (g.phase === 'play' && p.chapters[g.chapter - 1].keys.every(n => g.found.includes(n))) {
    g.log.push({ kind: 'chapter', ch: g.chapter, q: countQ(g), ms: g.elapsed, skipped: g.skipped.includes(g.chapter) });
    advanced = true;
    if (g.chapter >= p.chapters.length) { finish(p, g, 'solved'); return { advanced, finished: true }; }
    g.chapter += 1;
  }
  return { advanced, finished: false };
}

/** An AI ruling on a question ({answer, note, hits}) or a guess ({matched, comment}). */
export function applyAI(p, g, kind, text, ruling) {
  const ch = g.chapter;
  let entry;
  if (kind === 'q') {
    const hits = addFound(g, ruling.hits);
    entry = { kind, text, a: ruling.answer, note: ruling.note, hits, ch, by: 'ai' };
  } else {
    const hits = addFound(g, ruling.matched);
    const keys = p.chapters[ch - 1].keys;
    const cleared = keys.every(n => g.found.includes(n));
    const a = cleared ? 'correct' : (hits.length || ruling.matched.length * 2 >= keys.length) ? 'close' : 'wrong';
    entry = { kind, text, a, note: ruling.comment, hits, ch, by: 'ai' };
  }
  g.log.push(entry);
  return { entry, ...advance(p, g) };
}

/** A friend host pressed an answer or verdict button. */
export function applyHost(p, g, kind, a, text) {
  const entry = { kind, text, a, note: '', hits: [], ch: g.chapter, by: 'host' };
  g.log.push(entry);
  if (kind === 'g' && a === 'correct') entry.hits = addFound(g, p.chapters[g.chapter - 1].keys);
  return { entry, ...advance(p, g) };
}

/** A friend host ticked or unticked a key clue of the current chapter. */
export function toggleFound(p, g, n, on) {
  if (!p.chapters[g.chapter - 1].keys.includes(n)) return { advanced: false, finished: false };
  if (on) addFound(g, [n]);
  else g.found = g.found.filter(x => x !== n);
  return advance(p, g);
}

export function openHint(p, g) {
  const ci = g.chapter - 1;
  if (g.phase !== 'play' || g.hints[ci] >= p.chapters[ci].hints.length) return false;
  g.hints[ci] += 1;
  return true;
}

export function skipChapter(p, g) {
  if (!g.skipped.includes(g.chapter)) g.skipped.push(g.chapter);
  addFound(g, p.chapters[g.chapter - 1].keys);
  return advance(p, g);
}

/** What the player may see right now: only opened scenes, only solved chapters' answers, only opened hints. */
export function puzzleView(p, g) {
  const ended = g.phase !== 'play';
  return {
    id: p.id, no: p.no, level: p.level, title: p.title, teaser: p.teaser, minutes: p.minutes, world: p.world,
    keyCount: p.keyList.length,
    chapters: p.chapters.map((c, ci) => {
      const open = ended || ci + 1 <= g.chapter;
      const cleared = ended || ci + 1 < g.chapter;
      return {
        title: open ? c.title : null,
        scene: open ? c.scene : [],
        question: open ? c.question : '',
        truth: cleared ? c.truth : [],
        keys: c.keys,
        hintCount: c.hints.length,
        hints: c.hints.slice(0, g.hints[ci]),
      };
    }),
    secret: ended ? p.secret : [],
    epilogue: ended ? p.epilogue : [],
  };
}

/** The friend host's secret note for the current chapter. */
export function hostNote(p, g) {
  const c = p.chapters[g.chapter - 1];
  return {
    chapter: g.chapter, truth: c.truth,
    keys: c.keys.map(n => ({ n, text: p.keyList[n - 1].text })),
    secret: p.secret,
  };
}

/** Game state as the client sees it (the log is the player's own, nothing hidden in it). */
export function gameView(g) {
  const { id, puzzleId, log, phase, chapter, found, hints, skipped, elapsed, result } = g;
  return { id, puzzleId, log, phase, chapter, found, hints, skipped, elapsed, result };
}
