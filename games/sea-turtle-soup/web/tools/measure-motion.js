// 모션 측정 (docs/MOTION.md 5절). 아티팩트판 index.html(file://)을 가짜 AI 진행자로 메뉴 → 그릇 열기 → 질문 → 장 해금 → 힌트 → 추리 → 리빌까지
// 1440×900(데스크톱)과 390×844(폰: DPR 3, 터치, CPU 4배 감속)에서 플레이하며 잽니다. 목표를 하나라도 못 넘으면 exit 1.
//   node tools/measure-motion.js                 전부 (폰 켬/끔 3번씩, 영상과 프레임 띠 포함, 약 20분)
//   node tools/measure-motion.js --quick         한 번씩, 31초 무입력 검사와 영상 생략
//   node tools/measure-motion.js --guards        2차 검토 회귀 검사(V11 클릭·V16 포커스·V17–V19)만, 약 1분
//   옵션: --runs N (폰 반복 수) · --no-video · --only desk|phone · --puzzle <id> (기본 photo-studio) · --page <index.html>
// 결과: motion-out/report.json, motion-out/video/*.webm, motion-out/strips/*.png (ffmpeg fps=8 타일)
// Playwright는 전역 설치본을 씁니다: PW=$(npm root -g)/playwright
import { execSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { extract } from './sync-modules.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, flag = k => argv.includes(k);
const GUARDS = flag('--guards'), QUICK = flag('--quick'), VIDEO = !flag('--no-video') && !QUICK, ONLY = opt('--only', ''), RUNS = +opt('--runs', QUICK ? 1 : 3);
const PAGE = path.resolve(opt('--page', path.resolve(ROOT, '..', 'index.html'))), PAGE_URL = 'file://' + PAGE, PUZZLE = opt('--puzzle', 'photo-studio');
const OUT = path.join(ROOT, 'motion-out'), VID = path.join(OUT, 'video'), STRIPS = path.join(OUT, 'strips');
for (const d of [OUT, VID, STRIPS]) fs.mkdirSync(d, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const r2 = x => (typeof x === 'number' && isFinite(x) ? Math.round(x * 100) / 100 : x);
const log = (...a) => console.log(...a);

const HTML = fs.readFileSync(PAGE, 'utf8');
const DATA = JSON.parse(HTML.slice(HTML.indexOf('id="puzzle-data">') + 17, HTML.indexOf(']</script>', HTML.indexOf('id="puzzle-data">')) + 1));
const PIDX = Math.max(0, DATA.findIndex(p => p.id === PUZZLE)), PZ = DATA[PIDX];
const LINES = (() => { const pre = HTML.slice(0, HTML.indexOf('<!-- motion:start -->')).split('\n').length; return [pre, pre + HTML.slice(HTML.indexOf('<!-- motion:start -->'), HTML.indexOf('<!-- motion:end -->')).split('\n').length]; })();
const LONG = '#ch-scene, #ch-question-text, #ch-truth-body, #world-body, .hint-open p, .dv-body, .rv-section .story, .rules-body'; // 1.2

const PROFILES = {
  desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light', cpu: 4 },
};

/* ------------------------------------------------------------------ 페이지에 넣는 것 */
const HOST_STUB = ms => { // 가짜 AI 진행자: "#N"은 단서 N, 추리는 그 장의 단서를 모두 맞힘. 답은 ms 뒤
  const fake = async () => ({});
  fake.json = async prompt => {
    await new Promise(r => setTimeout(r, ms));
    const body = (prompt.match(/"""([\s\S]*?)"""/) || [, ''])[1];
    if (prompt.includes('[플레이어의 추리]')) { const sec = prompt.split(/\[\d+장의 핵심 단서\]/)[1] || ''; return { matched: [...sec.split('[')[0].matchAll(/^(\d+)\./gm)].map(x => +x[1]), comment: '핵심을 정확히 짚었어요.' }; }
    const hits = [...body.matchAll(/#(\d+)/g)].map(x => +x[1]);
    return { answer: hits.length ? 'yes' : (body.length % 2 ? 'no' : 'irrelevant'), note: '', hits };
  };
  window.claude = { use: async name => (name === 'sample' ? fake : null) };
};
const DEVICE_WIDTH = () => { // 아티팩트는 claude.ai의 iframe(기기 폭) 안에서 돌아 viewport meta가 없습니다. 맨 위 문서로 모바일 흉내를 내면 980 px로 배치되므로 iframe처럼 기기 폭을 줍니다
  const add = () => { if (!document.head || document.querySelector('meta[name=viewport]')) return !!document.head; const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1'; document.head.prepend(m); return true; };
  if (!add()) { const o = new MutationObserver(() => { if (add()) o.disconnect(); }); o.observe(document, { childList: true, subtree: true }); }
};
const DATE_SHIFT = ([idx, n]) => { // 오늘의 추천을 고정: (날짜 번호 mod n) = idx
  const RD = Date, dayOf = t => { const d = new RD(t); return Math.floor(RD.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); };
  const off = ((idx - (dayOf(RD.now()) % n)) + n) % n * 86400000;
  class SD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
  window.Date = SD;
};
const INSTR = cfg => { // 측정기: layout-shift, longtask, measure, 애니메이션 표본(V6·V8), rAF 창(V12), 접근성 감시(V16)
  const M = window.__m = { shifts: [], long: [], measures: [], anims: [], maxLong: 0, cls: {}, wins: [], vt: [], a11y: [], marks: {}, sampling: false, e3: [] };
  const po = (type, f) => { try { new PerformanceObserver(l => l.getEntries().forEach(f)).observe({ type, buffered: true }); } catch (e) { /* unsupported */ } };
  po('layout-shift', e => M.shifts.push({ v: e.value, input: e.hadRecentInput, t: e.startTime }));
  po('longtask', e => M.long.push({ t: e.startTime, d: e.duration }));
  po('measure', e => { if (e.name.startsWith('sts-motion:')) M.measures.push({ n: e.name.slice(11), t: e.startTime, d: e.duration }); });
  if (document.startViewTransition) {
    const o = document.startViewTransition.bind(document);
    document.startViewTransition = cb => { const rec = { t0: performance.now(), frames: [] }; M.vt.push(rec); const vt = o(cb); let go = true; const f = t => { rec.frames.push(t); if (go) requestAnimationFrame(f); }; requestAnimationFrame(f); vt.ready.then(() => { rec.tr = performance.now(); }, () => {}); vt.finished.then(() => { rec.t1 = performance.now(); rec.last = rec.frames.filter(x => x < rec.t1).pop(); go = false; }); return vt; };
  }
  const sel = e => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + [...e.classList].map(c => '.' + c).join('');
  const hash = e => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const inView = e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.height > 0; };
  const shown = e => (e.checkVisibility ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : e.getClientRects().length > 0) && !e.closest('.m-hold,.m-pre') && inView(e); // 화면에 보이던 글만 '이미 본 글'
  const kinds = cfg.long.split(',').map(s => s.trim()), kind = e => kinds.find(k => e.matches(k)) || '?', key = e => kind(e) + '|' + hash(e);
  const ids = new WeakMap(); let nid = 0, prev = new Set();
  const tick = () => {
    const longs = [...document.querySelectorAll(cfg.long)].filter(e => e.getClientRects().length);
    const vis = new Set(longs.filter(e => shown(e) && hash(e)).map(key));
    let onLong = 0;
    for (const a of document.getAnimations()) {
      const ef = a.effect, t = ef && ef.target;
      if (!t || !(t instanceof Element)) continue;
      const pe = ef.pseudoElement || '', inv = pe ? [] : (t.closest(cfg.long) ? [t.closest(cfg.long)] : longs.filter(l => t.contains(l)));
      if (inv.length && a.playState === 'running') onLong++;
      if (ids.has(a)) continue;
      ids.set(a, ++nid);
      const tm = ef.getTiming(), props = [...new Set(ef.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))))];
      const hs = inv.filter(hash).map(key);
      M.anims.push({ kind: a.constructor.name, name: a.animationName || a.transitionProperty || '', sel: sel(t), pe, props, dur: tm.duration, delay: tm.delay, iter: tm.iterations, t: performance.now(), long: inv.length > 0, replay: hs.some(h => prev.has(h)), inf: tm.iterations === Infinity });
    }
    M.maxLong = Math.max(M.maxLong, onLong);
    for (const c of ['m-pre', 'm-hold', 'm-wait', 'm-lit']) M.cls[c] = Math.max(M.cls[c] || 0, document.getElementsByClassName(c).length);
    prev = vis;
  };
  setInterval(() => { if (M.sampling) tick(); }, 50);
  M.tick = tick;
  // V12: 순간마다 1.4초 rAF 간격. 트리거는 페이지 안에서 바로 봅니다(답 도착, 장 해금, 힌트, 리빌, 화면 진입)
  let raf = false; const ts = [];
  const loop = t => { ts.push(t); if (M.wins.some(w => !w.done)) requestAnimationFrame(loop); else raf = false; };
  M.win = label => { if (!cfg.wins) return; const w = { label, t0: performance.now(), done: false }; M.wins.push(w); setTimeout(() => { w.done = true; w.iv = []; let p = null; for (const x of ts) if (x >= w.t0 && x <= w.t0 + 1400) { if (p != null) w.iv.push(x - p); p = x; } }, 1450); if (!raf) { raf = true; requestAnimationFrame(loop); } };
  addEventListener('DOMContentLoaded', () => {
    const $ = s => document.querySelector(s), log = $('#log');
    if (!log) return;
    let had = false, nch = 0;
    new MutationObserver(() => {
      const p = !!log.querySelector(':scope>.pending');
      if (had && !p) { const ch = log.querySelector(':scope>.entry-chapter.fresh:last-of-type'); M.win(ch ? 'chapter' : log.querySelector(':scope>.fresh .entry-hit') ? 'clue' : 'answer'); }
      had = p;
      // E3 (V8 스위치 경로): 장 해금 직후 왼쪽 패널 스크롤이 즉시인지
      const c = log.querySelectorAll(':scope>.entry-chapter').length, grew = c > nch; nch = c;
      if (grew && log.querySelector(':scope>.entry-chapter.fresh')) { const cl = $('#col-left'), s0 = cl.scrollTop, rv = !$('#reveal').hidden; requestAnimationFrame(() => requestAnimationFrame(() => M.e3.push({ before: s0, after: cl.scrollTop, rv }))); }
    }).observe(log, { childList: true });
    const hidOf = (el, label) => el && new MutationObserver(() => { if (!el.hidden) M.win(label); }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    hidOf($('#reveal'), 'reveal'); hidOf($('#play-view'), 'enter'); hidOf($('#menu-view'), 'enter-menu');
    const hl = $('#hint-list'); let hn = 0;
    if (hl) new MutationObserver(() => { const n = hl.querySelectorAll('.hint-open').length; if (n > hn) M.win('hint'); hn = n; }).observe(hl, { childList: true });
  });
  // V16: motion.js 줄 범위에서 부른 접근성 관련 변경과 포커스
  if (cfg.spy) {
    const [a, b] = cfg.lines;
    const fromMotion = () => { const m = (new Error().stack || '').split('\n').map(l => l.match(/index\.html:(\d+):\d+/)).find(Boolean); return !!m && +m[1] >= a && +m[1] <= b; };
    const rec = (op, el, name) => { if (fromMotion()) M.a11y.push({ op, name: name || '', sel: el && el.nodeType === 1 ? sel(el) : String(el && el.nodeName), pref: !!(el && el.classList && el.classList.contains('m-pref')) }); };
    const SENS = /^(hidden|inert|role|tabindex|aria-)/i;
    for (const m of ['setAttribute', 'removeAttribute', 'toggleAttribute']) { const o = Element.prototype[m]; Element.prototype[m] = function (n, ...r) { if (SENS.test(n)) rec(m, this, n); return o.call(this, n, ...r); }; }
    const fo = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function (...r) { rec('focus', this); return fo.apply(this, r); };
    const prop = (proto, p) => { const d = Object.getOwnPropertyDescriptor(proto, p); if (d && d.set) Object.defineProperty(proto, p, { ...d, set(v) { rec('set ' + p, this); return d.set.call(this, v); } }); };
    prop(HTMLElement.prototype, 'hidden'); prop(HTMLElement.prototype, 'inert'); prop(HTMLElement.prototype, 'tabIndex'); prop(Node.prototype, 'textContent'); prop(Element.prototype, 'innerHTML');
    const ia = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (w, h) { if (fromMotion()) M.a11y.push({ op: 'insertAdjacentHTML', name: /^<\w+[^>]*aria-hidden="true"/.test(h) ? 'aria-hidden' : 'NO aria-hidden', sel: sel(this) }); return ia.call(this, w, h); };
  }
  M.mark = (i, label) => { M.marks[label] = performance.now(); let b = document.getElementById('__mk'); if (!b) { b = document.createElement('div'); b.id = '__mk'; b.setAttribute('aria-hidden', 'true'); b.style.cssText = 'position:fixed;left:0;top:0;width:16px;height:16px;z-index:2147483647;pointer-events:none'; document.documentElement.appendChild(b); } b.style.background = `rgb(${(i % 8) * 32 + 16},${Math.floor(i / 8) * 32 + 16},128)`; };
};

async function open(browser, profName, o = {}) {
  const prof = PROFILES[profName], ctxOpt = { viewport: o.viewport || prof.viewport, deviceScaleFactor: prof.deviceScaleFactor, colorScheme: o.scheme || prof.colorScheme };
  if (prof.isMobile && !o.fine) Object.assign(ctxOpt, { isMobile: true, hasTouch: true });
  if (o.reduce) ctxOpt.reducedMotion = 'reduce';
  if (o.video) ctxOpt.recordVideo = { dir: VID, size: ctxOpt.viewport };
  const ctx = await browser.newContext(ctxOpt);
  await ctx.addInitScript(HOST_STUB, o.stubMs || 700);
  await ctx.addInitScript(DATE_SHIFT, [PIDX, DATA.length]);
  if (prof.isMobile) await ctx.addInitScript(DEVICE_WIDTH);
  await ctx.addInitScript(INSTR, { long: LONG, spy: !!o.spy, lines: LINES, wins: !!o.wins });
  if (o.mode) await ctx.addInitScript(m => { window.STS_MOTION = m; }, o.mode);
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (prof.cpu && !o.noThrottle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
  const t0 = Date.now(); let mi = 0; const marks = [];
  const mark = async label => { mi++; marks.push({ i: mi, label, t: (Date.now() - t0) / 1000 }); await page.evaluate(([i, l]) => window.__m && window.__m.mark(i, l), [mi, label]).catch(() => {}); };
  return { ctx, page, cdp, errors, mark, marks, prof: profName };
}
const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const dmet = (a, b) => ({ layout: b.LayoutCount - a.LayoutCount, style: b.RecalcStyleCount - a.RecalcStyleCount, taskMs: (b.TaskDuration - a.TaskDuration) * 1000, layoutMs: (b.LayoutDuration - a.LayoutDuration) * 1000, styleMs: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000 });
const rafFor = (page, ms) => page.evaluate(ms => new Promise(res => { const ts = []; const t0 = performance.now(); const f = t => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); }), ms);
const ivs = ts => ts.slice(1).map((t, i) => t - ts[i]);
const ambient = (page, within = '.cover') => page.evaluate(w => document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest(w)).map(a => a.playState), within);
const ask = async (page, text) => { await page.fill('#q-input', text); await page.press('#q-input', 'Enter'); await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 20000 }); };
const progress = page => page.textContent('#p-progress');

