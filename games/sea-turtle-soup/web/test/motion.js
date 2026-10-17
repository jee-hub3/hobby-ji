// 모션 테스트 (docs/MOTION.md). 실행: npm run test:motion   (자세한 성능 측정은 npm run motion:measure)
//   A. 원본과 아티팩트 사본, 웹 스크립트 태그, 두 화면의 공유 수정(4.4)
//   B. 아티팩트판 index.html (file://, 가짜 진행자): 오류 없이 불러옴, 플레이 CLS 켬 = 끔, reduced에서 transform·clip 0, 스위치, 음악 버튼·테마
//   C. 웹 서비스판: 가짜 Claude 서버 + wrangler dev에서 /motion.js, 오류 없음, 음악 버튼과 테마 버튼
// Playwright는 전역 설치본을 씁니다: PW=$(npm root -g)/playwright
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { extract } from '../tools/sync-modules.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ARTIFACT = path.resolve(ROOT, '..', 'index.html'), WEB = path.join(ROOT, 'public/index.html');
const SRC = fs.readFileSync(path.join(ROOT, 'public/motion.js'), 'utf8');
const OUT = path.join(ROOT, 'test/.out-motion');
const STUB_PORT = 8793, APP_PORT = 8796, BASE = `http://localhost:${APP_PORT}`;
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra !== '' ? ' — ' + extra : ''}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ONLY = process.env.MOTION_TEST_ONLY || '';

/* ============================================================== A. 정적 검사 */
function partA() {
  let ok = true; try { new vm.Script(SRC, { filename: 'motion.js' }); } catch (e) { ok = false; }
  check('A motion.js compiles', ok);
  check('A artifact: inlined motion script is byte-identical to public/motion.js (V9)', extract(fs.readFileSync(ARTIFACT, 'utf8'), 'motion') === SRC);
  const art = fs.readFileSync(ARTIFACT, 'utf8'), web = fs.readFileSync(WEB, 'utf8');
  check('A artifact: motion comes after music (4.1)', art.indexOf('<!-- music:end -->') >= 0 && art.indexOf('<!-- music:end -->') < art.indexOf('<!-- motion:start -->'));
  check('A web: <script src="/motion.js" defer> right after music.js', /<script src="\/music\.js" defer><\/script>\n<script src="\/motion\.js" defer><\/script>/.test(web));
  const shared = [
    ['S1', '.pending .msg-out .bubble { animation: sendIn .28s var(--ease-out) both; transform-origin: 100% 100%; }'],
    ['S2', 'box-shadow: inset 0 0 0 1px var(--host-edge); }\n.hint-open p'],
    ['S3', "var(--lamp-bright)); }\n.topbar:has(.clock.over)"],
    ['S4', '@keyframes panelIn { from { opacity: 0; } }'],
    ['S5', '.entry-chapter.fresh .dv-body { animation: fadeIn .24s .4s var(--ease-out) both; }'],
    ['E2', "const far = d => d > 1.5 * window.innerHeight;"],
    ['E3', "|| document.documentElement.classList.contains('m-reduce');"],
    ['E4', "const far = Math.abs(el.getBoundingClientRect().top) > 1.5 * window.innerHeight;"],
    ['E4', "behavior: reduce || far ? 'auto' : 'smooth' });"],
  ];
  for (const [id, s] of shared) check(`A shared edit ${id} is in both pages`, art.includes(s) && web.includes(s));
  check('A shared edit E1: morphFromTyping is gone from both pages', !art.includes('morphFromTyping') && !web.includes('morphFromTyping'));
  const gz = zlib.gzipSync(SRC, { level: 9 }).length;
  const css = SRC.slice(SRC.indexOf('const CSS = `') + 13, SRC.indexOf('`.replace(/~/g'));
  check('A motion.js within the 4.5 budget (40,960 B source, 15,360 B CSS, 14,336 B gzip)', Buffer.byteLength(SRC) <= 40960 && Buffer.byteLength(css) <= 15360 && gz <= 14336, `${Buffer.byteLength(SRC)} B, CSS ${Buffer.byteLength(css)} B, gzip ${gz} B`);
}

