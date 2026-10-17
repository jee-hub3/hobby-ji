// 배경음악 테스트 (docs/MUSIC.md 8.3 생성기 검사, 8.4 페이지 검사). 실행: npm run test:music
//   A. Composer를 오디오 없이 60분씩 돌려 밀도·음역·반복·박·쉼을 잰다 (Node vm)
//   B. 아티팩트판 index.html (file://, 가짜 진행자)
//   C. 웹 서비스판: 가짜 Claude 서버 + wrangler dev(로컬 D1)에서 실제 브라우저로 메뉴부터 결말까지
// Playwright는 전역 설치본을 쓴다: PW=$(npm root -g)/playwright
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { extract } from '../tools/sync-music.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ARTIFACT = path.resolve(ROOT, '..', 'index.html');
const SRC = fs.readFileSync(path.join(ROOT, 'public/music.js'), 'utf8');
const OUT = path.join(ROOT, 'test/.out-music');
const STUB_PORT = 8792, APP_PORT = 8797, BASE = `http://localhost:${APP_PORT}`;
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra !== '' ? ' — ' + extra : ''}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ONLY = process.env.MUSIC_TEST_ONLY || ''; // 'A' | 'B' | 'C' 중 일부만 돌릴 때

/* ============================================================== A. 생성기 (8.3) */
function partA() {
  const sb = { console }; vm.createContext(sb); vm.runInContext(SRC, sb);
  const { Composer, TABLES } = sb.STSMusic;
  const { CH, SC } = TABLES;
  const run = (seed, scene, until = 3600, ctl = []) => { const c = new Composer(seed, scene); c.start(0); ctl.forEach(x => c.control(x)); return c.generate(until); };
  const walkOf = ns => ns.filter((n, i) => !(i > 0 && n.t - ns[i - 1].t < 0.035)); // 겹음 위 음(30 ms 뒤)은 걸음이 아니다
  const D1 = { play: [4, 9], menu: [8, 15], solved: [6, 12], gaveup: [2, 7], thinking: [0, 0] };
  const stats = {};
  for (const scene of Object.keys(D1)) for (const seed of [1, 2, 3]) {
    const ev = run(seed, scene), notes = ev.filter(e => e.type === 'note'), chords = ev.filter(e => e.type === 'chord');
    const key = `${scene} s${seed}`, per = notes.length / 60;
    check(`D1 density ${key}: ${per.toFixed(1)} notes/min`, per >= D1[scene][0] && per <= D1[scene][1], `${D1[scene].join('–')}`);
    const r = SC[scene].range;
    check(`D2 range ${key}`, notes.every(n => n.midi >= r[0] && n.midi <= r[1]) && chords.every(c => (CH[c.id][c.voicing] || CH[c.id].A).every(m => m >= 51 && m <= 68))
      && ev.filter(e => e.type === 'drone').every(d => d.root === 37));
    check(`D2 Db2 pedal never moves ${key}`, ev.filter(e => e.type === 'drone').length === 1 && !ev.some(e => e.type === 'droneRelease'));
    const w = walkOf(notes), seen = {}; let rep300 = 0, maxH = 0, dir3 = 0, dirs = [];
    for (let i = 3; i < w.length; i++) { const k = w.slice(i - 3, i + 1).map(n => n.midi).join(); const ts = seen[k] = seen[k] || []; if (ts.length && w[i].t - ts[ts.length - 1] < 300) rep300++; ts.push(w[i].t); maxH = Math.max(maxH, ts.length); }
    for (let i = 1; i < w.length; i++) { const d = Math.sign(w[i].midi - w[i - 1].midi); if (d) { dirs.push(d); if (dirs.length >= 3 && dirs.slice(-3).every(x => x === d)) dir3++; } }
    if (notes.length) {
      check(`D3 motif ${key}: none within 300 s, max ${maxH}/h`, rep300 === 0 && maxH <= 8);
      const on = notes.map(n => n.t), g = on.slice(1).map((t, i) => t - on[i]), m = g.reduce((a, b) => a + b, 0) / g.length;
      const cv = Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length) / m;
      check(`D5 no pulse ${key}: CV ${cv.toFixed(2)}`, cv >= 0.5);
      check(`D7 no 3 steps one way ${key}`, dir3 === 0);
    }
    const tri = {}; let trirep = 0;
    for (let i = 2; i < chords.length; i++) { const k = chords.slice(i - 2, i + 1).map(c => c.id + c.voicing).join('|'); if (tri[k] != null && chords[i].t - tri[k] < 180) trirep++; tri[k] = chords[i].t; }
    check(`D4 chord triples ${key}`, trirep === 0, String(trirep));
    const gap = Math.min(...chords.slice(1).map((c, i) => c.t - chords[i].t));
    check(`D8 chord change gap ${key}: ${gap.toFixed(1)} s`, gap >= 10);
    stats[key] = { notes };
  }
  for (const seed of [1, 2, 3]) { // D6: 6분 창(30초씩 밀며)마다 40초 넘게 건반이 없는 구간이 겹친다
    const on = stats[`play s${seed}`].notes.map(n => n.t), gaps = [];
    for (let i = 1; i < on.length; i++) if (on[i] - on[i - 1] >= 40) gaps.push([on[i - 1], on[i]]);
    let bad = 0; for (let w0 = 0; w0 + 360 <= 3600; w0 += 30) if (!gaps.some(([a, b]) => a < w0 + 360 && b > w0)) bad++;
    check(`D6 rest in every 6-min window play s${seed}`, bad === 0, `${gaps.length} rests, ${bad} windows without`);
  }
  // D9: 6초마다 play↔thinking 10분. 생각 중과 끝난 뒤 4초 안에는 새 음이 없다
  const ctl = []; for (let t = 30; t < 630; t += 6) ctl.push({ t, kind: 'scene', value: (t / 6) % 2 ? 'thinking' : 'play' });
  const thinkIv = []; for (let i = 0; i < ctl.length; i++) if (ctl[i].value === 'thinking') thinkIv.push([ctl[i].t, (ctl[i + 1] ? ctl[i + 1].t : 630) + 4]);
  for (const seed of [1, 2, 3]) {
    const ns = run(seed, 'play', 700, ctl).filter(e => e.type === 'note');
    const bad = ns.filter(n => thinkIv.some(([a, b]) => n.t >= a && n.t < b));
    check(`D9 no new notes while thinking (+4 s) s${seed}`, bad.length === 0, `${bad.length} of ${ns.length}`);
  }
  // D10 보이싱 규칙. 9.6: 드론 옥타브 배음(Db3 49)도 성부처럼 본다. 단2도는 늘 금지, Ab3 아래 장2도는 배음 진폭이 루트의 0.15 이하일 때만
  let v10 = [], d10 = [], k10 = [];
  const oct = TABLES.DR.find(d => d[0] === 2), octM = 37 + 12;
  for (const id in CH) for (const v of ['A', 'B', 'C']) {
    const ns = CH[id][v]; if (!ns) continue;
    for (let i = 1; i < ns.length; i++) { const d = ns[i] - ns[i - 1]; if (d === 1 || (d === 2 && ns[i - 1] < 56)) v10.push(id + v); }
    for (const m of ns) { const d = Math.abs(m - octM); if (d === 1 || (d === 2 && Math.min(m, octM) < 56 && oct[1] > 0.15)) d10.push(`${id}${v}:${m}`); }
    for (const k of CH[id].keys) for (const m of ns) if (Math.abs(k - m) === 1 || k - m === 13) k10.push(`${id}${v}:${k}/${m}`);
  }
  check('D10 voicings: no adjacent m2, M2 only from Ab3 up', v10.length === 0, v10.join(','));
  check(`D10 drone octave (amp ${oct[1]}) makes no low m2, and a low M2 only while it is at most 0.15 of the root`, d10.length === 0, d10.join(','));
  check('D10 keys: no key-pool note a semitone or a minor 9th above a pad voice of the same chord (all voicings)', k10.length === 0, k10.join(','));
  // D10 (9.7-6): 화음이 바뀌는 언저리. 꼬리 = 다음 화음이 -6 dB(어택 2초)에 닿을 때 아직 -20 dB 이상 울리는 건반 음, 머리 = 나가는 화음이 -6 dB 이상인 동안 친 음.
  // 둘 다 상대 패드 음과 반음·단9도(아래 반음 포함)를 이루면 안 된다. 60분 × 시드 1–3, 장면 넷
  const lvl = dt => dt < .02 ? 0 : dt < .45 ? 20 * Math.log10(.55 + .45 * Math.exp(-(dt - .02) / .15)) : dt < 4.2 ? 20 * Math.log10(.55 * Math.exp(-(dt - .45) / 2.2)) : 20 * Math.log10(.55 * Math.exp(-3.75 / 2.2) * Math.exp(-(dt - 4.2) / .6));
  const rub = (n, p) => [1, 13, 25].includes(n - p) || p - n === 1, padOf = c => CH[c.id][c.voicing] || CH[c.id].A;
  for (const scene of ['play', 'menu', 'solved', 'gaveup']) {
    let tail = 0, head = 0, ex = [];
    for (const seed of [1, 2, 3]) {
      const ev = run(seed, scene), chords = ev.filter(e => e.type === 'chord');
      for (const n of ev.filter(e => e.type === 'note')) {
        const j = chords.findIndex(c => c.t > n.t), nx = j >= 0 ? chords[j] : null, cur = chords[(j >= 0 ? j : chords.length) - 1], old = chords[(j >= 0 ? j : chords.length) - 2];
        if (nx && lvl(nx.t + 2 - n.t) >= -20 && padOf(nx).some(p => rub(n.midi, p))) { tail++; ex.push(`tail ${n.midi}->${nx.id}${nx.voicing}`); }
        if (old && n.t - cur.t < 7 && Math.cos(Math.PI / 2 * (n.t - cur.t) / 7) >= .5 && padOf(old).filter(p => !padOf(cur).includes(p)).some(p => rub(n.midi, p))) { head++; ex.push(`head ${n.midi}@${old.id}${old.voicing}`); }
      }
    }
    check(`D10 ${scene}: keys ringing into the next chord or played over the outgoing one never rub (3 h)`, tail === 0 && head === 0, `tail ${tail}, head ${head} ${ex.slice(0, 3).join(' ')}`);
  }
  // D13 (9.7-1): 질문 U(15,45) s마다, 진행자 생각 U(2,8) s로 한 시간. 생각 중과 답 뒤 4초 안에는 음이 없고, 답 뒤 첫 음이 답에 묶이지 않는다
  for (const seed of [1, 2, 3]) {
    const c = new Composer(seed, 'play'); c.start(0);
    let t = 30, a = seed * 99991; const r = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
    const ans = [], th = [];
    while (t < 3500) { c.control({ t, kind: 'scene', value: 'thinking' }); const d = 2 + 6 * r(); c.control({ t: t + d, kind: 'scene', value: 'play' }); th.push([t, t + d + 4]); ans.push(t + d); t += d + 15 + 30 * r(); }
    const ns = c.generate(3600).filter(e => e.type === 'note').map(e => e.t);
    const inTh = ns.filter(n => th.some(([x, y]) => n >= x && n < y)).length;
    const dl = ans.map((x, i) => { const n = ns.find(y => y >= x); return n != null && n < (ans[i + 1] || 3600) ? n - x : null; }).filter(d => d != null);
    const near = dl.filter(d => d >= 4 && d < 5).length, ex4 = dl.filter(d => Math.abs(d - 4) < 1e-3).length;
    check(`D13 answers s${seed}: no note while thinking or within 4 s after, first note in [4,5) s for at most 15% of answers`, inTh === 0 && ex4 === 0 && near <= 0.15 * dl.length,
      `${inTh} inside, ${ex4} at +4.000, ${near}/${dl.length} in [4,5)`);
  }
  // D14 (9.7-5): 공기 층마다 L/R 두 읽기 머리(같은 버퍼, R은 len/2에서 시작)의 거리가 60분 내내 50 ms 이상 (모노에서 콤 필터 방지)
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const c = new Composer(seed, 'play'); c.start(0);
    const ev = c.generate(3600).filter(e => e.type === 'rate'), out = [];
    for (const [layer, L] of TABLES.TEX) {
      const pts = [0, 1].map(ch => [[0, 1]].concat(ev.filter(e => e.layer === layer && (e.ch == null || e.ch === ch)).map(e => [e.t + e.ramp, e.value])));
      const idx = [1, 1], val = (ch, t) => { const P = pts[ch]; while (idx[ch] < P.length - 1 && t > P[idx[ch]][0]) idx[ch]++; const [x, vx] = P[idx[ch] - 1], [y, vy] = P[idx[ch]]; return t >= y ? vy : vx + (vy - vx) * (t - x) / (y - x); };
      let h0 = 0, h1 = L / 2, mn = 1e9;
      for (let t = 0; t < 3600; t += 0.01) { h0 += val(0, t) * 0.01; h1 += val(1, t) * 0.01; let d = ((h1 - h0) % L + L) % L; d = Math.min(d, L - d); mn = Math.min(mn, d); }
      out.push([layer, mn]);
    }
    check(`D14 texture L/R read heads stay apart s${seed}`, out.every(x => x[1] >= 0.05), out.map(([l, d]) => `${l} ${(d * 1000).toFixed(0)} ms`).join(', '));
  }
  // D11 쿨다운: 5초 간격 두 번이면 숨결은 한 번
  const c11 = new Composer(1, 'play'); c11.start(0);
  const ok1 = c11.control({ t: 40, kind: 'cue', value: 'chapter' }), ok2 = c11.control({ t: 45, kind: 'cue', value: 'chapter' });
  const vs = c11.generate(80).filter(e => e.type === 'chord' && e.id === 'V');
  check('D11 chapter cue cooldown: one breath for two cues 5 s apart', ok1 && !ok2 && vs.length === 1, `${ok1} ${ok2} V×${vs.length}`);
  // D12 결정성
  const tl = [{ t: 20, kind: 'scene', value: 'thinking' }, { t: 26, kind: 'scene', value: 'play' }, { t: 60, kind: 'cue', value: 'chapter' }, { t: 120, kind: 'scene', value: 'solved', intro: true, x: 6 }];
  const ser = s => JSON.stringify(run(s, 'play', 600, tl.map(x => ({ ...x }))));
  check('D12 same seed and timeline → same events; other seed differs', ser(5) === ser(5) && ser(5) !== ser(6));
  // 큐 시퀀스 모양 (4.4, 4.5, 4.6)
  const cueEv = run(1, 'play', 120, [{ t: 40, kind: 'cue', value: 'chapter' }]).filter(e => e.type === 'chord' && e.t >= 40 && e.t < 70).map(e => `${e.id}${e.id === 'V' ? e.voicing : ''}@${(e.t - 40).toFixed(0)}`);
  check('4.4 chapter breath: V (cue voicing C)@0, I69@4, I@16', cueEv.slice(0, 3).join(' ') === 'VC@0 I69@4 I@16', cueEv.join(' '));
  const sol = run(1, 'play', 140, [{ t: 40, kind: 'scene', value: 'solved', intro: true, x: 6 }]).filter(e => e.type === 'chord' && e.t >= 40 && e.t < 60).map(e => `${e.id}${e.id === 'V' ? e.voicing : ''}@${(e.t - 40).toFixed(0)}`);
  check('4.5 solved: V (cue voicing C)@0, I@5, I69@15', sol.join(' ') === 'VC@0 I@5 I69@15', sol.join(' '));
  check('2.2 V voicing C is cue-only: never drawn by the walk', [1, 2, 3].every(sd => ['play', 'menu'].every(sc => !run(sd, sc).some(e => e.type === 'chord' && e.voicing === 'C'))));
  const gv = run(1, 'play', 400, [{ t: 40, kind: 'scene', value: 'gaveup', intro: true, x: 6 }]).filter(e => e.type === 'chord' && e.t >= 40);
  check('4.6 gave up: vi first, never back to I', gv[0].id === 'vi' && gv.every(e => ['vi', 'IV', 'ii'].includes(e.id)), gv.slice(0, 6).map(e => e.id).join(' '));
}