/* ------------------------------------------------------------------ 시나리오: 메뉴 → 열기 → 질문 → 장 해금 → 힌트 → 추리 → 리빌 */
async function scenario(s, o = {}) {
  const { page, mark } = s, desk = s.prof === 'desk', W = () => sleep(o.video ? 1 : 0);
  const R = { hint7: null };
  await page.goto(PAGE_URL);
  await page.waitForSelector('#menu-cols button');
  if (o.sample) await page.evaluate(() => { window.__m.sampling = true; });
  await mark('cover'); await sleep(o.video ? 4000 : 1200);
  if (o.pref) { // V8 스위치 경로: 메뉴 푸터의 「화면 움직임 줄이기」를 켬
    await page.click('.m-pref'); await sleep(200);
    await page.evaluate(() => { const M = window.__m; M.anims.length = 0; M.cls = {}; M.maxLong = 0; });
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  }
  await mark('menu-scroll');
  for (let i = 0; i < (desk ? 12 : 16); i++) { await page.mouse.move(200, 300); await page.mouse.wheel(0, desk ? 320 : 360); await sleep(140); }
  await sleep(700);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(700); await W();
  await page.evaluate(() => { window.__m.playFrom = performance.now(); });
  await mark('open'); await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])'); await sleep(1500);
  await mark('ask'); await ask(page, '이 일은 사고였나요?'); await sleep(1300);
  const k1 = PZ.chapters[0].keys.length;
  for (let n = 1; n <= k1; n++) {
    if (n === k1 && desk) await page.evaluate(() => { const c = document.getElementById('col-left'); c.scrollTop = Math.min(500, c.scrollHeight); }); // E3 검사용: 왼쪽 패널을 내려 둠
    await mark(n === k1 ? 'chapter' : 'key' + n); await ask(page, `그 일과 관련 있나요? #${n}`); await sleep(n === k1 ? 2200 : 1300);
    if (n === 1 && k1 > 1) { await mark('meter'); await page.evaluate(() => document.getElementById('clue-dots').scrollIntoView({ block: 'center' })); await sleep(1400); } // 미뤄 둔 미터가 보일 때 재생
  }
  if (!desk) { // 폰: "새 장면 보기"(P0-7 ⓑ, E2)
    await mark('newscene'); const go = await page.$('#log .entry-chapter:last-of-type .dv-go-top'); if (go) await go.click(); await sleep(1600);
  }
  // 힌트 둘 (V7: 힌트 1 상자가 힌트 2를 여는 동안 그대로인지)
  const hb = () => page.$('.hint-btn:not([disabled])');
  await mark('hint1'); let b = await hb(); if (b) { await b.scrollIntoViewIfNeeded(); await sleep(300); await b.click(); } await sleep(1000);
  await mark('hint2'); b = await hb();
  if (b) {
    const box = await page.evaluate(() => { const e = document.querySelector('.hint-open'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.floor(r.left) - 2, y: Math.floor(r.top) - 2, width: Math.ceil(r.width) + 4, height: Math.ceil(r.height) + 4 }; });
    await b.click();
    if (box && o.v7) { const shots = []; for (let i = 0; i < 10; i++) { shots.push((await page.screenshot({ clip: box })).toString('base64')); await sleep(50); } R.hint7 = new Set(shots).size; }
  }
  await sleep(1200);
  // 세계관 문서(P1-10): 열었다가 닫음
  if (await page.isVisible('#world')) { await mark('world'); await page.click('#world summary'); await sleep(900); await page.click('#world summary'); await sleep(400); }
  // 추리로 2장 해금
  await mark('guess'); await page.click('#tab-guess'); await page.fill('#q-input', '그는 원판을 지키려고 불 속에 다시 들어갔다.'); await page.click('#send-btn');
  await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 20000 }); await sleep(2200);
  // 장 탭: 앞 장 보기 → 돌아오기 (P1-5 안착, P2-6 크로스페이드)
  await mark('tabs'); const tabs = await page.$$('#ch-tabs .ch-tab:not([disabled])');
  if (tabs.length > 1) { await tabs[0].scrollIntoViewIfNeeded(); await tabs[0].click(); await sleep(700); await (await page.$$('#ch-tabs .ch-tab:not([disabled])')).slice(-1)[0].click(); await sleep(700); }
  // 넘기기 확인창(P1-10)
  await mark('confirm'); await page.click('#skip-btn'); await sleep(600); await page.click('#skip-no'); await sleep(400);
  if (desk) { await mark('theme-play'); await page.click('#play-view .theme-btn'); await sleep(900); await page.click('#play-view .theme-btn'); await sleep(900); }
  // 남은 장을 넘겨 리빌
  for (let i = 0; i < 6 && !(await page.isVisible('#reveal')); i++) {
    const last = (await progress(page)).trim().startsWith(`${PZ.chapters.length}장`);
    await page.click('#skip-btn'); await sleep(250);
    if (last) { await page.evaluate(() => { window.__m.playTo = performance.now(); }); await mark('reveal'); }
    await page.click('#skip-yes'); await sleep(last ? 2600 : 1000);
  }
  await mark('rv-bye'); await page.evaluate(() => { const s = document.getElementById('rv-scroll'); s.scrollTop = s.scrollHeight; }); await sleep(1600);
  await mark('rv-close'); await page.click('#rv-close'); await sleep(1300);
  await mark('reopen'); await page.click('#reopen-btn'); await sleep(1000); await page.click('#rv-close'); await sleep(700);
  await mark('back'); await page.click('#back-btn'); await sleep(1000);
  if (desk) { await mark('theme-menu'); await page.click('#menu-view .theme-btn'); await sleep(900); }
  await page.evaluate(() => { window.__m.sampling = false; });
  const m = await page.evaluate(() => { const M = window.__m; return { shifts: M.shifts, long: M.long, measures: M.measures, anims: M.anims, maxLong: M.maxLong, cls: M.cls, marks: M.marks, wins: M.wins.filter(w => w.iv), a11y: M.a11y, vt: M.vt.map(v => ({ d: v.t1 - v.t0, frames: v.frames })), from: M.playFrom, to: M.playTo, e3: M.e3, st: window.STSMotion ? window.STSMotion.state() : null }; });
  return { ...m, ...R };
}
const playCls = m => { const e = m.shifts.filter(x => !x.input && x.t >= m.from && x.t <= (m.to || Infinity)); let bursts = 0; for (let i = 1; i < e.length; i++) if (e[i].t - e[i - 1].t <= 20 && (i < 2 || e[i - 1].t - e[i - 2].t > 20)) bursts++; return { cls: e.reduce((a, x) => a + x.v, 0), n: e.length, bursts }; };
const ownIn = (m, l) => m.measures.reduce((a, x) => a + Math.max(0, Math.min(x.t + x.d, l.t + l.d) - Math.max(x.t, l.t)), 0); // 긴 작업 안의 모션 콜백 몫
const attributable = m => m.long.filter(l => { const own = m.measures.reduce((a, x) => a + Math.max(0, Math.min(x.t + x.d, l.t + l.d) - Math.max(x.t, l.t)), 0); return own > 0 && l.d - own < 50; }).length; // 모션 몫을 빼면 50 ms 아래로 내려가는 긴 작업