/* ============================================================== 페이지 공통 */
const SPY = () => { // AudioContext 스파이: 테마 버튼 클릭도 음악 모듈의 오디오 잠금 해제(document 캡처)에 닿는지
  const AC = window.AudioContext;
  window.__ac = { made: 0, madeIn: null };
  if (!AC) return;
  window.AudioContext = class extends AC { constructor(o) { super(o); window.__ac.made++; window.__ac.madeIn = window.event ? window.event.type : null; } };
};
const HOST_STUB = () => {
  const fake = async () => ({});
  fake.json = async prompt => {
    await new Promise(r => setTimeout(r, 250));
    const body = (prompt.match(/"""([\s\S]*?)"""/) || [, ''])[1];
    if (prompt.includes('[플레이어의 추리]')) { const sec = prompt.split(/\[\d+장의 핵심 단서\]/)[1] || ''; return { matched: [...sec.split('[')[0].matchAll(/^(\d+)\./gm)].map(x => +x[1]), comment: '맞아요.' }; }
    const hits = [...body.matchAll(/#(\d+)/g)].map(x => +x[1]);
    return { answer: hits.length ? 'yes' : 'no', note: '', hits };
  };
  window.claude = { use: async name => (name === 'sample' ? fake : null) };
};
const OBSERVE = () => { // 레이아웃 이동과 애니메이션 표본
  const M = window.__mt = { shifts: [], anims: [], seen: new WeakSet() };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => M.shifts.push({ v: e.value, input: e.hadRecentInput, t: e.startTime }))).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* unsupported */ }
  setInterval(() => { for (const a of document.getAnimations()) { if (M.seen.has(a)) continue; M.seen.add(a); const ef = a.effect; if (!ef || !ef.target) continue; const props = [...new Set(ef.getKeyframes().flatMap(k => Object.keys(k)))].filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)); M.anims.push({ kind: a.constructor.name, name: a.animationName || '', props, dur: ef.getTiming().duration, inf: ef.getTiming().iterations === Infinity, cls: ef.target.className && ef.target.className.baseVal !== undefined ? ef.target.className.baseVal : String(ef.target.className) }); } }, 40);
};
async function context(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1280, height: 900 }, colorScheme: o.scheme || 'light', reducedMotion: o.reduce ? 'reduce' : 'no-preference' });
  if (o.mode) await ctx.addInitScript(m => { window.STS_MOTION = m; }, o.mode);
  await ctx.addInitScript(SPY); if (!o.web) await ctx.addInitScript(HOST_STUB); await ctx.addInitScript(OBSERVE);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/fonts\.g|status of [45]\d\d/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  return { ctx, page, errors };
}
const ask = async (page, t) => { await page.fill('#q-input', t); await page.press('#q-input', 'Enter'); await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 15000 }); await sleep(250); };
async function play(page, data) { // 열기 → 질문 → 1장 해금 → 힌트 → 추리로 2장 해금 → 남은 장을 넘겨 리빌 → 닫기. CLS 창은 여는 순간부터 리빌 직전까지
  const fid = await page.getAttribute('.dish-featured', 'data-id'), p0 = data.find(x => x.id === fid);
  await page.evaluate(() => { window.__mt.from = performance.now(); });
  await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])'); await sleep(500);
  await ask(page, '이 일은 사고였나요?');
  for (let n = 1; n <= p0.chapters[0].keys.length; n++) await ask(page, `질문 #${n}`);
  await sleep(1000);
  const hb = await page.$('.hint-btn:not([disabled])'); if (hb) { await hb.click(); await sleep(600); }
  await page.click('#tab-guess'); await page.fill('#q-input', '추리'); await page.click('#send-btn');
  await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 15000 }); await sleep(1000);
  for (let i = 0; i < 6 && !(await page.isVisible('#reveal')); i++) {
    if ((await page.textContent('#p-progress')).trim().startsWith(`${p0.chapters.length}장`)) await page.evaluate(() => { window.__mt.to = performance.now(); });
    await page.click('#skip-btn'); await page.click('#skip-yes'); await sleep(900);
  }
  await sleep(1200);
  await page.click('#rv-close'); await sleep(700);
  return page.evaluate(() => { const M = window.__mt; return { cls: M.shifts.filter(s => !s.input && s.t >= M.from && s.t <= (M.to || Infinity)).reduce((a, s) => a + s.v, 0), anims: M.anims }; });
}

