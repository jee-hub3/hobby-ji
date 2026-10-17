// 배경음악 오프라인 렌더: Playwright Chromium의 빈 페이지에 public/music.js를 올리고, 실서비스와 같은 Engine을
// OfflineAudioContext 위에서 돌려 WAV(44.1 kHz, 스테레오, 32비트 부동소수)로 저장한다. 설계: docs/MUSIC.md 5.1, 8.2, 8.5
//
//   node tools/render-music.js                  분석 묶음 + 미리듣기 묶음 전부
//   node tools/render-music.js --set analysis   분석 묶음만 (--set preview: 미리듣기만)
//   node tools/render-music.js --only bed-play  이름에 이 글자가 들어간 렌더만
//   옵션: --out <dir> (기본 music-out/), --jobs <n> (동시 렌더 수, 기본 3), --sr <Hz> (기본 44100)
//
// 결과: <out>/<name>.wav 와 <out>/manifest.json (렌더 조건, 렌더 시간, 결정성 확인값). analyze-music.py가 읽는다.
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const PW = process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright');
const { chromium } = require(PW);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'music-out')));
const SR = Number(arg('--sr', 44100));
const JOBS = Number(arg('--jobs', 3));
const SET = arg('--set', 'all');
const ONLY = arg('--only', '');
const LEVELS = arg('--levels') ? JSON.parse(arg('--levels')) : null; // 시험용 레벨 덮어쓰기, 예: --levels '{"keysBus":-26.4}'
const SRC = fs.readFileSync(path.join(ROOT, 'public/music.js'), 'utf8');

// ---- 렌더 목록 (MUSIC.md 5.1 렌더 조건, 8.2 지표, 8.5 미리듣기)
const R = [];
const add = (name, o) => R.push({ name, set: 'analysis', theme: 'night', seed: 1, fadeIn: 10, window: [10, o.duration], ...o });
for (const scene of ['menu', 'play']) for (const theme of ['night', 'day']) for (const seed of [1, 2, 3])
  add(`bed-${scene}-${theme}-s${seed}`, { kind: 'bed', scene, theme, seed, duration: 100, events: [{ t: 0, scene }] });
for (const scene of ['thinking', 'solved', 'gaveup']) for (const seed of [1, 2, 3])
  add(`bed-${scene}-night-s${seed}`, { kind: 'bed', scene, seed, duration: 100, events: [{ t: 0, scene }] });
for (const seed of [4, 5, 6, 7, 8]) // 9.7-12: 플레이 자정 바탕은 시드 8개 (건반 균형 B1의 중앙값, 바탕 검사 전부)
  add(`bed-play-night-s${seed}`, { kind: 'bed', scene: 'play', seed, duration: 100, events: [{ t: 0, scene: 'play' }] });
// 9.7-2: 바탕마다 건반만 뺀 쌍둥이. 느린 진폭 변조 M3는 패드 맥놀이를 보는 지표라 건반 음 하나하나의 부풂과 감쇠(그 자체가 0.3–3 Hz 출렁임)를 빼고 잰다
for (const { name, ...r } of R.filter(x => x.kind === 'bed')) add(name + '-nokeys', { ...r, kind: 'bedpad', levels: { keysBus: -300 } });
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) { // 장 해결은 시드 12개 (MUSIC.md 9.6). live: 실시간처럼 화성이 1.5초 앞까지 이미 만들어진 뒤 큐가 들어온다
  add(`cue-chapter-s${seed}`, { kind: 'cue', cue: 'chapter', seed, T: 40, duration: 75, events: [{ t: 0, scene: 'play' }, { t: 40, cue: 'chapter' }] });
  add(`cue-chapter-live-s${seed}`, { kind: 'cue', cue: 'chapter', live: true, lead: 1.5, seed, T: 40, duration: 75, events: [{ t: 0, scene: 'play' }, { t: 40, cue: 'chapter' }] });
}
for (const [cue, scene] of [['solved', 'solved'], ['gaveup', 'gaveup']]) for (const seed of [1, 2, 3])
  add(`cue-${cue}-s${seed}`, { kind: 'cue', cue, seed, T: 40, duration: 130, events: [{ t: 0, scene: 'play' }, { t: 40, scene, intro: true }] });
for (const seed of [1, 2, 3]) // 다시 열기: 완식(20 s) → 닫고 기록 보기(50 s) → 정답 다시 보기(100 s, 도입 없음)
  add(`cue-reopen-s${seed}`, { kind: 'cue', cue: 'reopen', seed, T: 100, duration: 130, events: [{ t: 0, scene: 'play' }, { t: 20, scene: 'solved', intro: true }, { t: 50, scene: 'play' }, { t: 100, scene: 'solved', intro: false }] });