/* ------------------------------------------------------------------ 표지 앰비언트(V3, V3s, V4, V13) */
async function coverBench(browser, prof, mode) {
  const s = await open(browser, prof, { mode });
  const { page, cdp } = s, R = {};
  await page.goto(PAGE_URL); await page.waitForSelector('#menu-cols button'); await sleep(1500);
  await page.evaluate(() => { window.__rafCalls = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = f => { window.__rafCalls++; return o.call(window, f); }; });
  let a = await metrics(cdp); await sleep(5000); R.idle = dmet(a, await metrics(cdp)); // ⓐ 가만히(rAF 없이)
  R.jsRaf = await page.evaluate(() => window.__rafCalls);
  a = await metrics(cdp); const f1 = await rafFor(page, 3000); const on = dmet(a, await metrics(cdp)); on.frames = f1.length; on.iv = ivs(f1); R.busy = on; // ⓑ 프레임 생성 중
  R.willChange = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getClientRects().length && getComputedStyle(e).willChange !== 'auto').length);
  if (mode !== 'off') {
    await page.evaluate(() => { const s = document.createElement('style'); s.id = '__floor'; s.textContent = '*,*::before,*::after{animation-play-state:paused!important}'; document.head.appendChild(s); });
    a = await metrics(cdp); const f2 = await rafFor(page, 3000); const fl = dmet(a, await metrics(cdp)); fl.frames = f2.length; fl.iv = ivs(f2); R.floor = fl;
    await page.evaluate(() => document.getElementById('__floor').remove());
    await sleep(300);
  }
  // V3s 스크롤 중 정지: 표지가 보이는 범위에서 2초 오르내림
  await page.evaluate(() => { window.__ps = []; window.__psOn = true; const t = () => { if (!window.__psOn) return; window.__ps.push(document.documentElement.classList.contains('m-scrolling') ? 'S' : '-'); window.__ps.push(...document.getAnimations().filter(x => x.effect.getTiming().iterations === Infinity && x.effect.target.closest('.cover')).map(x => x.playState)); setTimeout(t, 50); }; t(); });
  await page.evaluate(() => { const M = window.__rs = { last: 0, off: [] }; addEventListener('scroll', () => { M.last = performance.now(); }, { passive: true }); let was = false; new MutationObserver(() => { const on = document.documentElement.classList.contains('m-scrolling'); if (was && !on) M.off.push(performance.now() - M.last); was = on; }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); }); // [2차] 다시 도는 시각은 마지막 scroll 이벤트(화면이 멈춘 때)부터
  a = await metrics(cdp);
  const fr = page.evaluate(ms => new Promise(res => { let n = 0; const t0 = performance.now(); const f = t => { n++; if (t - t0 < ms) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }), 2000);
  const t0 = Date.now();
  if (PROFILES[prof].isMobile) { // 터치 스와이프: 손가락으로 160 px씩 오르내림 (synthesizeScrollGesture의 touch는 헤드리스에서 스크롤하지 않음)
    let dir = 1; const T = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y == null ? [] : [{ x: 195, y }] });
    while (Date.now() - t0 < 2000) { const y0 = dir > 0 ? 600 : 440; await T('touchStart', y0); for (let i = 1; i <= 8; i++) { await T('touchMove', y0 - dir * i * 20); await sleep(16); } await T('touchEnd'); dir = -dir; }
  }
  else { let dir = 1; await page.mouse.move(700, 450); while (Date.now() - t0 < 2000) { await page.mouse.wheel(0, 90 * dir); await sleep(70); dir = -dir; } }
  const frames = await fr, sc = dmet(a, await metrics(cdp));
  R.scroll = { taskPerFrame: sc.taskMs / Math.max(1, frames), frames };
  const ps = await page.evaluate(() => { window.__psOn = false; return window.__ps; });
  R.scroll.pausedShare = (() => { // m-scrolling이 붙은 표본에서 앰비언트가 모두 멈췄는지
    let sAll = 0, sPaused = 0, cur = null, buf = [];
    const flush = () => { if (cur === 'S' && buf.length) { sAll++; if (buf.every(x => x === 'paused')) sPaused++; } buf = []; };
    for (const x of ps) { if (x === 'S' || x === '-') { flush(); cur = x; } else buf.push(x); }
    flush(); return sAll ? sPaused / sAll : null;
  })();
  const tr = Date.now(); let resumed = null;
  for (let i = 0; i < 60; i++) { const st = await ambient(page); if (st.length && st.every(x => x === 'running')) { resumed = Date.now() - tr; break; } await sleep(16); }
  R.scroll.pollMs = resumed; // 손가락을 뗀 뒤부터 폴링으로 본 값(관성 스크롤과 4배 감속 폴링 지연 포함, 참고용)
  R.scroll.resumeMs = resumed === null ? null : await page.evaluate(() => { const o = window.__rs.off; return o.length ? Math.round(o[o.length - 1]) : null; });
  if (mode !== 'off') {
    // V4 화면 밖 · 탭 숨김 · 무입력
    await page.evaluate(() => window.scrollTo(0, document.getElementById('sec-menu').offsetTop)); await sleep(1500); // 메뉴 리빌 전환이 끝난 뒤
    R.offscreen = { states: await page.evaluate(() => document.getAnimations().filter(x => x.effect.getTiming().iterations === Infinity && x.effect.target.closest('.cover')).map(x => x.playState)) };
    a = await metrics(cdp); await sleep(5000); R.offscreen.layout = dmet(a, await metrics(cdp)).layout;
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
    const vis = h => page.evaluate(hd => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hd }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hd ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, h);
    await vis(true); await sleep(200);
    R.hidden = { states: await ambient(page) };
    a = await metrics(cdp); await sleep(2000); R.hidden.layout = dmet(a, await metrics(cdp)).layout;
    await vis(false); await sleep(200);
    if (!QUICK && prof === 'desk') {
      await sleep(31000);
      R.idleStop = { cls: await page.evaluate(() => document.querySelector('.cover').classList.contains('m-idle')), states: await ambient(page) };
      await page.mouse.click(5, 400); await sleep(150);
      R.idleStop.after = await ambient(page);
    }
  }
  R.errors = s.errors;
  await s.ctx.close();
  return R;
}

/* 플레이 대기(V5, V13) */
async function playIdle(browser, prof, mode = 'force') {
  const s = await open(browser, prof, { mode }), { page, cdp } = s;
  await page.goto(PAGE_URL); await page.waitForSelector('#menu-cols button'); await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])'); await sleep(1500);
  const a = await metrics(cdp); await sleep(5000); const d = dmet(a, await metrics(cdp));
  d.infinite = await page.evaluate(() => document.getAnimations().filter(x => x.effect && x.effect.getTiming().iterations === Infinity).map(x => x.animationName || 'waapi'));
  d.willChange = await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getClientRects().length && getComputedStyle(e).willChange !== 'auto').map(e => e.className.baseVal ?? e.className));
  await s.ctx.close();
  return d;
}

/* V12 화면 진입 창 더하기: 표지에서 오늘의 추천을 열고 1.4초 rAF 간격, 켬·끔 번갈아 */
async function enterBench(browser, prof, n) {
  const R = { force: [], off: [] };
  for (let i = 0; i < n; i++) for (const mode of ['force', 'off']) {
    const s = await open(browser, prof, { mode }), { page } = s;
    await page.goto(PAGE_URL); await page.waitForSelector('#menu-cols button'); await sleep(2500);
    await page.evaluate(() => { const pv = document.getElementById('play-view'); window.__iv = null; new MutationObserver((r, o) => { if (pv.hidden) return; o.disconnect(); const ts = [], t0 = performance.now(); const f = t => { ts.push(t); if (t - t0 < 1400) requestAnimationFrame(f); else window.__iv = ts.slice(1).map((x, k) => x - ts[k]); }; requestAnimationFrame(f); }).observe(pv, { attributes: true, attributeFilter: ['hidden'] }); });
    await page.click('.dish-featured');
    await page.waitForFunction(() => window.__iv, null, { timeout: 15000 });
    R[mode].push(await page.evaluate(() => window.__iv));
    await s.ctx.close();
  }
  return R;
}

/* 테마 전환(V11, V11-p) */
async function theme(browser, prof, fine) {
  const s = await open(browser, prof, { mode: 'force', fine }), { page } = s, out = [];
  await page.goto(PAGE_URL); await page.waitForSelector('#menu-cols button'); await sleep(800);
  const one = async (where) => {
    const before = await page.evaluate(() => window.__m.vt.length);
    const tr = page.evaluate(() => new Promise(res => { const ts = []; const t0 = performance.now(); let tr = 0; const f = t => { ts.push(t); tr = Math.max(tr, document.getAnimations().filter(a => a.constructor.name === 'CSSTransition' && !a.effect.target.closest('.theme-btn')).length); if (t - t0 < 700) requestAnimationFrame(f); else res({ ts, tr }); }; requestAnimationFrame(f); }));
    await page.click(`${where} .theme-btn`);
    const { ts, tr: trans } = await tr; await sleep(200);
    const v = await page.evaluate(n => { const x = window.__m.vt[n]; return x ? { d: x.t1 - x.t0, vis: (x.last || x.t1) - (x.tr || x.t0), iv: x.frames.slice(1).map((t, i) => t - x.frames[i]) } : null; }, before);
    out.push({ where, vt: v, transitions: trans, iv: ivs(ts) });
  };
  for (let i = 0; i < 3; i++) await one('#menu-view');
  await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])'); await sleep(1000);
  for (let i = 0; i < 3; i++) await one('#play-view');
  // VT 중 pointerdown → skipTransition
  let skip = null;
  if (!PROFILES[prof].isMobile || fine) {
    await page.click('#play-view .theme-btn'); await sleep(40);
    const t = await page.evaluate(() => performance.now()); await page.mouse.click(3, 400);
    await sleep(300);
    skip = await page.evaluate(t => { const x = window.__m.vt[window.__m.vt.length - 1]; return x && x.t1 ? x.t1 - t : null; }, t);
  }
  const errs = s.errors; await s.ctx.close();
  return { runs: out, skip, errors: errs };
}