/* ============================================================== B. 아티팩트판 */
async function partB(browser) {
  const url = 'file://' + ARTIFACT;
  // B1 불러오기
  let s = await context(browser);
  await s.page.goto(url); await s.page.waitForSelector('#menu-cols button'); await sleep(500);
  const st = await s.page.evaluate(() => ({ st: window.STSMotion && window.STSMotion.state(), on: document.documentElement.classList.contains('m-on'), css: !!document.getElementById('sts-motion-css'), wisps: document.querySelectorAll('.m-steam[aria-hidden="true"] .m-wisp').length, pref: (document.querySelector('#sec-footer .foot-reset .m-pref') || {}).outerHTML || '' }));
  check('B1 artifact: STSMotion loads, m-on, CSS injected once, no module errors', st.st && st.st.on && st.on && st.css && st.st.errors.length === 0, JSON.stringify(st.st && st.st.errors));
  check('B1 artifact: three steam wisps under an aria-hidden layer', st.wisps === 3);
  check('B1 artifact: 「화면 움직임 줄이기」 switch before #reset-btn, aria-pressed=false', /class="text-btn m-pref" aria-pressed="false"/.test(st.pref) && /화면 움직임 줄이기/.test(st.pref), st.pref.slice(0, 120));
  check('B1 artifact: webdriver → menu reveal and cover greeting stay off (1.9)', st.st && st.st.pre === 0 && !(await s.page.evaluate(() => document.documentElement.classList.contains('m-intro'))));
  const data = await s.page.evaluate(() => JSON.parse(document.getElementById('puzzle-data').textContent));
  // B2 플레이: CLS 켬 = 끔
  const on = await play(s.page, data);
  const stOn = await s.page.evaluate(() => window.STSMotion.state());
  check('B2 artifact: play-through fired answer, clue, chapter, hint, reveal moments', ['answer', 'clue', 'chapter', 'hint', 'reveal'].every(k => stOn.n[k] > 0), JSON.stringify(stOn.n));
  check('B2 artifact: motion callbacks stay under 2 ms (desktop)', Object.entries(stOn.max).filter(([k]) => k !== 'reveal').every(([, v]) => v <= 2), JSON.stringify(stOn.max));
  check('B2 artifact: no page or console errors with motion', s.errors.length === 0, s.errors.slice(0, 3).join(' | '));
  await s.ctx.close();
  s = await context(browser, { mode: 'off' });
  await s.page.goto(url); await s.page.waitForSelector('#menu-cols button'); await sleep(500);
  check("B2 artifact: STS_MOTION='off' leaves no trace", await s.page.evaluate(() => !window.STSMotion && !document.documentElement.classList.contains('m-on') && !document.getElementById('sts-motion-css')));
  const off = await play(s.page, data);
  await s.ctx.close();
  check('B2 artifact: motion adds no layout shift in play (V1)', on.cls - off.cls <= 0.0005, `on ${on.cls.toFixed(4)} / off ${off.cls.toFixed(4)}`);
  // B3 reduced: transform·clip 애니메이션 0, 남는 것은 opacity 160 ms 이하
  s = await context(browser, { reduce: true });
  await s.page.goto(url); await s.page.waitForSelector('#menu-cols button'); await sleep(300);
  const pr = await s.page.evaluate(() => { const b = document.querySelector('.m-pref'); return { reduce: document.documentElement.classList.contains('m-reduce'), pressed: b.getAttribute('aria-pressed'), disabled: b.getAttribute('aria-disabled') }; });
  check('B3 reduced: html.m-reduce, switch shows the device setting (aria-pressed + aria-disabled)', pr.reduce && pr.pressed === 'true' && pr.disabled === 'true', JSON.stringify(pr));
  const red = await play(s.page, data);
  const moved = red.anims.filter(a => a.props.some(p => /transform|translate|scale|rotate|clipPath/.test(p)) || a.inf);
  const left = red.anims.filter(a => !moved.includes(a));
  check('B3 reduced: zero animations with transform/translate/scale/rotate/clip-path, no infinite loops', moved.length === 0, moved.slice(0, 4).map(a => `${a.name}:${a.props}@${a.cls}`).join(' | '));
  check('B3 reduced: what remains is opacity-only, ≤ 160 ms', left.length > 0 && left.every(a => a.props.every(p => p === 'opacity') && a.dur <= 160), JSON.stringify(left.slice(0, 4)));
  check('B3 reduced: no View Transition, no holds', (await s.page.evaluate(() => window.STSMotion.state())).vt === 0);
  check('B3 reduced: no page errors', s.errors.length === 0, s.errors.slice(0, 3).join(' | '));
  await s.ctx.close();
  // B4 스위치 (OS 설정 없이)
  s = await context(browser);
  await s.page.goto(url); await s.page.waitForSelector('#menu-cols button'); await sleep(300);
  await s.page.click('.m-pref'); await sleep(200);
  const sw = await s.page.evaluate(() => ({ reduce: document.documentElement.classList.contains('m-reduce'), pressed: document.querySelector('.m-pref').getAttribute('aria-pressed'), loops: document.getAnimations().filter(a => a.effect.getTiming().iterations === Infinity && a.playState === 'running').length, saved: localStorage.getItem('sea-turtle-soup:motion') }));
  check('B4 switch: on → m-reduce, aria-pressed, cover loops stop, saved', sw.reduce && sw.pressed === 'true' && sw.loops === 0 && sw.saved === 'reduce', JSON.stringify(sw));
  await s.page.reload(); await s.page.waitForSelector('#menu-cols button');
  check('B4 switch: kept after reload', await s.page.evaluate(() => document.documentElement.classList.contains('m-reduce')));
  await s.page.click('.m-pref'); await s.page.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
  check('B4 switch: off again → key removed, cover loops run again', await s.page.evaluate(() => !document.documentElement.classList.contains('m-reduce') && localStorage.getItem('sea-turtle-soup:motion') === null && document.getAnimations().some(a => a.effect.getTiming().iterations === Infinity && a.playState === 'running')));
  await s.ctx.close();
  // B5 음악과 공존: 스피커 버튼, 테마 버튼(VT 안에서 다시 보낸 click), 첫 제스처가 테마 버튼이어도 음악이 잠금 해제됨
  s = await context(browser, { scheme: 'light' });
  await s.page.goto(url); await s.page.waitForSelector('.music-btn');
  const m0 = await s.page.evaluate(() => [...document.querySelectorAll('.music-btn')].map(b => !!(b.nextElementSibling && b.nextElementSibling.classList.contains('theme-btn'))));
  check('B5 music: two speaker buttons, each right before .theme-btn', m0.length === 2 && m0.every(Boolean), JSON.stringify(m0));
  await s.page.click('#menu-view .theme-btn');
  await s.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 3000 }).catch(() => {});
  await sleep(600);
  const th = await s.page.evaluate(() => ({ theme: document.documentElement.dataset.theme, label: document.querySelector('#menu-view .theme-btn').getAttribute('aria-label'), vt: window.STSMotion.state().vt, ac: window.__ac, hist: window.STSMusic && window.STSMusic.controller ? window.STSMusic.controller.history.map(h => h.kind + ':' + h.value) : [], swap: document.documentElement.classList.contains('m-swap') }));
  check('B5 theme: the click still reaches the game (dark theme, button label updated) through the View Transition', th.theme === 'dark' && th.label === '밝게 보기' && th.vt === 1 && !th.swap, JSON.stringify({ theme: th.theme, label: th.label, vt: th.vt }));
  check('B5 music: a theme-button click as the first gesture still unlocks audio (motion only stops propagation)', th.ac && th.ac.made === 1 && ['pointerdown', 'click'].includes(th.ac.madeIn), JSON.stringify(th.ac));
  check('B5 music: the music module hears the theme change', th.hist.includes('theme:night'), th.hist.join(' '));
  await s.page.click('#menu-view .music-btn'); await sleep(200);
  const mb = await s.page.evaluate(() => ({ pressed: [...document.querySelectorAll('.music-btn')].map(b => b.getAttribute('aria-pressed')), saved: localStorage.getItem('sea-turtle-soup:music'), theme: document.documentElement.dataset.theme, vt: window.STSMotion.state().vt }));
  check('B5 music: speaker toggles both buttons and saves off; motion leaves it alone (no VT, theme unchanged)', mb.pressed.every(x => x === 'false') && mb.saved === 'off' && mb.theme === 'dark' && mb.vt === 1, JSON.stringify(mb));
  await s.page.click('#menu-view .music-btn'); await sleep(200);
  check('B5 music: and back on', await s.page.evaluate(() => [...document.querySelectorAll('.music-btn')].every(b => b.getAttribute('aria-pressed') === 'true') && localStorage.getItem('sea-turtle-soup:music') === 'on'));
  await s.page.click('.dish-featured'); await s.page.waitForSelector('#play-view:not([hidden])'); await sleep(500);
  await s.page.click('#play-view .theme-btn'); await sleep(700);
  check('B5 theme: play-view button toggles back to light', await s.page.evaluate(() => document.documentElement.dataset.theme === 'light' && !document.documentElement.classList.contains('m-theme-vt')));
  check('B5 no page errors', s.errors.length === 0, s.errors.slice(0, 3).join(' | '));
  await s.ctx.close();
}

