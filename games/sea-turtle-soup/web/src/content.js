// 문제 데이터 정리. 원본 JSON(content/puzzles.json)은 서버에만 있고, 브라우저에는 공개해도 되는 부분만 나간다.

const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : []);
const objs = v => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []);

export const LEVELS = ['mild', 'medium', 'hot'];

/** Validate and number the raw puzzle array the same way the original single-file game did. */
export function normalizePuzzles(raw) {
  const list = (Array.isArray(raw) ? raw : []).filter(p =>
    p && typeof p.id === 'string' && Array.isArray(p.chapters) && p.chapters.length &&
    p.chapters.every(c => c && arr(c.scene).length && arr(c.truth).length && arr(c.keys).length));
  return list.map((p, i) => {
    const w = p.world && typeof p.world === 'object' ? p.world : {};
    let n = 0;
    const keyList = [];
    const chapters = p.chapters.map((c, ci) => {
      const keys = arr(c.keys).map(text => { const k = { n: ++n, ci, text }; keyList.push(k); return k.n; });
      return {
        title: String(c.title || `${ci + 1}장`), scene: arr(c.scene), question: String(c.question || ''),
        truth: arr(c.truth), keys, hints: arr(c.hints).slice(0, 3),
      };
    });
    const world = { intro: arr(w.intro), places: objs(w.places), people: objs(w.people), timeline: objs(w.timeline), glossary: objs(w.glossary) };
    return {
      id: p.id, no: String(i + 1).padStart(2, '0'),
      level: LEVELS.includes(p.level) ? p.level : 'medium',
      title: String(p.title || p.id), teaser: String(p.teaser || ''),
      minutes: Number(p.minutes) > 0 ? Number(p.minutes) : 60,
      world, secret: arr(p.secret), epilogue: arr(p.epilogue), chapters, keyList,
      // 결제를 붙일 때 쓰는 자리: 'free'면 누구나, 그 밖의 값은 구매한 사람만 연다(베타에서는 모두 free).
      access: typeof p.access === 'string' ? p.access : 'free',
    };
  });
}

export const hasWorld = p => !!(p.world.intro.length || p.world.places.length || p.world.people.length || p.world.timeline.length || p.world.glossary.length);

/** Menu entry: nothing that spoils the story beyond what the menu always showed. */
export function menuEntry(p) {
  return {
    id: p.id, no: p.no, level: p.level, title: p.title, teaser: p.teaser, minutes: p.minutes,
    keyCounts: p.chapters.map(c => c.keys.length), hasWorld: hasWorld(p), access: p.access,
  };
}