/* 스위치(V14) · 눌림 차단(V15) */
async function switchCheck(browser) {
  const R = {};
  let s = await open(browser, 'desk', { mode: 'force' });
  await s.page.goto(PAGE_URL); await s.page.waitForSelector('#menu-cols button');
  await s.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(600);
  await s.page.click('.foot-notes p', { position: { x: 4, y: 4 } });
  let found = false;
  for (let i = 0; i < 12 && !found; i++) { await s.page.keyboard.press('Tab'); found = await s.page.evaluate(() => document.activeElement && document.activeElement.classList.contains('m-pref')); }
  if (found) await s.page.keyboard.press('Space');
  await sleep(200);
  R.on = await s.page.evaluate(() => ({ pressed: document.querySelector('.m-pref').getAttribute('aria-pressed'), reduce: document.documentElement.classList.contains('m-reduce'), running: document.getAnimations().filter(a => a.effect.getTiming().iterations === Infinity && a.playState === 'running').length, saved: localStorage.getItem('sea-turtle-soup:motion') }));
  R.tab = found;
  await s.page.reload(); await s.page.waitForSelector('#menu-cols button'); await sleep(300);
  R.reload = await s.page.evaluate(() => ({ pressed: document.querySelector('.m-pref').getAttribute('aria-pressed'), reduce: document.documentElement.classList.contains('m-reduce') }));
  R.errors = s.errors; await s.ctx.close();
  s = await open(browser, 'desk', { mode: 'force', init: () => { const t = () => { throw new Error('blocked'); }; Object.defineProperty(window, 'localStorage', { configurable: true, get: t }); Object.defineProperty(window, 'sessionStorage', { configurable: true, get: t }); } });
  await s.page.goto(PAGE_URL); await s.page.waitForSelector('#menu-cols button'); await s.page.click('.m-pref'); await sleep(200);
  R.blocked = { reduce: await s.page.evaluate(() => document.documentElement.classList.contains('m-reduce')), errors: s.errors.filter(e => !/blocked/.test(e)) };
  await s.ctx.close();
  s = await open(browser, 'desk', { mode: 'force', reduce: true });
  await s.page.goto(PAGE_URL); await s.page.waitForSelector('#menu-cols button');
  R.os = await s.page.evaluate(() => { const b = document.querySelector('.m-pref'); return { pressed: b.getAttribute('aria-pressed'), disabled: b.getAttribute('aria-disabled'), title: b.title }; });
  await s.ctx.close();
  // V15 ① 메뉴 리빌 숨김 중: 아래 8% 띠에 걸린 오늘의 추천 카드를 누름
  s = await open(browser, 'desk', { mode: 'force' });
  await s.page.goto(PAGE_URL); await s.page.waitForSelector('#menu-cols button'); await sleep(500);
  const y = await s.page.evaluate(() => { const c = document.querySelector('.dish-featured'); const top = c.getBoundingClientRect().top + scrollY; window.scrollTo(0, top - innerHeight * 0.95); return { pre: c.classList.contains('m-pre') }; });
  await sleep(500);
  const pt = await s.page.evaluate(() => { const c = document.querySelector('.dish-featured'), r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20, pre: c.classList.contains('m-pre'), band: r.top > innerHeight * 0.92 && r.top < innerHeight }; });
  await s.page.mouse.click(pt.x, pt.y); await sleep(400);
  R.v15menu = { prepared: y.pre && pt.pre && pt.band, opened: await s.page.isVisible('#play-view'), revealed: await s.page.evaluate(() => !document.querySelector('.dish-featured').classList.contains('m-pre')) };
  await s.ctx.close();
  // V15 ② 장 넘김 보류 중: 힌트 버튼 자리를 누름 (도구 카드가 화면에 들어오게 키 큰 창)
  s = await open(browser, 'desk', { mode: 'force', viewport: { width: 1440, height: 2200 } });
  await s.page.goto(PAGE_URL); await s.page.waitForSelector('#menu-cols button'); await s.page.click('.dish-featured'); await s.page.waitForSelector('#play-view:not([hidden])'); await sleep(600);
  const k1 = PZ.chapters[0].keys.length;
  for (let n = 1; n < k1; n++) await ask(s.page, `#${n}`);
  await s.page.fill('#q-input', `#${k1}`); await s.page.press('#q-input', 'Enter');
  await s.page.waitForFunction(() => document.querySelector('.m-hold'), null, { timeout: 10000 });
  const hp = await s.page.evaluate(() => { const b = document.querySelector('.hint-btn:not([disabled])'), r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inView: r.top > 0 && r.bottom < innerHeight, held: !!b.closest('.m-hold') }; });
  await s.page.mouse.click(hp.x, hp.y); await sleep(300);
  R.v15hold = { prepared: hp.inView && hp.held, hintsOpened: await s.page.evaluate(() => document.querySelectorAll('.hint-open').length), holds: await s.page.evaluate(() => document.querySelectorAll('.m-hold').length) };
  await s.ctx.close();
  return R;
}