/* ============================================================== C. 웹 서비스판 */
async function partC(browser) {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const DEV_VARS = path.join(ROOT, '.dev.vars'), DEV_BAK = DEV_VARS + '.before-test';
  if (fs.existsSync(DEV_VARS) && !fs.existsSync(DEV_BAK)) fs.renameSync(DEV_VARS, DEV_BAK);
  process.on('exit', () => { try { fs.rmSync(DEV_VARS, { force: true }); if (fs.existsSync(DEV_BAK)) fs.renameSync(DEV_BAK, DEV_VARS); } catch (e) { /* best effort */ } });
  fs.writeFileSync(DEV_VARS, ['ANTHROPIC_API_KEY=sk-test-not-real', `ANTHROPIC_BASE_URL=http://127.0.0.1:${STUB_PORT}`, 'SESSION_SECRET=motion-session-secret-0123456789', 'AI_DEVICE_PER_MINUTE=1000', 'AI_DAILY_BUDGET_USD=5'].join('\n') + '\n');
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' }, procs = [];
  const run = (cmd, args, name) => { const p = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', fs.openSync(path.join(OUT, name + '.log'), 'w'), fs.openSync(path.join(OUT, name + '.log'), 'a')], detached: true }); procs.push(p); };
  const cleanup = () => { for (const p of procs) { try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { /* gone */ } } procs.length = 0; };
  process.on('exit', cleanup);
  try {
    execSync(`npx wrangler d1 migrations apply DB --local --persist-to ${path.join(OUT, 'state')}`, { cwd: ROOT, env, stdio: 'ignore' });
    run('node', ['test/stub-anthropic.js', String(STUB_PORT), path.join(OUT, 'stub.jsonl')], 'stub');
    run('npx', ['wrangler', 'dev', '--port', String(APP_PORT), '--ip', '127.0.0.1', '--persist-to', path.join(OUT, 'state'), '--show-interactive-dev-session=false'], 'wrangler');
    for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE + '/api/config')).ok) break; } catch (e) { /* not yet */ } await sleep(500); }
    const res = await fetch(BASE + '/motion.js');
    check('C web: /motion.js is served as JavaScript and matches public/motion.js', /javascript/.test(res.headers.get('content-type') || '') && (await res.text()) === SRC);
    const s = await context(browser, { web: true });
    await s.page.goto(BASE + '/'); await s.page.waitForSelector('#menu-cols button'); await s.page.waitForSelector('.music-btn'); await sleep(400);
    const st = await s.page.evaluate(() => window.STSMotion && window.STSMotion.state());
    check('C web: STSMotion loads with no module errors, after music (both globals)', st && st.on && st.errors.length === 0, JSON.stringify(st && st.errors));
    check('C web: speaker buttons still sit right before each .theme-btn', await s.page.evaluate(() => { const b = [...document.querySelectorAll('.music-btn')]; return b.length === 2 && b.every(x => x.nextElementSibling && x.nextElementSibling.classList.contains('theme-btn')) && !!window.STSMusic; }));
    await s.page.click('.dish-featured'); await s.page.waitForSelector('#play-view:not([hidden])'); await sleep(600);
    await ask(s.page, '단서 질문 #1');
    check('C web: an answer plays the answer moment', (await s.page.evaluate(() => window.STSMotion.state().n.answer)) >= 1);
    await s.page.click('#play-view .theme-btn'); await sleep(700);
    check('C web: theme button switches (dark)', await s.page.evaluate(() => document.documentElement.dataset.theme === 'dark'));
    await s.page.click('#play-view .music-btn'); await sleep(200);
    check('C web: speaker button turns music off and saves it', await s.page.evaluate(() => [...document.querySelectorAll('.music-btn')].every(b => b.getAttribute('aria-pressed') === 'false') && localStorage.getItem('sea-turtle-soup:music') === 'off'));
    await s.page.click('#back-btn'); await sleep(500);
    // P2-1 토스트: 들어올 때와 나갈 때 240 ms 전환, 나가는 동안에도 가로 가운데
    const toast = await s.page.evaluate(async () => {
      const t = document.getElementById('toast'), fr = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      t.textContent = '시험 안내'; t.hidden = false; await fr();
      const inT = t.getAnimations().map(a => a.transitionProperty).sort();
      t.hidden = true; await fr();
      const outT = t.getAnimations().map(a => a.transitionProperty).sort(), shown = getComputedStyle(t).display !== 'none';
      await new Promise(r => setTimeout(r, 400));
      return { inT, outT, shownWhileLeaving: shown, goneAfter: getComputedStyle(t).display === 'none' };
    });
    check('C web: toast fades and rises in and out over 240 ms, then leaves the layout (P2-1)', toast.inT.includes('opacity') && toast.inT.includes('transform') && toast.outT.includes('opacity') && toast.shownWhileLeaving && toast.goneAfter, JSON.stringify(toast));
    check('C web: no page or console errors', s.errors.length === 0, s.errors.slice(0, 3).join(' | '));
    await s.ctx.close();
  } finally { cleanup(); }
}

(async () => {
  if (!ONLY || ONLY.includes('A')) partA();
  const browser = await chromium.launch();
  try {
    if (!ONLY || ONLY.includes('B')) await partB(browser);
    if (!ONLY || ONLY.includes('C')) await partC(browser);
  } finally { await browser.close(); }
  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log(failed ? `MOTION TEST: ${failed} FAILED` : `MOTION TEST: ALL PASS (${results.filter(r => r.startsWith('PASS')).length})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('MOTION TEST CRASHED:', e); console.log(results.join('\n')); process.exit(1); });