/* ============================================================== 페이지 공통 */
const SPY = () => { // AudioContext 생성자 스파이 (U2, U3, U7)
  const AC = window.AudioContext;
  window.__ac = { made: 0, madeIn: null, resumeIn: [], suspends: 0, ctx: null };
  if (!AC) return;
  window.AudioContext = class extends AC {
    constructor(o) { super(o); window.__ac.made++; window.__ac.madeIn = window.event ? window.event.type : null; window.__ac.ctx = this; }
    resume() { window.__ac.resumeIn.push(window.event ? window.event.type : null); return super.resume(); }
    suspend() { window.__ac.suspends++; return super.suspend(); }
  };
};
const hist = page => page.evaluate(() => (window.STSMusic && window.STSMusic.controller ? window.STSMusic.controller.history.map(h => h.kind + ':' + h.value + (h.intro ? '+intro' : '')) : []));
const st = page => page.evaluate(() => window.STSMusic.state());
async function waitHist(page, entry, from = 0, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const h = await hist(page); if (h.slice(from).includes(entry)) return true; await sleep(150); }
  return false;
}
async function buttons(page, tag) { // U1
  const r = await page.evaluate(() => [...document.querySelectorAll('.music-btn')].map(b => ({
    next: !!(b.nextElementSibling && b.nextElementSibling.classList.contains('theme-btn')), parent: b.parentElement.className,
    type: b.getAttribute('type'), pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), title: b.getAttribute('title') })));
  check(`U1 ${tag}: two speaker buttons, menu nav and play bar`, r.length === 2 && r.some(x => /topnav-end/.test(x.parent)) && r.some(x => /tb-right/.test(x.parent)), JSON.stringify(r.map(x => x.parent)));
  check(`U1 ${tag}: each sits right before .theme-btn with type/aria/title (before any sound: says a tap starts it, 9.7-13)`, r.every(x => x.next && x.type === 'button' && x.pressed === 'true' && x.label === '배경음악' && x.title === '배경음악 끄기 (화면을 누르면 재생돼요)'), JSON.stringify(r.map(x => x.title)));
}
async function unlock(page, tag) { // U2, U3
  check(`U2 ${tag}: no AudioContext before a gesture`, (await page.evaluate(() => window.__ac.made)) === 0 && (await st(page)).contextState === 'none');
  await page.mouse.click(5, 300);
  await page.waitForFunction(() => window.STSMusic.state().contextState === 'running', null, { timeout: 5000 }).catch(() => {});
  const ac = await page.evaluate(() => ({ made: window.__ac.made, madeIn: window.__ac.madeIn, resumeIn: window.__ac.resumeIn }));
  const s = await st(page);
  check(`U3 ${tag}: a click creates the context and resumes it in the same handler`, ac.made === 1 && ac.madeIn === 'pointerdown' && ac.resumeIn[0] === 'pointerdown', JSON.stringify(ac));
  check(`U3 ${tag}: enabled and running after the click`, s.enabled && s.contextState === 'running', JSON.stringify(s));
  await page.waitForFunction(() => !!window.STSMusic.controller.engine, null, { timeout: 5000 }).catch(() => {}); // 엔진은 뒤 태스크에서 만든다 (9.6)
  const f = await page.evaluate(() => { const e = window.STSMusic.controller.engine, p = e.fadeP, last = p.ev[p.ev.length - 1], t0 = p.ev[0].t; return { dur: last.t - t0, end: last.v, mid: p.val(t0 + 5) }; });
  check(`U3 ${tag}: 10-second fade-in from silence`, Math.abs(f.dur - 10) < 0.01 && f.end === 1 && f.mid > 0.3 && f.mid < 0.7, JSON.stringify(f));
  await sleep(600);
  check(`U3 ${tag}: voices are playing`, (await st(page)).voices > 4, String((await st(page)).voices));
  const ti = await page.evaluate(() => [...document.querySelectorAll('.music-btn')].map(b => b.title));
  check(`U1 ${tag}: once the music runs, the title is just 배경음악 끄기`, ti.length === 2 && ti.every(x => x === '배경음악 끄기'), JSON.stringify(ti));
}
async function overflow(browser, url, tag, init) { // U9
  const bad = [];
  for (const width of [320, 375]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 760 }, colorScheme: scheme });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    await p.goto(url); await p.waitForSelector('.music-btn', { timeout: 15000 });
    const m = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await p.click('.dish-featured'); await p.waitForSelector('#play-view:not([hidden])', { timeout: 15000 }); await sleep(300);
    const g = await p.evaluate(() => { const b = document.querySelector('#play-view .music-btn').getBoundingClientRect(); return { ow: document.documentElement.scrollWidth - innerWidth, right: b.right, w: innerWidth }; });
    if (m > 0 || g.ow > 0 || g.right > g.w) bad.push(`${width}/${scheme}: menu ${m}, play ${g.ow}, btn ${Math.round(g.right)}`);
    await ctx.close();
  }
  check(`U9 ${tag}: no horizontal overflow at 320/375 px, light and dark, menu and play`, bad.length === 0, bad.join(' | '));
}
async function pageErrors(page, errors, tag) { check(`U10 ${tag}: no page errors or console errors`, errors.length === 0, errors.slice(0, 3).join(' | ')); }