/* 2차 검토 회귀 검사: V11 VT 중 클릭, V16 포커스, V17 보이던 글·카운터 숨김 0, V18 표시 순서, V19 긴 스크롤(E4) */
const NOTE_STUB = () => { // "노트"가 든 질문에는 메모가 붙은 답
  const v = window.claude;
  window.claude = { use: async n => { const f = await v.use(n); if (!f) return f; const g = async (...a) => f(...a); g.json = async p => { const r = await f.json(p); if (r && r.answer && /노트/.test(p)) r.note = '사진관 주인과 관련이 있어요. 조금 더 좁혀 보세요.'; return r; }; return g; } };
};
const ARM = () => { // 다음 답이 도착한 그 마이크로태스크(모션 관찰자 뒤)에 새 li와 목표·미터·탭의 애니메이션을 멈추고 시각을 옮겨 가며 읽음
  window.__arm = null;
  const log = document.getElementById('log'); let armed = false;
  const o = new MutationObserver(() => {
    if (log.querySelector(':scope>.pending')) { armed = true; return; }
    if (!armed) return;
    o.disconnect();
    const R = window.__arm = { rows: [], rings: [], goal: [], count: [] };
    let as = [];
    try {
      const li = [...log.querySelectorAll(':scope>.fresh')].filter(x => x.querySelector('.reply-bubble')).pop(), b = li && li.querySelector('.reply-bubble');
      const goal = document.getElementById('goal'), dots = document.getElementById('clue-dots'), cnt = document.getElementById('clue-count'), tabs = document.getElementById('ch-tabs');
      as = [li, goal, dots, cnt, tabs].filter(Boolean).flatMap(e => e.getAnimations({ subtree: true }));
      as.forEach(a => a.pause());
      const at = t => as.forEach(a => { a.currentTime = t; });
      // 링: 제 지연 1 ms 전에 보이면 안 됨
      for (const a of as.filter(x => ['m-hex-ring', 'm-hex-ring-soft', 'm-ring'].includes(x.animationName))) {
        const d = a.effect.getTiming().delay; a.currentTime = Math.max(0, d - 1);
        R.rings.push({ name: a.animationName, on: (a.effect.target.id ? '#' + a.effect.target.id : '.' + [...a.effect.target.classList][0]) + a.effect.pseudoElement, delay: d, op: +getComputedStyle(a.effect.target, a.effect.pseudoElement).opacity });
      }
      // 답 말풍선: 줄이 클립에서 다 드러났을 때 그 줄 내용의 불투명도
      if (b && b.classList.contains('m-morph')) {
        const br = b.getBoundingClientRect(), H = br.height;
        const len = (v, d) => { v = v.trim(); const c = v.match(/^calc\((.*)\)$/); if (c) return c[1].replace(/ - /g, ' + -').split(/\s+\+\s+/).reduce((s, x) => s + (x.endsWith('%') ? parseFloat(x) / 100 * d : parseFloat(x)), 0); return v.endsWith('%') ? parseFloat(v) / 100 * d : parseFloat(v); };
        const toks = s => { const o2 = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ' ' && d === 0) { if (cur) o2.push(cur); cur = ''; } else cur += ch; } if (cur) o2.push(cur); return o2; };
        const rows = [...b.children].map(c => ({ c, r: c.getBoundingClientRect() })).filter(x => x.r.height > 0 && !x.c.classList.contains('stamp'));
        for (let t = 0; t <= 480; t += 10) {
          at(t); const m = getComputedStyle(b).clipPath.match(/^inset\((.*)\)$/); let bottom = H;
          if (m) { const tk = toks(m[1].split(' round ')[0]); bottom = H - len(tk.length >= 3 ? tk[2] : tk[0], H); }
          rows.forEach(x => { if (x.r.bottom - br.top <= bottom + 0.5) R.rows.push({ t, cls: x.c.className, op: +getComputedStyle(x.c).opacity }); });
        }
      }
      // 목표 숫자·아이콘, 폰 카운트: 시각별 불투명도
      const gb = goal && goal.querySelector('.roll b');
      for (let t = 0; t <= 1200; t += 20) {
        at(t);
        if (gb && goal.classList.contains('m-up')) R.goal.push({ t, digit: +getComputedStyle(gb).opacity, icon: +getComputedStyle(goal, '::before').opacity });
        if (cnt && cnt.classList.contains('m-tick')) R.count.push({ t, op: +getComputedStyle(cnt).opacity });
      }
    } catch (e) { R.err = String(e); }
    as.forEach(a => { a.currentTime = 0; a.play(); });
  });
  o.observe(log, { childList: true });
};
const sampleOp = (page, sels, ms) => page.evaluate(([sels, ms]) => new Promise(res => { // rAF마다 sels 중 가장 낮은 불투명도(조상 곱)
  const out = [], t0 = performance.now(), eff = e => { let op = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= +getComputedStyle(x).opacity; return op; };
  const f = () => { const t = performance.now() - t0, es = sels.flatMap(s => [...document.querySelectorAll(s)]); out.push([Math.round(t), es.length ? Math.min(...es.map(eff)) : null]); if (t < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), [sels, ms]);
async function guards(browser, prof) {
  const R = {}, desk = prof === 'desk';
  // ① 플레이: 답 말풍선 줄·링(V18), 목표 숫자·아이콘·폰 카운트(V17), 폰 첫 질문 스크롤(V19), 스크롤 없는 "N장 장면으로"(V17), 마지막 인사 점(V18)
  let s = await open(browser, prof, { mode: 'force', init: NOTE_STUB, noThrottle: true }), { page } = s;
  await page.goto(PAGE_URL); await page.waitForSelector('#menu-cols button'); await sleep(500);
  await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])'); await sleep(1200);
  const asked = async (q, arm = true) => { if (arm) await page.evaluate(ARM); await page.fill('#q-input', q); await page.press('#q-input', 'Enter'); await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 20000 }); await sleep(arm ? 300 : 0); return arm ? page.evaluate(() => window.__arm) : null; };
  if (!desk) { // V19: 장면 맨 위에서 첫 질문 → 게임 scrollToEntry
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    const sp = page.evaluate(() => new Promise(res => { const out = [], t0 = performance.now(); const f = () => { const t = performance.now() - t0; out.push(Math.round(scrollY)); if (t < 2000) requestAnimationFrame(f); else res({ ys: out, ih: innerHeight }); }; requestAnimationFrame(f); }));
    await page.fill('#q-input', '이 일은 사고였나요?'); await page.press('#q-input', 'Enter');
    const { ys, ih } = await sp, y0 = ys[0], y1 = ys[ys.length - 1];
    R.e4 = { from: y0, to: y1, ih, between: ys.filter(y => y !== y0 && y !== y1).length };
    await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 20000 }); await sleep(800);
    await page.evaluate(() => document.getElementById('clue-dots').scrollIntoView({ block: 'center' })); await sleep(400);
  }
  const k1 = PZ.chapters[0].keys.length, arms = [];
  arms.push(await asked('그 일과 관련 있나요? #1'));
  arms.push(await asked('노트 있는 답인가요?'));
  if (k1 > 2) arms.push(await asked('노트가 붙은 단서인가요? #2'));
  for (let n = 3; n < k1; n++) await asked(`#${n}`, false);
  if (desk) { arms.push(await asked(`마지막 단서 #${k1}`)); await sleep(2600); } else { await asked(`#${k1}`, false); await sleep(2600); }
  R.arms = arms;
  if (desk) { // V17: 이미 그 장면이고 스크롤이 없을 때 "N장 장면으로"
    const go = await page.$('#log .entry-chapter:last-of-type .dv-next .dv-go');
    R.goStill = { scrollTop: await page.evaluate(() => document.getElementById('col-left').scrollTop) };
    if (go) { await go.scrollIntoViewIfNeeded(); await sleep(600); const sp = sampleOp(page, ['#problem > *', '#problem'], 1000); await go.click(); const v = await sp; R.goStill.min = Math.min(...v.map(x => x[1])); R.goStill.n = v.length; }
  }
  // V18: 마지막 인사의 타이핑 점
  for (let i = 0; i < 8 && !(await page.isVisible('#reveal')); i++) { await page.click('#skip-btn'); await sleep(250); await page.click('#skip-yes'); await sleep(1000); }
  await sleep(2200);
  await page.evaluate(() => { const e = document.querySelector('#rv-body .rv-bye'), M = window.__bye = {}; if (e) new MutationObserver(() => { const t = performance.now(), d = e.querySelector('.m-dots'); if (d && M.add == null) M.add = t; if (M.add != null && M.wait == null && !e.classList.contains('m-wait')) M.wait = t; if (M.add != null && !d && M.gone == null) M.gone = t; }).observe(e, { childList: true, attributes: true, attributeFilter: ['class'] }); }); // 점이 생긴 때·기다림이 끝난 때·점이 사라진 때
  const bp = page.evaluate(() => new Promise(res => { const out = [], t0 = performance.now(); const f = () => { const t = performance.now() - t0, e = document.querySelector('.rv-bye'), d = e && e.querySelector('.m-dots'), p = e && e.querySelector(':scope>.bubble:not(.m-dots)'); out.push([Math.round(t), d ? +getComputedStyle(d).opacity : null, p ? +getComputedStyle(p).opacity : null, !!(e && e.classList.contains('m-wait'))]); if (t < 1300) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }));
  await page.evaluate(() => { const r = document.getElementById('rv-scroll'); r.scrollTop = r.scrollHeight; });
  const all = await bp, bs = all.filter(x => x[1] !== null && x[3]), i0 = all.findIndex(x => x[1] !== null);
  const bt = await page.evaluate(() => window.__bye);
  R.bye = { shownMs: bt.add != null && bt.wait != null ? Math.round(bt.wait - bt.add) : 0, fadeMs: bt.gone != null && bt.wait != null ? Math.round(bt.gone - bt.wait) : null, sampled: bs.length, minOp: bs.length ? Math.min(...bs.map(x => x[1])) : null, gaps: i0 < 0 ? -1 : all.slice(i0).filter(x => (x[1] === null || x[1] < 0.3) && x[2] < 0.3).length }; // 점(기다리는 동안 opacity 1) → 말풍선: 둘 다 0.3 아래인 프레임 0
  R.errors = s.errors; await s.ctx.close();
  // ② 메뉴: VT 중 클릭(V11, 데스크톱), Tab 포커스(V16)
  if (desk) {
    s = await open(browser, prof, { mode: 'force', scheme: 'light' }); ({ page } = s);
    await page.goto(PAGE_URL); await page.waitForSelector('.music-btn'); await sleep(600);
    const at = async sel => { const bb = await (await page.$(sel)).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
    const [tx, ty] = await at('#menu-view .theme-btn'), [mx, my] = await at('#menu-view .music-btn'), [sx, sy] = await at('#start-btn');
    const sp0 = await page.evaluate(() => document.querySelector('.music-btn').getAttribute('aria-pressed')), th0 = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.mouse.click(tx, ty); await sleep(120); await page.mouse.click(mx, my); await sleep(800);
    const vt = { speakerToggled: (await page.evaluate(() => document.querySelector('.music-btn').getAttribute('aria-pressed'))) !== sp0 };
    const th1 = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.mouse.click(tx, ty); await sleep(120); await page.mouse.click(tx, ty); await sleep(900);
    vt.doubleReturns = (await page.evaluate(() => document.documentElement.dataset.theme)) === th1 && th1 !== th0;
    await page.mouse.click(tx, ty); await sleep(150); await page.mouse.click(sx, sy); await sleep(1500);
    vt.startOpens = await page.isVisible('#play-view');
    R.vtClick = vt; R.errors = R.errors.concat(s.errors); await s.ctx.close();
  }
  s = await open(browser, prof, { mode: 'force' }); ({ page } = s);
  await page.goto(PAGE_URL); await page.waitForSelector('#menu-cols button'); await sleep(1500);
  await page.evaluate(() => { window.__ft = []; const f = () => { const e = document.activeElement; if (e && e !== document.body) { let op = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= +getComputedStyle(x).opacity; window.__ft.push([e, op]); } requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let i = 0; i < 22; i++) { await page.keyboard.press('Tab'); await sleep(60); }
  R.focus = await page.evaluate(() => { const by = new Map(); for (const [e, op] of window.__ft) by.set(e, Math.min(by.has(e) ? by.get(e) : 1, op)); return { stops: by.size, faint: [...by].filter(([, op]) => op < 0.99).map(([e, op]) => (e.className || e.tagName) + ':' + op.toFixed(2)) }; });
  R.pre = await page.evaluate(() => window.STSMotion.state().pre);
  R.errors = R.errors.concat(s.errors); await s.ctx.close();
  return R;
}

function guardChecks(g, prof) {
  const desk = prof === 'desk';
  const ar = g.arms.filter(Boolean), rows = ar.flatMap(x => x.rows), badRows = rows.filter(x => x.op < 0.3), rings = ar.flatMap(x => x.rings), goal = ar.flatMap(x => x.goal), count = ar.flatMap(x => x.count);
  check('V18', `${prof} 답 말풍선: 다 드러난 줄의 내용이 0.3 미만인 순간 0 (FS-05)`, rows.length > 0 && badRows.length === 0, `${rows.length} row·time samples, bad ${badRows.length} ${badRows.slice(0, 2).map(x => x.cls + '@' + x.t + ':' + x.op.toFixed(2)).join(' ')}`, '0');
  check('V18', `${prof} 링은 제 순간 전에 보이지 않음 (지연 −1 ms에 opacity 0)`, rings.length >= (desk ? 3 : 2) && rings.every(x => x.op === 0), rings.map(x => `${x.on}@${x.delay - 1}:${x.op}`).join(' '), 'all 0');
  if (desk) check('V17', 'desk 입력창 목표: 숫자와 아이콘이 모든 시각에 opacity 1', goal.length > 0 && goal.every(x => x.icon === 1 && x.digit === 1), `${goal.length} samples, icon min ${Math.min(...goal.map(x => x.icon))}, digit min ${Math.min(...goal.map(x => x.digit))}`, '1');
  else check('V17', 'phone 단서 카운트 틱: 모든 시각에 opacity 1', count.length > 0 && count.every(x => x.op === 1), `${count.length} samples, min ${count.length ? Math.min(...count.map(x => x.op)) : '-'}`, '1');
  if (desk) check('V17', 'desk 스크롤 없는 "N장 장면으로": #problem이 rAF마다 opacity ≥ 0.9', g.goStill && g.goStill.scrollTop < 2 && g.goStill.min >= 0.9, JSON.stringify(g.goStill), '≥ 0.9');
  else check('V19', 'phone 장면 맨 위에서 첫 질문: 1.5화면 넘는 게임 스크롤은 한 프레임에(E4)', g.e4 && (Math.abs(g.e4.to - g.e4.from) <= 1.5 * g.e4.ih || g.e4.between <= 1), JSON.stringify(g.e4), 'jump (≤ 1 in-between frame)');
  check('V18', `${prof} 마지막 인사: 타이핑 점이 480 ms 보이고(opacity 1) 말풍선까지 빈 프레임 0`, g.bye.shownMs >= 450 && g.bye.sampled > 0 && g.bye.minOp >= 0.99 && g.bye.gaps === 0, JSON.stringify(g.bye), 'dots ≥ 450 ms (480), opacity 1 while waiting, then no empty frame');
  if (desk) check('V11', 'desk VT 중 클릭이 삼켜지지 않음(스피커·두 번 누름·시작하기)', g.vtClick && g.vtClick.speakerToggled && g.vtClick.doubleReturns && g.vtClick.startOpens, JSON.stringify(g.vtClick), 'all reach their target');
  check('V16', `${prof} Tab 60 ms 간격: 투명한 메뉴 요소에 머문 포커스 0`, g.focus.stops >= 15 && g.focus.faint.length === 0, `${g.focus.stops} stops, faint ${g.focus.faint.length} ${g.focus.faint.slice(0, 3).join(' ')}`, '0');
  check('V10', `${prof} 회귀 검사 콘솔 오류 0`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ') || 0, '0');
}

/* ------------------------------------------------------------------ 영상 → 순간 → 프레임 띠 */
function videoMarks(file, marks) {
  const FPS = 25, raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `fps=${FPS},crop=8:8:4:4,scale=1:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const out = {};
  for (const m of marks) {
    const R = (m.i % 8) * 32 + 16, G = Math.floor(m.i / 8) * 32 + 16;
    for (let k = 0; k * 3 < raw.length; k++) { const r = raw[k * 3], g = raw[k * 3 + 1], b = raw[k * 3 + 2]; if (Math.abs(r - R) < 14 && Math.abs(g - G) < 14 && Math.abs(b - 128) < 22) { out[m.label] = k / FPS; break; } }
  }
  return out;
}
function strip(file, start, dur, png, width, cols, crop) {
  const n = Math.ceil(dur * 8), rows = Math.ceil(n / cols);
  const vf = ['fps=8', crop ? `crop=${crop}` : null, `scale=${width}:-2`, "drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6", `tile=${cols}x${rows}:padding=4:color=gray`].filter(Boolean).join(',');
  try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, start)), '-t', String(dur), '-i', file, '-vf', vf, '-frames:v', '1', png]); return true; } catch (e) { return false; }
}
const STRIPS_FOR = {
  desk: [['FS01-cover', 'cover', -0.1, 4, null], ['FS02-menu-scroll', 'menu-scroll', 0, 3, null], ['FS04-open', 'open', -0.1, 1, null], ['FS05-question', 'ask', 0, 1.6, '840:900:600:0'],
    ['FS06-clue', 'key1', 0, 2, '840:900:600:0'], ['FS06-meter', 'meter', 0, 1.4, '600:900:0:0'], ['FS09-chapter', 'chapter', 0.5, 2, null], ['FS07-hint2', 'hint2', -0.1, 1, '600:900:0:0'], ['FS08-world', 'world', -0.1, 0.8, '600:900:0:0'],
    ['FS11-tabs', 'tabs', 0, 1.6, '600:900:0:0'], ['FS13-confirm', 'confirm', 0, 0.6, '600:900:0:0'], ['FS12-theme-play', 'theme-play', -0.1, 1, null], ['FS14-reveal', 'reveal', 0.1, 1.6, null], ['FS20-reveal-bye', 'rv-bye', 0, 1.4, null],
    ['FS15-ended', 'rv-close', 0, 1, null], ['FS14-reopen', 'reopen', 0, 0.8, null], ['FS04-back', 'back', -0.1, 1, null], ['FS12-theme-menu', 'theme-menu', -0.1, 1, null]],
  phone: [['FS01-cover', 'cover', -0.1, 4, null], ['FS02-menu-scroll', 'menu-scroll', 0, 3, null], ['FS04-open', 'open', -0.1, 1, null], ['FS05-question', 'ask', 0, 1.6, null], ['FS06-clue', 'key1', 0, 2, null], ['FS06-meter', 'meter', 0, 1.4, null],
    ['FS09-chapter', 'chapter', 0.5, 2, null], ['FS10-new-scene', 'newscene', -0.1, 1.6, null], ['FS07-hint2', 'hint2', -0.1, 1, null], ['FS14-reveal', 'reveal', 0.1, 1.6, null], ['FS15-ended', 'rv-close', 0, 1, null]],
};

/* ------------------------------------------------------------------ 판정 */
const results = [], report = { page: PAGE, puzzle: PZ.id, at: new Date().toISOString() };
const check = (id, name, ok, value, target) => { results.push({ id, name, ok: !!ok, value, target }); log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name} — ${typeof value === 'string' ? value : JSON.stringify(value)} (target: ${target})`); };
const isX = a => (/\.reveal-card/.test(a.sel) && a.props.every(p => ['opacity', 'transform'].includes(p)) && a.dur <= 560) // X1
  || (/^#reveal\b/.test(a.sel) && a.props.every(p => p === 'opacity') && a.dur <= 320) // X1: 기존 스크림 fadeIn(P1-6 "유지")
  || (/\.entry-chapter/.test(a.sel) && a.props.every(p => p === 'clipPath') && a.dur <= 640) // X2
  || (/\.hint-open/.test(a.sel) && a.props.every(p => p === 'clipPath') && a.dur <= 320);
const v6 = m => { const bad = m.anims.filter(a => a.long && !((a.props.every(p => p === 'opacity') && a.dur <= 240) || isX(a))), rep = m.anims.filter(a => a.long && a.replay); return { onLong: m.anims.filter(a => a.long).length, maxConcurrent: m.maxLong, bad: bad.map(a => `${a.name}@${a.sel}:${a.props}/${a.dur}`), replays: rep.map(a => `${a.name}@${a.sel}`) }; };
const FOUR = /\.reply-bubble|\.hint-open|\.entry-chapter|\.reveal-card/;
const v8 = m => { const bad = m.anims.filter(a => a.props.some(p => /transform|translate|scale|rotate|clipPath/.test(p)) || a.inf || !(a.kind === 'Animation' && a.props.every(p => p === 'opacity') && a.dur <= 160 && FOUR.test(a.sel))); return { anims: m.anims.length, bad: bad.slice(0, 8).map(a => `${a.kind}:${a.name}@${a.sel}${a.pe}:${a.props}/${a.dur}`), nBad: bad.length, vt: m.vt.length, cls: m.cls, places: [...new Set(m.anims.map(a => (a.sel.match(FOUR) || ['?'])[0]))] }; };
const winStats = runs => { // 순간마다 모든 창의 간격을 모아 p95(16.7 ms 단위로 끊기는 값이라 창 하나의 p95는 한 프레임 차이로 출렁임), 33 ms 넘는 프레임은 창당 평균
  const by = {}; for (const m of runs) for (const w of m.wins) (by[w.label] = by[w.label] || []).push(w.iv);
  // [2차] p95는 창마다 내서 창들의 중앙값(5절의 중앙값 규칙). 모은 간격의 p95는 33 ms 넘는 프레임 수가 같아도 5% 경계에서 16.7 ms씩 뒤집힘(참고로 pooled에 남김)
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, long: r2(v.reduce((a, iv) => a + iv.filter(x => x > 33.4).length, 0) / v.length), p95: r2(med(v.map(iv => pct(iv, 0.95)))), pooled: r2(pct(v.flat(), 0.95)), max: r2(Math.max(...v.flat())), perWin: v.map(iv => iv.filter(x => x > 33.4).length) }]));
};