add('x-menu-play', { kind: 'x', T: 40, duration: 75, events: [{ t: 0, scene: 'menu' }, { t: 40, scene: 'play' }] });
add('x-play-menu', { kind: 'x', T: 40, duration: 75, events: [{ t: 0, scene: 'play' }, { t: 40, scene: 'menu' }] });
add('x-night-day', { kind: 'x', T: 40, duration: 75, events: [{ t: 0, scene: 'play' }, { t: 40, theme: 'day' }] });
add('x-chapter-menu', { kind: 'x', T: 40, duration: 75, events: [{ t: 0, scene: 'play' }, { t: 40, cue: 'chapter' }, { t: 45, scene: 'menu' }] });
add('x-rapid', { kind: 'x', T: 40, duration: 75, events: [{ t: 0, scene: 'play' }, ...[40, 42, 44, 46, 48, 50].map((t, i) => ({ t, scene: i % 2 ? 'play' : 'menu' }))] });
for (const solo of ['pad', 'drone', 'keys', 'texture'])
  add(`solo-${solo}`, { kind: 'solo', solo, duration: 100, events: [{ t: 0, scene: 'play' }] });
for (const seed of [2, 3, 4, 5, 6, 7, 8]) add(`solo-keys-s${seed}`, { kind: 'solo', solo: 'keys', seed, duration: 100, events: [{ t: 0, scene: 'play' }] });

const P = (name, o) => R.push({ name, set: 'preview', kind: 'preview', theme: 'night', seed: 3, fadeIn: 2, window: [10, o.duration], ...o }); // 첫 화음 어택(6–8초) 뒤부터 잰다
P('01-메뉴-자정', { duration: 60, fadeIn: 10, events: [{ t: 0, scene: 'menu' }], note: '메뉴판, 자정. 시작 페이드인 10초 포함' });
P('02-풀이-자정', { duration: 60, events: [{ t: 0, scene: 'play' }], note: '풀이 화면(플레이), 자정' });
P('03-풀이-오후', { duration: 60, theme: 'day', events: [{ t: 0, scene: 'play' }], note: '풀이 화면, 오후(밝은 화면). 비 없음' });
P('04-장-해결', { duration: 45, T: 20, events: [{ t: 0, scene: 'play' }, { t: 20, cue: 'chapter' }], note: '플레이, 20초에 장 해결 숨결' });
P('05-결말-완식', { duration: 60, T: 15, events: [{ t: 0, scene: 'play' }, { t: 15, scene: 'solved', intro: true }], note: '플레이, 15초에 완식' });
P('06-결말-포기', { duration: 50, T: 15, events: [{ t: 0, scene: 'play' }, { t: 15, scene: 'gaveup', intro: true }], note: '플레이, 15초에 포기' });
P('07-한-판-5분', { duration: 300, fadeIn: 10, note: '0 메뉴판, 45 플레이, 생각 중 세 번, 140·200 장 해결, 240 완식, 285 메뉴판',
  events: [{ t: 0, scene: 'menu' }, { t: 45, scene: 'play' }, { t: 70, scene: 'thinking' }, { t: 76, scene: 'play' }, { t: 110, scene: 'thinking' }, { t: 114, scene: 'play' },
    { t: 140, cue: 'chapter' }, { t: 160, scene: 'thinking' }, { t: 167, scene: 'play' }, { t: 200, cue: 'chapter' }, { t: 240, scene: 'solved', intro: true }, { t: 285, scene: 'menu' }] });

const todo = R.filter(r => (SET === 'all' || r.set === SET) && (!ONLY || r.name.includes(ONLY)));