/* ============================================================== B. 아티팩트판 */
const HOST_STUB = () => { // 아티팩트의 AI 진행자 가짜: "#N"은 단서 N, 추리는 그 장의 단서를 모두 맞힘. 답은 0.7초 뒤 (생각 중 판정용)
  const fake = async () => ({});
  fake.json = async prompt => {
    await new Promise(r => setTimeout(r, 700));
    const body = (prompt.match(/"""([\s\S]*?)"""/) || [, ''])[1];
    if (prompt.includes('[플레이어의 추리]')) { const sec = prompt.split(/\[\d+장의 핵심 단서\]/)[1] || ''; return { matched: [...sec.split('[')[0].matchAll(/^(\d+)\./gm)].map(x => +x[1]), comment: '맞아요.' }; }
    const hits = [...body.matchAll(/#(\d+)/g)].map(x => +x[1]);
    return { answer: hits.length ? 'yes' : 'no', note: '', hits };
  };
  window.claude = { use: async name => (name === 'sample' ? fake : null) };
};
async function partB(browser) {
  const url = 'file://' + ARTIFACT;
  check('U12 artifact: inlined music script is byte-identical to public/music.js', extract(fs.readFileSync(ARTIFACT, 'utf8')) === SRC);
  check(`7.1 music.js is at most 46 KB (${Buffer.byteLength(SRC)} bytes, 9.7)`, Buffer.byteLength(SRC) <= 46 * 1024);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await ctx.addInitScript(SPY); await ctx.addInitScript(HOST_STUB);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto(url); await page.waitForSelector('.music-btn');
  await buttons(page, 'artifact');
  await unlock(page, 'artifact');
  const data = await page.evaluate(() => JSON.parse(document.getElementById('puzzle-data').textContent));
  const fid = await page.getAttribute('.dish-featured', 'data-id'), p0 = data.find(x => x.id === fid);
  const h0 = (await hist(page)).length;
  await page.click('.dish-featured');
  check('U5 artifact: menu → play', await waitHist(page, 'scene:play', h0));
  await sleep(1600);
  const ask = async t => { await page.fill('#q-input', t); await page.press('#q-input', 'Enter'); await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 10000 }); await sleep(350); };
  await ask('질문 하나 #1');
  check('U5 artifact: play → thinking → play while the host answers', (await hist(page)).slice(h0).join(' ').includes('scene:thinking scene:play'));
  for (let n = 2; n <= p0.chapters[0].keys.length; n++) await ask(`질문 #${n}`);
  check('U5 artifact: clearing chapter 1 breathes once (cue chapter)', await waitHist(page, 'cue:chapter', h0));
  for (let i = 0; i < 5 && !(await page.isVisible('#reveal')); i++) { await page.click('#skip-btn'); await page.click('#skip-yes'); await sleep(400); }
  check('U5 artifact: last chapter → solved with intro', await waitHist(page, 'scene:solved+intro', h0));
  const cues = (await hist(page)).slice(h0).filter(x => x === 'cue:chapter').length;
  check('U5 artifact: skipped chapters inside the 20 s cooldown add no breath', cues === 1, String(cues));
  // 6.8-3 (9.6, 9.7-8): iOS의 'interrupted'(전화, Siri)처럼 실제 컨텍스트를 멈춰 시계를 세운다. 멈춘 동안: 페이드 0, 리스너 다시 걸기, 스케줄러 멈춤.
  // 'running'으로 돌아오면 바로 그 시각의 페이드 값이 0 근처이고(무음에서 다시), 4초 페이드인과 스케줄러가 돌아온다
  const intr = await page.evaluate(async () => {
    const c = window.STSMusic.controller, ctx = c.ctx, e = c.engine, wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(1500); // 시작 페이드인을 지나 소리가 온전히 난 뒤
    const lvl0 = e.fadeP.val(ctx.currentTime);
    const back = new Promise(r => { const f = () => { if (ctx.state === 'running') { ctx.removeEventListener('statechange', f); r(e.fadeP.val(ctx.currentTime)); } }; ctx.addEventListener('statechange', f); });
    await AudioContext.prototype.suspend.call(ctx); await wait(500);
    const t0 = ctx.currentTime; await wait(300);
    const a = { state: ctx.state, frozen: ctx.currentTime === t0, armed: c.armed, held: c.held, loop: c.loopT, fadeNow: e.fadeP.val(ctx.currentTime) };
    ctx.resume(); const atBack = await back; await wait(300);
    const p = e.fadeP.ev; return { lvl0, a, b: { atBack, armed: c.armed, loop: !!c.loopT, last: p[p.length - 1].v, dur: p[p.length - 1].t - p[0].t } };
  });
  check('6.8-3 artifact: real suspend (frozen clock) → fade 0 at once, re-armed, scheduler idle; running → restarts from silence (≤ 0.02), 4-second fade-in, scheduler back',
    intr.lvl0 > 0.3 && intr.a.frozen && intr.a.armed && intr.a.held && !intr.a.loop && intr.a.fadeNow === 0 && intr.b.atBack <= 0.02 && !intr.b.armed && intr.b.loop && intr.b.last === 1 && Math.abs(intr.b.dur - 4) < 0.01, JSON.stringify(intr));
  // 6.6 (9.7-8): pagehide → pageshow(persisted, bfcache 복귀)도 무음에서 4초
  const bf = await page.evaluate(async () => {
    const c = window.STSMusic.controller, ctx = c.ctx, e = c.engine, wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(4500); const lvl0 = e.fadeP.val(ctx.currentTime);
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); await wait(800);
    const hid = { state: ctx.state, muted: c.muted };
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    const now = e.fadeP.val(ctx.currentTime); await wait(600);
    const p = e.fadeP.ev; return { lvl0, hid, now, state: ctx.state, last: p[p.length - 1].v, dur: p[p.length - 1].t - p[0].t };
  });
  check('6.6 artifact: pagehide → suspended; pageshow(persisted) → restarts from silence (≤ 0.02) with a 4-second fade-in',
    bf.lvl0 > 0.9 && bf.hid.state === 'suspended' && bf.hid.muted && bf.now <= 0.02 && bf.state === 'running' && bf.last === 1 && Math.abs(bf.dur - 4) < 0.01, JSON.stringify(bf));
  // 9.6: 음악을 끈 동안 장 카드가 생기면 기록만 하고 숨결은 예약하지 않는다 (다시 켰을 때 화면과 상관없는 숨결 방지)
  const h1 = (await hist(page)).length;
  await page.click('#rv-close'); await waitHist(page, 'scene:play', h1);
  await page.click('#play-view .music-btn'); await sleep(2300);
  const off = await page.evaluate(async () => {
    const c = window.STSMusic.controller, before = c.engine.comp.lastCue = -1e9; c.lastCue = -1e9; c.playSince = 0; // 두 쿨다운을 비워 큐가 막히지 않게
    const d = document.createElement('div'); d.className = 'entry entry-chapter'; document.getElementById('log').appendChild(d);
    await new Promise(r => setTimeout(r, 700)); d.remove();
    return { logged: c.history.slice(-3).map(x => x.kind + ':' + x.value), before, after: c.engine.comp.lastCue, state: c.ctx.state };
  });
  check('9.6 artifact: a chapter card while music is off is logged but queues no breath', off.logged.includes('cue:chapter') && off.after === off.before && off.state === 'suspended', JSON.stringify(off));
  await pageErrors(page, errors, 'artifact');
  await ctx.close();
  // U8: Web Audio가 없는 페이지
  const c2 = await browser.newContext(); await c2.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; }); await c2.addInitScript(HOST_STUB);
  const p2 = await c2.newPage(), e2 = [];
  p2.on('pageerror', e => e2.push(e.message)); p2.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') e2.push(m.text()); });
  await p2.goto(url); await p2.waitForSelector('.dish-featured'); await p2.mouse.click(5, 300); await sleep(400);
  const u8 = await p2.evaluate(() => ({ btns: document.querySelectorAll('.music-btn').length, supported: window.STSMusic && window.STSMusic.supported }));
  check('U8 artifact without Web Audio: no buttons, no errors', u8.btns === 0 && u8.supported === false && e2.length === 0, JSON.stringify(u8) + e2.join('|'));
  await c2.close();
  await overflow(browser, url, 'artifact', HOST_STUB);
  // D9 엔진: play↔thinking을 100번 오가도 파라미터 자동화가 생기지 않는다
  const c3 = await browser.newContext(); const p3 = await c3.newPage();
  await p3.setContent('<body></body>'); await p3.addScriptTag({ content: SRC });
  const d9 = await p3.evaluate(() => {
    const ctx = new OfflineAudioContext(2, 44100 * 2, 44100), e = new window.STSMusic.Engine(ctx, { seed: 1, scene: 'play' });
    e.start(0); e.scheduleUntil(1); const before = e.ops;
    for (let i = 0; i < 100; i++) e.setScene(i % 2 ? 'play' : 'thinking', { at: 2 + i * 6 });
    const mid = e.ops; e.setScene('menu', { at: 700 });
    return { before, mid, after: e.ops };
  });
  check('D9 engine: 100 play↔thinking switches add no parameter automation', d9.mid === d9.before && d9.after > d9.mid, JSON.stringify(d9));
  // 6.8-5: 노드 생성자가 없는 옛 Safari 경로(create*)로도 소리가 난다
  const fb = await p3.evaluate(async () => {
    for (const k of ['GainNode', 'OscillatorNode', 'BiquadFilterNode', 'StereoPannerNode']) delete window[k];
    const ctx = new OfflineAudioContext(2, 44100 * 4, 44100), e = new window.STSMusic.Engine(ctx, { seed: 3, scene: 'menu', fadeIn: 1 });
    e.start(0.1); e.scheduleUntil(4);
    const b = await ctx.startRendering(), d = b.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    return { rms: Math.sqrt(s / d.length), live: e.state.voices };
  }).catch(err => ({ error: err.message }));
  check('6.8-5 engine without node constructors (create* fallback) still plays', fb.rms > 1e-4, JSON.stringify(fb));
  await c3.close();
}