(async () => {
  const browser = await chromium.launch();
  const T0 = Date.now();
  try {
    // V9 크기 · 동일성
    const src = fs.readFileSync(path.join(ROOT, 'public/motion.js')), css = (() => { const s = src.toString(), a = s.indexOf('const CSS = `') + 13; return s.slice(a, s.indexOf('`.replace(/~/g', a)); })();
    report.size = { bytes: src.length, gzip: zlib.gzipSync(src, { level: 9 }).length, cssSource: Buffer.byteLength(css), identical: extract(HTML, 'motion') === src.toString() };
    check('V9', 'motion.js 40 KB 이하', report.size.bytes <= 40960, `${report.size.bytes} B`, '≤ 40960');
    check('V9', '주입 CSS(원본 안) 15 KB 이하', report.size.cssSource <= 15360, `${report.size.cssSource} B`, '≤ 15360');
    check('V9', 'gzip 14 KB 이하', report.size.gzip <= 14336, `${report.size.gzip} B`, '≤ 14336');
    check('V9', '아티팩트 사본이 원본과 바이트 동일', report.size.identical, report.size.identical, 'identical');

    if (GUARDS) for (const prof of ['desk', 'phone']) if (!ONLY || ONLY === prof) guardChecks((report[prof] = { guards: await guards(browser, prof) }).guards, prof);
    for (const prof of GUARDS ? [] : ['desk', 'phone']) {
      if (ONLY && ONLY !== prof) continue;
      const P = (report[prof] = {}), n = RUNS;
      log(`\n== ${prof} (${PROFILES[prof].viewport.width}×${PROFILES[prof].viewport.height}${PROFILES[prof].cpu ? ', CPU ×' + PROFILES[prof].cpu : ''})`);
      // 켬/끔 시나리오(V1, V2, V6, V12)
      const on = [], off = [];
      for (let i = 0; i < n; i++) {
        for (const [mode, arr] of [['force', on], ['off', off]]) {
          const s = await open(browser, prof, { mode, wins: true });
          const m = await scenario(s, {});
          m.errors = s.errors; arr.push(m); await s.ctx.close();
          log(`  run ${i + 1} ${mode}: CLS ${playCls(m).cls.toFixed(4)}, longtasks ${m.long.length}, anims ${m.anims.length}, errors ${s.errors.length}`);
        }
      }
      const cOn = on.map(playCls), cOff = off.map(playCls);
      P.cls = { on: cOn, off: cOff };
      const dC = med(cOn.map(x => x.cls)) - med(cOff.map(x => x.cls));
      check('V1', `${prof} 모션이 더하는 CLS (play)`, Math.abs(dC) <= 0.0005 || dC < 0, `on ${med(cOn.map(x => x.cls)).toFixed(4)} − off ${med(cOff.map(x => x.cls)).toFixed(4)} = ${dC.toFixed(4)}`, '0.000 ± 0.0005');
      check('V1', `${prof} 20 ms 이하 간격 이동 묶음 증가 0`, med(cOn.map(x => x.bursts)) <= med(cOff.map(x => x.bursts)), `on ${med(cOn.map(x => x.bursts))} / off ${med(cOff.map(x => x.bursts))}`, 'on ≤ off');
      // V2 범위는 시나리오(메뉴 스크롤 → 플레이 → 리빌). 페이지를 여는 동안은 웹 글꼴 조각(한글 unicode-range)이 하나씩 도착하며 문서 전체를 다시 배치해(모든 모드) 뺍니다
      const play = m => m.long.filter(l => l.t >= ((m.marks || {}).cover || 0)), tbt = m => play(m).reduce((a, l) => a + l.d - 50, 0);
      const lOn = med(on.map(m => play(m).length)), lOff = med(off.map(m => play(m).length)), att = Math.max(...on.map(attributable)), bOn = med(on.map(tbt)), bOff = med(off.map(tbt));
      const maxMeasure = Math.max(0, ...on.flatMap(m => m.measures.filter(x => x.n !== 'init').map(x => x.d))), init = med(on.map(m => m.st && m.st.init));
      const later1 = m => { const seen1 = new Set(); return m.measures.filter(x => x.n !== 'init' && (seen1.has(x.n) || !seen1.add(x.n))); }; // 모듈마다 첫 호출(첫 컴파일)을 뺀 나머지
      const maxLater = Math.max(0, ...on.flatMap(m => later1(m).map(x => x.d))), runMax = on.map(m => Math.max(0, ...later1(m).map(x => x.d))), medMax = med(runMax); // [2차] 실행마다 최대의 3회 중앙값(5절 중앙값 규칙): 한 번의 GC·VM 정지가 기준을 정하지 않게
      const all = {}; on.forEach(m => m.measures.forEach(x => (all[x.n] = all[x.n] || []).push(x.d)));
      const byMod = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, Math.max(...v)])), dist = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { n: v.length, p50: r2(pct(v, 0.5)), p95: r2(pct(v, 0.95)), max: r2(Math.max(...v)) }]));
      const near = m => m.long.map(l => ({ ...l, after: Object.entries(m.marks || {}).filter(([, t]) => t <= l.t).sort((a, b) => b[1] - a[1]).map(([k]) => k)[0] || 'load' }));
      P.long = { on: on.map(near), off: off.map(near), attributable: att, measures: dist, init, afterLoad: { on: lOn, off: lOff, blockingOn: bOn, blockingOff: bOff } };
      log(`  long tasks after load (menu scroll → play → reveal): on ${lOn} / off ${lOff}, blocking time (Σ over 50 ms) on ${r2(bOn)} / off ${r2(bOff)} ms; sts-motion measures (max ms): ${JSON.stringify(Object.fromEntries(Object.entries(byMod).map(([k, v]) => [k, r2(v)])))}`);
      // [2차] 긴 작업은 거의 다 게임 렌더(4배 감속 폰은 실행마다 약 20개)라 같은 모드끼리도 실행마다 몇 개씩 다릅니다. 켬 − 끔(중앙값)이 같은 모드 안의 실행 간 폭(최소 1)을 넘지 않고, 모션 몫은 0
      const cnt = arr => arr.map(m => play(m).length), spread = a => Math.max(...a) - Math.min(...a), cOnN = cnt(on), cOffN = cnt(off), tol = Math.max(1, spread(cOnN), spread(cOffN));
      check('V2', `${prof} 긴 작업 수 켬 − 끔 ≤ 실행 간 폭 (시나리오, 3회 중앙값)`, lOn - lOff <= tol, `on ${lOn} [${cOnN}] / off ${lOff} [${cOffN}], allowed +${tol}; blocking time on ${r2(bOn)} / off ${r2(bOff)} ms`, 'on − off ≤ run-to-run spread');
      // [2차] 4배 감속 폰에서 답·장면 렌더마다 모션 콜백이 합 1–4 ms 들어가, 50–53 ms짜리 게임 작업이 가끔 경계를 넘습니다(3회에 0–1개). 그 수(3회 합)와 긴 작업 시간 중 모션 몫을 함께 봄
      const attSum = on.reduce((a, m) => a + attributable(m), 0), ownSum = on.reduce((a, m) => a + m.long.reduce((b, l) => b + ownIn(m, l), 0), 0), longSum = on.reduce((a, m) => a + m.long.reduce((b, l) => b + l.d, 0), 0);
      check('V2', `${prof} 모션 몫 때문에 50 ms를 넘은 긴 작업(3회 합)과 긴 작업 시간 중 모션 몫`, attSum <= 1 && ownSum <= 0.02 * longSum, `${attSum} task(s); motion ${r2(ownSum)} of ${r2(longSum)} ms (${r2(100 * ownSum / Math.max(1, longSum))}%)`, '≤ 1, ≤ 2%');
      // [2차] p95는 표본 20개 이상인 모듈마다와 모든 콜백을 모아서. 표본이 적은 모듈(status·view·reveal)의 p95는 최댓값과 같아 최대 기준이 맡음
      const pooled = Object.entries(all).filter(([k]) => k !== 'init').flatMap(([, v]) => v), big = Object.entries(dist).filter(([k, x]) => k !== 'init' && x.n >= 20);
      check('V2', `${prof} sts-motion:* 콜백 p95 (표본 20개 이상인 모듈마다, 모두 모아서)`, big.every(([, x]) => x.p95 <= 2) && pct(pooled, 0.95) <= 2, big.map(([k, v]) => `${k} ${v.p95}`).join(', ') + ` ms; all ${r2(pct(pooled, 0.95))} ms (n=${pooled.length})`, '≤ 2 ms');
      check('V2', `${prof} sts-motion:* 콜백 최대 (모듈마다 첫 호출 제외, 실행마다 최대의 3회 중앙값)`, medMax <= 4, `${r2(medMax)} ms (per run ${runMax.map(r2).join(', ')}; overall ${r2(maxLater)}, with first calls ${r2(maxMeasure)} ms)`, '≤ 4 ms');
      check('V2', `${prof} sts-motion:init`, init <= (prof === 'phone' ? 16 : 8), `${r2(init)} ms`, prof === 'phone' ? '≤ 16 ms' : '≤ 8 ms (4.2)');
      // V6·V7: 표본기와 스크린숏은 비용이 있어 켬/끔 비교 실행과 따로 한 번
      const sa = await open(browser, prof, { mode: 'force' }); const audit = await scenario(sa, { sample: true, v7: prof === 'desk' }); audit.errors = sa.errors; await sa.ctx.close();
      const r6 = v6(audit); P.v6 = r6;
      check('V6', `${prof} 읽기 글 위 애니메이션: opacity만 ≤240 ms (X1·X2 예외)`, r6.bad.length === 0, `${r6.onLong} on reading text, max ${r6.maxConcurrent} at once, bad ${r6.bad.length} ${r6.bad.slice(0, 3).join(' ')}`, '0 bad');
      check('V6', `${prof} 이미 보이던 글에 다시 재생`, r6.replays.length === 0, r6.replays.slice(0, 4).join(' ') || 0, '0');
      if (prof === 'desk') check('V7', '힌트 2를 여는 동안 힌트 1 상자 10장이 같음', audit.hint7 === 1, `${audit.hint7} distinct`, '1');
      const eAll = [...on, ...off, audit].flatMap(m => m.errors);
      check('V10', `${prof} 콘솔 오류 0 (켬·끔)`, eAll.length === 0, eAll.slice(0, 3).join(' | ') || 0, '0');
      if (prof === 'phone') {
        const eb = await enterBench(browser, prof, QUICK ? 2 : 8), ew = iv => ({ wins: [{ label: 'enter', iv }] }); // [2차] 화면 진입은 시나리오에서 실행당 창 하나라(n=3) 따로 8번씩 더 잼
        const wOn = winStats(on.concat(eb.force.map(ew))), wOff = winStats(off.concat(eb.off.map(ew))); P.v12 = { on: wOn, off: wOff };
        for (const k of Object.keys(wOn)) { const a = wOn[k], b = wOff[k] || { long: 0, p95: 0 }; check('V12', `phone 히어로 프레임 ${k}`, a.long - b.long <= 1 && a.p95 - b.p95 <= 4, `>33 ms frames on ${a.long} / off ${b.long}, p95 (median of windows) on ${a.p95} / off ${b.p95} ms, pooled ${a.pooled} / ${b.pooled} (n=${a.n})`, 'Δ>33ms ≤ 1, Δp95 ≤ 4 ms'); }
      }
      // 표지 앰비언트(V3, V3s, V4, V13)
      const cb = await coverBench(browser, prof, 'force'), cbOff = await coverBench(browser, prof, 'off');
      P.cover = { on: cb, off: cbOff };
      const perF = (x) => x.taskMs / Math.max(1, x.frames);
      check('V3', `${prof} 표지 가만히: layout 0, style ≤ 2 (5초, rAF 없음)`, cb.idle.layout === 0 && cb.idle.style <= 2, `layout ${cb.idle.layout}, style ${cb.idle.style}, task ${r2(cb.idle.taskMs)} ms`, 'layout 0, style ≤ 2');
      check('V3', `${prof} 표지 JS rAF 루프 0`, cb.jsRaf === 0, cb.jsRaf, '0 calls in 5 s');
      check('V3', `${prof} 표지 프레임 생성 중: layout 켬 − 바닥 = 0`, cb.busy.layout - cb.floor.layout <= 0, `on ${cb.busy.layout} / floor ${cb.floor.layout}`, '0');
      check('V3', `${prof} 표지 프레임 생성 중: 작업 켬 − 바닥`, perF(cb.busy) - perF(cb.floor) <= 1.2, `${r2(perF(cb.busy))} − ${r2(perF(cb.floor))} = ${r2(perF(cb.busy) - perF(cb.floor))} ms/frame; rAF intervals p50 ${r2(pct(cb.busy.iv, 0.5))} p95 ${r2(pct(cb.busy.iv, 0.95))} max ${r2(Math.max(...cb.busy.iv))} ms (floor p95 ${r2(pct(cb.floor.iv, 0.95))})`, '≤ 1.2 ms/frame');
      check('V3s', `${prof} 스크롤 중 앰비언트 정지`, cb.scroll.pausedShare === 1, `paused in ${cb.scroll.pausedShare === null ? 'n/a' : Math.round(cb.scroll.pausedShare * 100) + '%'} of scrolling samples`, '100%');
      check('V3s', `${prof} 스크롤이 멈춘 뒤 다시 돎 (마지막 scroll 이벤트부터)`, cb.scroll.resumeMs !== null && cb.scroll.resumeMs <= 300, `${cb.scroll.resumeMs} ms (from the end of the gesture, incl. fling and polling: ${cb.scroll.pollMs} ms)`, '≤ 300 ms');
      check('V3s', `${prof} 스크롤 창 작업 켬 − 끔`, cb.scroll.taskPerFrame - cbOff.scroll.taskPerFrame <= 0.3, `${r2(cb.scroll.taskPerFrame)} − ${r2(cbOff.scroll.taskPerFrame)} = ${r2(cb.scroll.taskPerFrame - cbOff.scroll.taskPerFrame)} ms/frame`, '≤ 0.3 ms/frame');
      check('V4', `${prof} 화면 밖: 앰비언트 모두 paused, layout 0`, cb.offscreen.states.length > 0 && cb.offscreen.states.every(x => x === 'paused') && cb.offscreen.layout === 0, `${JSON.stringify(cb.offscreen.states)}, layout ${cb.offscreen.layout}`, 'all paused, 0');
      check('V4', `${prof} 탭 숨김: 앰비언트 모두 paused`, cb.hidden.states.every(x => x === 'paused') && cb.hidden.layout === 0, `${JSON.stringify(cb.hidden.states)}, layout ${cb.hidden.layout}`, 'all paused, 0');
      if (cb.idleStop) check('V4', 'desk 무입력 31초: m-idle, 다음 pointerdown에 다시 돎', cb.idleStop.cls && cb.idleStop.states.every(x => x === 'paused') && cb.idleStop.after.some(x => x === 'running'), `idle ${cb.idleStop.cls} ${JSON.stringify(cb.idleStop.states)} → ${JSON.stringify(cb.idleStop.after)}`, 'paused then running');
      check('V13', `${prof} 표지 will-change 요소`, cb.willChange <= 4, cb.willChange, '≤ 4');
      const pi = await playIdle(browser, prof); P.playIdle = pi;
      if (prof === 'phone') { // [2차] 이 VM에서는 게임 혼자(끔)도 5초에 51–67 ms라 60 ms 절대 기준이 모션과 상관없이 흔들림: 켬·끔 3번씩 중앙값으로 켬 − 끔 ≤ 5 ms, 켬 ≤ 100 ms(S3 전 513 ms 회귀 감시)
        const pOn = [pi, await playIdle(browser, prof), await playIdle(browser, prof)], pOff = [await playIdle(browser, prof, 'off'), await playIdle(browser, prof, 'off'), await playIdle(browser, prof, 'off')];
        const tOn = med(pOn.map(x => x.taskMs)), tOff = med(pOff.map(x => x.taskMs)); P.playIdle.runs = { on: pOn.map(x => r2(x.taskMs)), off: pOff.map(x => r2(x.taskMs)) };
        check('V5', 'phone 플레이 대기 5초 (rAF 없음, 켬·끔 3회 중앙값)', Math.max(...pOn.map(x => x.layout)) <= 10 && tOn - tOff <= 5 && tOn <= 100, `layout ${Math.max(...pOn.map(x => x.layout))}, task on ${r2(tOn)} [${P.playIdle.runs.on}] / off ${r2(tOff)} [${P.playIdle.runs.off}] ms`, 'layout ≤ 10, on − off ≤ 5 ms, on ≤ 100 ms');
      }
      else check('V5', 'desk 플레이 대기 5초 (rAF 없음)', pi.layout <= 10, `layout ${pi.layout}, task ${r2(pi.taskMs)} ms`, 'layout ≤ 10');
      check('V5', `${prof} 플레이 무한 반복 애니메이션 0`, pi.infinite.length === 0, JSON.stringify(pi.infinite), '0');
      check('V13', `${prof} 플레이 will-change 요소 0`, pi.willChange.length === 0, JSON.stringify(pi.willChange), '0');
      // 테마(V11, V11-p)
      if (prof === 'desk') {
        const th = await theme(browser, 'desk'); P.theme = th;
        const ds = th.runs.map(x => x.vt && x.vt.vis).filter(Boolean), tot = th.runs.map(x => x.vt && x.vt.d).filter(Boolean);
        check('V11', 'desk 테마 전환(보이는 원) 400 ms 안에 끝남', ds.length === 6 && Math.max(...ds) <= 400, `visible ${ds.map(r2).join(', ')} ms; from click incl. snapshot ${tot.map(r2).join(', ')} ms`, '≤ 400 ms');
        check('V11', 'desk 테마 전환 중 따로 도는 색 전환 0', th.runs.every(x => x.transitions === 0), JSON.stringify(th.runs.map(x => x.transitions)), '0');
        check('V11', 'desk VT 중 pointerdown → 50 ms 안에 끝남', th.skip !== null && th.skip <= 50, `${r2(th.skip)} ms`, '≤ 50 ms');
      } else {
        const fine = await theme(browser, 'phone', true), touch = await theme(browser, 'phone'); P.theme = { fine, touch };
        const ds = fine.runs.map(x => x.vt && x.vt.d).filter(Boolean), longF = fine.runs.map(x => (x.vt ? x.vt.iv.filter(v => v > 33.4).length : 0));
        const vtOk = ds.length === 6 && Math.max(...ds) <= 450 && Math.max(...longF) <= 2, gate = touch.runs.every(x => !x.vt);
        log(`  phone VT cost (same profile, pointer: fine): ${ds.map(r2).join(', ')} ms, >33 ms frames ${longF.join(',')} → ${vtOk ? 'within' : 'over'} the V11-p gate`);
        check('V11-p', 'phone 테마: VT가 관문(≤ 450 ms, 33 ms 넘는 프레임 ≤ 2)을 넘거나, 못 넘으면 (pointer: coarse)는 m-swap만', vtOk || gate, `VT max ${r2(Math.max(...ds))} ms, long frames max ${Math.max(...longF)}; touch device uses ${gate ? 'm-swap only' : 'View Transition'}`, 'VT within gate, else coarse → m-swap');
        check('V11-p', 'phone 테마 전환 중 따로 도는 색 전환 0 (터치·VT 모두)', [...fine.runs, ...touch.runs].every(x => x.transitions === 0), JSON.stringify([...fine.runs, ...touch.runs].map(x => x.transitions)), '0');
        check('V11-p', 'phone VT 중 pointerdown → 50 ms 안에 끝남', fine.skip !== null && fine.skip <= 50, `${r2(fine.skip)} ms`, '≤ 50 ms');
      }
      // 2차 검토 회귀 검사
      P.guards = await guards(browser, prof); guardChecks(P.guards, prof);
      // 영상과 프레임 띠
      if (VIDEO) {
        const s = await open(browser, prof, { mode: 'force', video: true, scheme: prof === 'desk' ? 'dark' : 'light' });
        await scenario(s, { video: true });
        const vp = await s.page.video().path(); await s.ctx.close();
        const file = path.join(VID, `${prof}-${prof === 'desk' ? 'dark' : 'light'}.webm`); fs.renameSync(vp, file);
        const vt = videoMarks(file, s.marks); P.videoMarks = vt;
        fs.writeFileSync(file.replace(/\.webm$/, '.marks.json'), JSON.stringify({ marks: s.marks, video: vt }, null, 1));
        let ok = 0;
        for (const [name, label, d0, dur, crop] of STRIPS_FOR[prof]) if (vt[label] != null && strip(file, vt[label] + d0, dur, path.join(STRIPS, `${prof}-${name}.png`), prof === 'desk' ? (crop ? 300 : 420) : 200, prof === 'desk' ? (crop ? 7 : 5) : 8, crop)) ok++;
        log(`  video ${path.relative(ROOT, file)}; ${ok} strips in ${path.relative(ROOT, STRIPS)}`);
      }
    }

    if (!GUARDS && (!ONLY || ONLY === 'desk')) {
      log('\n== reduced (1440×900)');
      for (const [tag, o] of [['OS reduce', { reduce: true }], ['in-page switch', { pref: true }]]) {
        const s = await open(browser, 'desk', { mode: 'force', reduce: o.reduce });
        const m = await scenario(s, { pref: o.pref, sample: true }); m.errors = s.errors; await s.ctx.close();
        const r = v8(m); report['v8 ' + tag] = r;
        check('V8', `${tag}: transform·clip 애니메이션 0, 남는 것은 opacity ≤160 ms 네 곳, 무한 0`, r.nBad === 0, `${r.anims} anims, bad ${r.nBad} ${r.bad.slice(0, 3).join(' ')}; places ${r.places.join(' ')}`, '0 bad');
        check('V8', `${tag}: View Transition 0, m-pre·m-hold·m-wait·m-lit 0`, r.vt === 0 && Object.values(r.cls).every(x => x === 0), `vt ${r.vt}, ${JSON.stringify(r.cls)}`, '0');
        if (o.pref) check('V8', 'in-page switch: 왼쪽 패널 장 해금 스크롤이 즉시(E3)', m.e3.filter(x => !x.rv).length > 0 && m.e3.filter(x => !x.rv).every(x => x.after === 0), JSON.stringify(m.e3), 'scrollTop 0 within 2 frames');
        check('V10', `${tag}: 콘솔 오류 0`, m.errors.length === 0, m.errors.slice(0, 3).join(' | ') || 0, '0');
      }
      log('\n== switch, invisible clicks, accessibility (1440×900)');
      const sw = await switchCheck(browser); report.switch = sw;
      check('V14', 'Tab으로 닿아 Space로 켬 → aria-pressed, m-reduce, 무한 애니메이션 정지, 저장', sw.tab && sw.on.pressed === 'true' && sw.on.reduce && sw.on.running === 0 && sw.on.saved === 'reduce', JSON.stringify({ tab: sw.tab, ...sw.on }), 'all');
      check('V14', '새로 고침 뒤에도 유지', sw.reload.pressed === 'true' && sw.reload.reduce, JSON.stringify(sw.reload), 'kept');
      check('V14', '저장소가 막혀도 오류 없이 이 페이지에서 동작', sw.blocked.reduce && sw.blocked.errors.length === 0, JSON.stringify(sw.blocked), 'works, 0 errors');
      check('V14', 'OS reduce일 때 aria-disabled', sw.os.pressed === 'true' && sw.os.disabled === 'true', JSON.stringify(sw.os), 'pressed + disabled');
      check('V15', '메뉴 리빌 숨김 중 아래 띠의 카드를 눌러도 열리지 않고 공개됨', sw.v15menu.prepared && !sw.v15menu.opened && sw.v15menu.revealed, JSON.stringify(sw.v15menu), 'not opened, revealed');
      check('V15', '장 넘김 보류 중 힌트 버튼 자리를 눌러도 힌트가 쓰이지 않고 공개됨', sw.v15hold.prepared && sw.v15hold.hintsOpened === 0 && sw.v15hold.holds === 0, JSON.stringify(sw.v15hold), '0 hints, released');
      const s = await open(browser, 'desk', { mode: 'force', spy: true });
      const m = await scenario(s, {}); await s.ctx.close();
      const bad = m.a11y.filter(x => !x.pref && x.op !== 'insertAdjacentHTML' && !/^#sts-motion-(css|reduce|swap)$/.test(x.sel)), deco = m.a11y.filter(x => x.op === 'insertAdjacentHTML');
      report.a11y = m.a11y;
      check('V16', 'motion.js의 hidden·inert·aria·role·tabindex·글자 변경과 포커스 이동 0 (스위치 자신 제외)', bad.length === 0, bad.slice(0, 4).map(x => `${x.op} ${x.name}@${x.sel}`).join(' | ') || 0, '0');
      check('V16', '넣은 장식 요소는 모두 aria-hidden', deco.length > 0 && deco.every(x => x.name === 'aria-hidden'), deco.map(x => `${x.sel}:${x.name}`).join(' '), 'all aria-hidden');
    }
  } finally { await browser.close(); }
  report.results = results;
  report.minutes = r2((Date.now() - T0) / 60000);
  const RJ = path.join(OUT, GUARDS ? 'report-guards.json' : 'report.json');
  fs.writeFileSync(RJ, JSON.stringify(report, null, 1));
  const failed = results.filter(r => !r.ok);
  log(`\n${results.length - failed.length}/${results.length} targets pass in ${report.minutes} min. Report: ${path.relative(process.cwd(), RJ)}`);
  log(failed.length ? `MOTION: ${failed.length} FAILED — ${failed.map(f => f.id + ' ' + f.name).join('; ')}` : 'MOTION: ALL PASS');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('MEASURE CRASHED:', e && e.stack || e); process.exit(2); });