// ---- 페이지 안에서: 렌더하고 WAV로 묶어 내려받기
async function renderIn(page, r, file) {
  const cfg = { seed: r.seed, duration: r.duration, sampleRate: SR, theme: r.theme, fadeIn: r.fadeIn, solo: r.solo || null, events: r.events, levels: r.levels ? { ...LEVELS, ...r.levels } : LEVELS, lead: r.lead || 0 };
  const [dl, info] = await Promise.all([
    page.waitForEvent('download', { timeout: 600000 }),
    page.evaluate(async c => {
      const buf = await window.STSMusic.render(c), ms = window.STSMusic.render.lastMs;
      const n = buf.length, L = buf.getChannelData(0), Rr = buf.getChannelData(1);
      const data = new Float32Array(n * 2);
      let h = 2166136261 >>> 0;
      for (let i = 0; i < n; i++) { data[2 * i] = L[i]; data[2 * i + 1] = Rr[i]; }
      const u8 = new Uint8Array(data.buffer);
      for (let i = 0; i < u8.length; i += 7) h = Math.imul(h ^ u8[i], 16777619) >>> 0; // 결정성 확인용 FNV(7바이트 간격)
      const hd = new DataView(new ArrayBuffer(44)), w = (o, s) => { for (let i = 0; i < 4; i++) hd.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); hd.setUint32(4, 36 + u8.length, true); w(8, 'WAVE'); w(12, 'fmt '); hd.setUint32(16, 16, true);
      hd.setUint16(20, 3, true); hd.setUint16(22, 2, true); hd.setUint32(24, buf.sampleRate, true); hd.setUint32(28, buf.sampleRate * 8, true);
      hd.setUint16(32, 8, true); hd.setUint16(34, 32, true); w(36, 'data'); hd.setUint32(40, u8.length, true);
      const a = document.createElement('a');
      a.href = window.__u = URL.createObjectURL(new Blob([hd.buffer, u8], { type: 'audio/wav' })); a.download = 'x.wav';
      document.body.appendChild(a); a.click(); a.remove();
      const st = window.STSMusic.render.lastEngine.state;
      return { ms, hash: h.toString(16), frames: n, voicesAfter: st.voices };
    }, cfg),
  ]);
  await dl.saveAs(file);
  await page.evaluate(() => { URL.revokeObjectURL(window.__u); window.__u = null; document.querySelectorAll('a').forEach(a => a.remove()); }); // 9.7: WAV blob을 놓아 준다 (전에는 70개 렌더 동안 2 GB가 쌓여 saveAs가 취소됨)
  return info;
}
async function determinism(page) { // R2: 같은 시드·타임라인을 두 번 렌더해 비트 단위로 비교
  return page.evaluate(async sr => {
    const c = { seed: 1, duration: 30, sampleRate: sr, theme: 'night', fadeIn: 10, events: [{ t: 0, scene: 'play' }, { t: 12, cue: 'chapter' }] };
    const a = await window.STSMusic.render(c), b = await window.STSMusic.render(c), d = await window.STSMusic.render({ ...c, seed: 2 });
    let same = true, diff = false;
    for (let ch = 0; ch < 2; ch++) { const x = a.getChannelData(ch), y = b.getChannelData(ch), z = d.getChannelData(ch); for (let i = 0; i < x.length; i++) { if (x[i] !== y[i]) same = false; if (x[i] !== z[i]) diff = true; } }
    return { identical: same, seedsDiffer: diff };
  }, SR);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mfPath = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(mfPath) ? JSON.parse(fs.readFileSync(mfPath, 'utf8')) : { renders: {} };
  manifest.sampleRate = SR; manifest.levels = LEVELS; manifest.musicJsBytes = Buffer.byteLength(SRC); manifest.renderedAt = new Date().toISOString();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const pages = [];
  const load = async p => { await p.setContent('<!doctype html><meta charset="utf-8"><title>music render</title><body></body>'); await p.addScriptTag({ content: SRC }); p.used = 0; };
  for (let i = 0; i < Math.max(1, JOBS); i++) {
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
    await load(p);
    pages.push(p);
  }
  const t0 = Date.now(); let k = 0;
  const worker = async page => {
    while (k < todo.length) {
      if (page.used >= 20) await load(page); // 9.7: 20개마다 페이지를 새로 올려 렌더 힙을 비운다
      page.used++;
      const r = todo[k++], file = path.join(OUT, r.name + '.wav'), s = Date.now();
      const info = await renderIn(page, r, file);
      manifest.renders[r.name] = { ...r, file: path.basename(file), sampleRate: SR, renderMs: info.ms, hash: info.hash, frames: info.frames, voicesAfter: info.voicesAfter };
      console.log(`${r.name.padEnd(22)} ${String(r.duration).padStart(4)} s  render ${(info.ms / 1000).toFixed(1).padStart(5)} s  (${(r.duration / (info.ms / 1000)).toFixed(1)}x)  total ${((Date.now() - s) / 1000).toFixed(1)} s`);
    }
  };
  await Promise.all(pages.map(worker));
  if (SET !== 'preview' && !ONLY) { manifest.determinism = await determinism(pages[0]); console.log('determinism', JSON.stringify(manifest.determinism)); }
  const errs = pages.flatMap(p => p.errs);
  manifest.pageErrors = errs;
  fs.writeFileSync(mfPath, JSON.stringify(manifest, null, 1));
  await browser.close();
  console.log(`rendered ${todo.length} files in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${OUT}${errs.length ? '  PAGE ERRORS: ' + errs.join(' | ') : ''}`);
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('RENDER CRASHED:', e); process.exit(1); });