/* ============================================================== C. 웹 서비스판 */
async function partC(browser) {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const DEV_VARS = path.join(ROOT, '.dev.vars'), DEV_BAK = DEV_VARS + '.before-test';
  if (fs.existsSync(DEV_VARS) && !fs.existsSync(DEV_BAK)) fs.renameSync(DEV_VARS, DEV_BAK);
  process.on('exit', () => { try { fs.rmSync(DEV_VARS, { force: true }); if (fs.existsSync(DEV_BAK)) fs.renameSync(DEV_BAK, DEV_VARS); } catch (e) { /* best effort */ } });
  fs.writeFileSync(DEV_VARS, ['ANTHROPIC_API_KEY=sk-test-not-real', `ANTHROPIC_BASE_URL=http://127.0.0.1:${STUB_PORT}`, 'SESSION_SECRET=music-session-secret-0123456789', 'AI_DEVICE_PER_MINUTE=1000', 'AI_DAILY_BUDGET_USD=5'].join('\n') + '\n');
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' }, procs = [];
  const run = (cmd, args, name) => { const p = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', fs.openSync(path.join(OUT, name + '.log'), 'w'), fs.openSync(path.join(OUT, name + '.log'), 'a')], detached: true }); procs.push(p); };
  const cleanup = () => { for (const p of procs) { try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { /* gone */ } } procs.length = 0; };
  process.on('exit', cleanup);
  try {
    execSync(`npx wrangler d1 migrations apply DB --local --persist-to ${path.join(OUT, 'state')}`, { cwd: ROOT, env, stdio: 'ignore' });
    run('node', ['test/stub-anthropic.js', String(STUB_PORT), path.join(OUT, 'stub.jsonl')], 'stub');
    run('npx', ['wrangler', 'dev', '--port', String(APP_PORT), '--ip', '127.0.0.1', '--persist-to', path.join(OUT, 'state'), '--show-interactive-dev-session=false'], 'wrangler');
    for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE + '/api/config')).ok) break; } catch (e) { /* not yet */ } await sleep(500); }
    check('web: /music.js is served as JavaScript', /javascript/.test((await fetch(BASE + '/music.js')).headers.get('content-type') || ''));
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/puzzles.json'), 'utf8'));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    await ctx.addInitScript(SPY);
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/fonts\.g|status of [45]\d\d/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
    let slow = false; // 질문 응답을 늦춰 "생각 중"을 250 ms 정착 판정이 볼 수 있게 한다
    await page.route('**/api/games/*/ask', async r => { if (slow) await sleep(900); await r.continue(); });
    await page.goto(BASE + '/'); await page.waitForSelector('#menu-cols button'); await page.waitForSelector('.music-btn');
    check('U5 web: the module starts in the menu scene', (await hist(page))[0] === 'scene:menu');
    await buttons(page, 'web');
    await unlock(page, 'web');
    const fid = await page.getAttribute('.dish-featured', 'data-id'), p0 = raw.find(x => x.id === fid);
    await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])');
    check('U5 web: menu → play', await waitHist(page, 'scene:play'));
    await sleep(1600);
    const ask = async t => { await page.fill('#q-input', t); await page.press('#q-input', 'Enter'); await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 15000 }); await sleep(350); };
    slow = true; await ask('이 일은 사고였나요?'); slow = false;
    check('U5 web: play → thinking → play while the host answers', (await hist(page)).join(' ').includes('scene:play scene:thinking scene:play'), (await hist(page)).join(' '));
    for (let n = 1; n <= p0.chapters[0].keys.length; n++) await ask(`단서 질문 #${n}`);
    check('U5 web: clearing chapter 1 → cue chapter', await waitHist(page, 'cue:chapter'));
    // U11 테마 버튼
    let h = (await hist(page)).length;
    await page.click('#play-view .theme-btn');
    check('U11 web: theme button → theme night', await waitHist(page, 'theme:night', h));
    await page.click('#play-view .theme-btn');
    check('U11 web: and back → theme day', await waitHist(page, 'theme:day', h + 1));
    // U7 탭 숨김/보임
    const vis = hidden => page.evaluate(hd => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hd }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hd ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
    await vis(true); await sleep(2300);
    const hid = await page.evaluate(() => ({ state: window.__ac.ctx.state, suspends: window.__ac.suspends, fade: window.STSMusic.controller.engine.fadeP.ev.slice(-1)[0] }));
    check('U7 web: hidden tab → fade out, then suspend', hid.state === 'suspended' && hid.suspends >= 1 && hid.fade.k === 'x' && hid.fade.v === 0, JSON.stringify(hid));
    await vis(false); await sleep(400);
    const shown = await page.evaluate(() => { const p = window.STSMusic.controller.engine.fadeP; return { state: window.__ac.ctx.state, last: p.ev[p.ev.length - 1], dur: p.ev[p.ev.length - 1].t - p.ev[0].t }; });
    check('U7 web: visible again → resume and 4-second fade-in', shown.state === 'running' && shown.last.v === 1 && Math.abs(shown.dur - 4) < 0.01, JSON.stringify(shown));
    // U6: 장 해결 큐가 나오면 안 되는 세 경우. 쿨다운(20 s)이 가리지 않게 매번 비우고 본다
    const noCool = () => page.evaluate(() => { window.STSMusic.controller.lastCue = -1e9; });
    const noCue = async (tag, act) => { await noCool(); const h0 = (await hist(page)).length; await act(); await sleep(2200); const hs = (await hist(page)).slice(h0); check(`U6 web: ${tag} → no chapter cue`, !hs.includes('cue:chapter'), hs.join(' ')); };
    await page.click('#back-btn');
    check('U5 web: back to the menu → menu', await waitHist(page, 'scene:menu', h));
    await noCue('resuming a puzzle that has chapter cards', async () => { await page.click('.dish-featured'); await page.waitForSelector('#play-view:not([hidden])'); await page.waitForFunction(() => document.querySelectorAll('#log .entry-chapter').length >= 1, null, { timeout: 8000 }); });
    // 결말: 남은 장을 넘겨 완주 → 완식 시퀀스
    h = (await hist(page)).length;
    for (let i = 0; i < 5 && !(await page.isVisible('#reveal')); i++) { await page.click('#skip-btn'); await page.click('#skip-yes'); await sleep(700); }
    check('U5 web: finishing → solved with intro', await waitHist(page, 'scene:solved+intro', h));
    await page.click('#rv-close');
    check('U5 web: 닫고 기록 보기 → play', await waitHist(page, 'scene:play', h + 1));
    h = (await hist(page)).length;
    await page.click('#reopen-btn');
    const reo = await waitHist(page, 'scene:solved', h);
    check('U5 web: 정답 다시 보기 → solved without intro', reo && !(await hist(page)).slice(h).includes('scene:solved+intro'), (await hist(page)).slice(h).join(' '));
    h = (await hist(page)).length;
    await page.click('#rv-close'); await waitHist(page, 'scene:play', h);
    await noCue('처음부터 다시 풀기', async () => { await page.click('#restart-btn'); await page.waitForFunction(() => !document.querySelectorAll('#log .entry-chapter').length, null, { timeout: 8000 }); });
    h = (await hist(page)).length;
    await page.click('#giveup-btn'); await page.click('#giveup-yes');
    check('U5 web: give up → gaveup with intro', await waitHist(page, 'scene:gaveup+intro', h));
    h = (await hist(page)).length;
    await page.click('#rv-close'); await waitHist(page, 'scene:play', h);
    await noCue('다음 메뉴 from the finished screen', async () => { await page.click('#next-btn'); await sleep(800); });
    h = (await hist(page)).length;
    await page.click('#back-btn');
    check('U5 web: 메뉴판 → menu', await waitHist(page, 'scene:menu', h));
    // U4: 끄기는 두 버튼과 저장에 함께 반영되고, 새로고침 뒤에도 남는다
    await page.click('#menu-view .music-btn');
    const off = await page.evaluate(() => ({ pressed: [...document.querySelectorAll('.music-btn')].map(b => b.getAttribute('aria-pressed') + '/' + b.title), saved: localStorage.getItem('sea-turtle-soup:music') }));
    check('U4 web: turning off flips both buttons and saves off', off.pressed.every(x => x === 'false/배경음악 켜기') && off.saved === 'off', JSON.stringify(off));
    await sleep(2300);
    check('U4 web: off → context suspended after the fade', (await page.evaluate(() => window.__ac.ctx.state)) === 'suspended');
    await page.reload(); await page.waitForSelector('.music-btn'); await page.mouse.click(5, 300); await page.keyboard.press('Shift'); await sleep(500);
    const after = await page.evaluate(() => ({ made: window.__ac.made, pressed: [...document.querySelectorAll('.music-btn')].map(b => b.getAttribute('aria-pressed')), s: window.STSMusic.state() }));
    check('U4 web: after reload it stays off and gestures make no context', after.made === 0 && after.pressed.every(x => x === 'false') && !after.s.enabled, JSON.stringify(after));
    await page.click('#menu-view .music-btn');
    await page.waitForFunction(() => window.STSMusic.state().contextState === 'running' && !!window.STSMusic.controller.engine, null, { timeout: 5000 }).catch(() => {});
    const on = await page.evaluate(() => { const p = window.STSMusic.controller.engine.fadeP; return { s: window.STSMusic.state(), saved: localStorage.getItem('sea-turtle-soup:music'), dur: p.ev[p.ev.length - 1].t - p.ev[0].t }; });
    check('U4 web: turning it back on starts with a 4-second fade-in', on.s.enabled && on.s.contextState === 'running' && on.saved === 'on' && Math.abs(on.dur - 4) < 0.01, JSON.stringify(on));
    await pageErrors(page, errors, 'web');
    await ctx.close();
    await overflow(browser, BASE + '/', 'web');
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
  console.log(failed ? `MUSIC: ${failed} FAILED` : `MUSIC: ALL PASS (${results.length})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('MUSIC TEST CRASHED:', e); console.log(results.join('\n')); process.exit(1); });
