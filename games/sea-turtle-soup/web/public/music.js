/* 바다거북 스프 배경음악 「김 서린 유리」. 설계: web/docs/MUSIC.md (괄호 숫자는 절)
   아티팩트에는 tools/sync-music.js가 그대로 복사한다 */
(function (W) {
'use strict';
try {
const M = Math;
const dB = x => M.pow(10, x / 20);
const PYT = [5.865,-3.91,0,0,0,3.91,-5.865,7.82,-1.955,0,1.955,0]; // 2.1: Eb 중심 순정 5도 사슬 (cents, C..B)
const mtof = m => 440 * M.pow(2, (m - 69 + PYT[((m % 12) + 12) % 12] / 100) / 12);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const rng = a => { a >>>= 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = M.imul(t ^ (t >>> 15), t | 1); t ^= t + M.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const wpick = (w, r) => { let s = 0; for (const x of w) s += x; let x = r() * s; for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return w.length - 1; };
const frz = o => { if (o && typeof o === 'object') { Object.values(o).forEach(frz); Object.freeze(o); } return o; };
const T = f => { try { return f(); } catch (x) { return undefined; } };
const PT = x => x === 'play' || x === 'thinking';

/* 표 (2–4장) */
const CH = { // 2.2
  I: { A: [53,56,60,63], B: [53,60,63,68], keys: [63,65,68,72,75,77,80] },
  IL: { A: [56,60,65,67], keys: [65,72,75,77,79] },
  IV: { A: [53,58,61,68], B: [51,58,61,65], keys: [63,65,68,70,73,75,77,80] },
  ii: { A: [54,58,61,65], B: [54,61,65,68], keys: [63,65,70,73,75,77] },
  iii: { A: [51,56,60,65], B: [56,60,63,65], keys: [63,65,68,72,75,77,80] },
  V: { A: [54,58,61,63], B: [51,54,58,61], C: [58,61,63,68], keys: [63,66,68,70,73,75,78,80] },
  vi: { A: [53,56,61,63], B: [51,56,61,65], keys: [63,65,68,70,73,75,77,80] },
  I69: { A: [53,58,63,68], keys: [65,68,70,75,77,80] },
};
const TR = { // 2.3
  base: { I: { IV: .35, vi: .3, ii: .2, iii: .15 }, IV: { I: .4, ii: .25, vi: .2, V: .15 }, ii: { V: .35, IV: .25, I: .2, vi: .2 },
    iii: { vi: .4, IV: .35, ii: .25 }, V: { I: .45, vi: .3, IV: .25 }, vi: { IV: .4, ii: .3, iii: .15, I: .15 } },
  solved: { I: { IV: .5, I69: .3, vi: .2 }, IV: { I: .6, I69: .4 }, I69: { IV: .5, vi: .3, I: .2 }, vi: { IV: .7, I69: .3 } },
  gaveup: { vi: { IV: .5, ii: .5 }, IV: { vi: .5, ii: .5 }, ii: { vi: .6, IV: .4 } },
};
const PLAY = { tr: 'base', len: [18,30], gap: [8,22], np: [.6, .3, .1], range: [63,75], vel: [.35, .6], rest: [180,360,40,70], pad: -2, cut: 850, air: 0, home: 'I' };
const SC = { // 2.6, 3.3, 4.5, 4.6
  menu: { tr: 'base', len: [12,20], gap: [6,14], np: [.4, .4, .2], range: [63,80], vel: [.35, .6], rest: null, pad: 0, cut: 1100, air: 0, home: 'I', lyd: .35 },
  play: PLAY,
  thinking: Object.assign({}, PLAY, { gap: null }),
  solved: { tr: 'solved', len: [14,22], gap: [9,20], np: [.55, .3, .15], range: [65,77], vel: [.35, .6], rest: null, pad: -.5, cut: 1000, air: -2, home: 'I' },
  gaveup: { tr: 'gaveup', len: [18,28], gap: [10,24], np: [.7, .3, 0], range: [63,73], vel: [.3, .5], rest: [120,240,40,70], pad: -2, cut: 800, air: 1, home: 'vi' },
};
const TH = { night: { cut: .88, send: -2, rain: 1 }, day: { cut: 1, send: -4, rain: 0 } }; // 4.8
const LV = { // 3.2, 보정은 9장
  padBus: -5.6, padSend: -14, droneBus: -40, droneSend: -18, keysBus: -26.2, texBus: -34.8, texSend: -14,
  voice: [0, -1, -2, -3.5], amp: .03, pan: [-.15, .25, -.2, .25], pair: .15, trim: 4.9, breath: 3.5, swell: 3,
};
const TEX = [ // 3.6
  ['steam', 12.7, 'pink', [['bandpass', 700], ['lowpass', 2200], ['lowpass', 2200]], 0],
  ['room', 7.3, 'brown', [['lowpass', 300]], -5],
  ['rain', 9.1, 'white', [['highpass', 900], ['lowpass', 2600], ['lowpass', 2600]], -12.5],
];
const DR = [[1, 1, .011], [2, .12, .017]]; // 3.4 [배수, 진폭, LFO Hz]
const TABLES = frz({ CH, TR, SC, TH, LV, TEX, DR });
const XLOW = 57, XD = .25, XR = 1.5; // 9.6: 낮은 2도 엇갈림 (아래 음 Ab3 이하)
const VOC = {}, voc = s => VOC[s.tr + !!s.lyd] || (VOC[s.tr + !!s.lyd] = Object.keys(TR[s.tr]).concat(s.lyd ? ['IL'] : []).flatMap(id => CH[id].A.concat(CH[id].B || [])));
const rub = (k, ps) => ps.some(p => k - p === 1 || k - p === 13 || k - p === 25 || p - k === 1); // 2.2: 반음, 단9도
const SINC = new Float32Array(64), COSC = new Float32Array(64);
for (let i = 0; i < 64; i++) { SINC[i] = M.sin(M.PI / 2 * i / 63); COSC[i] = M.cos(M.PI / 2 * i / 63); }

/* Composer (7.3) */
class Composer {
  constructor(seed, scene) {
    const b = M.imul(seed >>> 0, 7919);
    this.rH = rng(b + 1); this.rK = rng(b + 2); this.rA = rng(b + 3); this.rV = rng(b + 4);
    this.scene = SC[scene] ? scene : 'menu';
    this.q = []; this.n = 0; this.until = -Infinity; this.now = 0; this.out = null;
    this.chords = []; this.cur = null; this.cn = 0; this.chain = []; this.tri = []; this.droot = null;
    this.walkT = null; this.keyT = null; this.restT = null; this.keyWait = false; this.seq = 0;
    this.kbS = 0; this.kbE = 0; this.tkS = 0; this.tkE = 0; this.calm = 0; this.restFrom = 0; this.restUntil = 0; this.lastCue = -1e9;
    this.k = { i: 0, pk: null, pool: null, last: null, hist: [], dirs: [0,0], same: 0, mot: [] };
  }
  at(t, f) {
    const k = { t, s: this.n++, f, dead: false }, q = this.q;
    let i = q.length; while (i > 0 && q[i - 1].t > t) i--;
    q.splice(i, 0, k); return k;
  }
  emit(e) { this.out.push(e); }
  tri3(r, a) { return a[0] + (a[1] - a[0]) * (r() + r()) / 2; }
  uni(r, a) { return a[0] + (a[1] - a[0]) * r(); }
  kill(k) { if (k) { k.dead = true; const i = this.q.indexOf(k); if (i >= 0) this.q.splice(i, 1); } return null; }
  start(t0) {
    const s = SC[this.scene];
    this.until = t0;
    this.at(t0, t => this.walk(t, s.home));
    this.keysFor(t0, s, true); this.restFor(t0, s);
    this.at(t0 + 9 + 6 * this.rA(), t => this.breath(t, 'steam'));
    this.at(t0 + 15 + 15 * this.rA(), t => this.breath(t, 'rain'));
    for (const L of TEX) this.at(t0, t => this.drift(t, L[0])); // 9.7-5
  }
  generate(until) {
    const out = this.out = [];
    while (this.q.length && this.q[0].t < until) { const k = this.q.shift(); if (!k.dead) { this.now = k.t; k.f.call(this, k.t); } }
    this.until = M.max(this.until, until); this.out = null;
    return out;
  }
  control(c) { // 4.2
    const t = M.max(c.t, this.until);
    if (c.kind === 'cue') { if (t - this.lastCue < 20) return false; this.lastCue = t; }
    this.at(t, u => this.ctl(u, c));
    return true;
  }
  ctl(t, c) {
    if (c.kind === 'cue') return this.chapter(t);
    const prev = this.scene, nx = c.value;
    if (prev === nx || !SC[nx]) return;
    this.scene = nx;
    const s = SC[nx];
    if (PT(prev) && PT(nx)) { // 9.7-1
      if (nx === 'thinking') { this.tkS = t; this.tkE = Infinity; } else { this.tkE = t + 4; if (this.keyWait || !this.keyT) this.resumeKeys(t, 4); }
      return;
    }
    if (PT(prev)) this.tkE = M.min(this.tkE, t + 4);
    this.seq++;
    this.keysFor(t, s); this.restFor(t, s);
    if (c.intro && nx === 'solved') return this.solvedSeq(t);
    if (c.intro && nx === 'gaveup') return this.gaveupSeq(t);
    const X = c.x || 8;
    let nt = this.walkT && !this.walkT.dead ? this.walkT.t : Infinity;
    if (nt > t + X) nt = M.max(t + X / 2 + X / 2 * this.rH(), this.cur ? this.cur.t + 10 : t);
    this.kill(this.walkT);
    this.walkT = this.at(nt, u => this.walk(u));
  }
  /* 화성 */
  voice(id) { return CH[id].B ? (this.rV() < .7 ? 'A' : 'B') : 'A'; }
  seen(c) {
    if (this.chain.length < 2) return false;
    const k = this.chain.slice(-2).concat(c[0] + c[1]).join('|'), lim = this.now - 180;
    return this.tri.some(x => x.t > lim && x.k === k);
  }
  pick(s) {
    const cur = this.cur ? this.cur.id : null, row = TR[s.tr][cur === 'IL' ? 'I' : cur];
    if (!row) return [s.home, this.voice(s.home)];
    const ids = Object.keys(row), w = ids.map(k => row[k]);
    const draw = () => { let id = ids[wpick(w, this.rH)]; if (id === 'I' && s.lyd && this.rH() < s.lyd) id = 'IL'; return [id, this.voice(id)]; };
    this.tri = this.tri.filter(x => x.t > this.now - 180);
    let c = draw();
    if (this.seen(c)) {
      w[ids.indexOf(c[0] === 'IL' ? 'I' : c[0])] *= .2; c = draw();
      if (this.seen(c)) {
        const alt = []; for (const id of ids) for (const v of (CH[id].B ? ['A', 'B'] : ['A'])) alt.push([id, v]);
        c = alt.find(a => a[0] === c[0] && a[1] !== c[1] && !this.seen(a)) || alt.find(a => !this.seen(a)) || c;
      }
    }
    return c;
  }
  walk(t, force) {
    const s = SC[this.scene], c = force ? [force, this.voice(force)] : this.pick(s);
    this.change(t, c[0], c[1], 6, 7);
    this.walkT = this.at(t + this.tri3(this.rH, s.len), u => this.walk(u));
  }
  change(t, id, v, att, rel) {
    for (const c of this.chords) this.emit({ type: 'release', t, n: c.n, rel });
    const n = ++this.cn, det = [];
    for (let i = 0; i < 8; i++) { const z = this.rV() * 2 - 1; det.push(i & 1 ? 7 + z : z * .25); } // 9.7-2
    this.emit({ type: 'chord', t, n, id, voicing: v, att, det });
    const pad = CH[id][v] || CH[id].A, was = this.cur ? CH[this.cur.id][this.cur.v] || CH[this.cur.id].A : [];
    this.out0 = was.filter(m => !pad.includes(m)); // 9.7-6
    if (att >= 5 && this.out0.some(o => pad.some(m => !was.includes(m) && M.abs(o - m) < 3 && M.min(o, m) < XLOW))) this.calm = t + 8; // 9.7-12: 엇갈림(9.6-17)으로 낮은 성부가 빈 동안 건반은 여리게
    this.chords = [{ n, id, t }]; this.cur = { id, v, t, n };
    this.chain.push(id + v); if (this.chain.length > 3) this.chain.shift();
    if (this.chain.length === 3) this.tri.push({ t, k: this.chain.join('|') });
    if (this.droot == null) { this.droot = 37; this.emit({ type: 'drone', t, root: 37, att: 8 }); } // Db2 페달 (9.6)
  }
  chapter(t) { this.seq++; this.sus(t, 4, 'I69', 4, [[65,70], [68,75], [70,75]], 16, 'I'); } // 4.4
  solvedSeq(t) { this.sus(t, 5, 'I', 5, [[65,72], [63,68], [68,75]], 15, 'I69'); } // 4.5
  sus(t, d, id, a, pairs, w, next) {
    const q = this.seq;
    this.kill(this.walkT);
    this.change(t, 'V', 'C', 3, 4); // 9.7-3
    this.at(t + d, u => { if (q === this.seq) { this.change(u, id, 'A', a, a); this.dyad(u, pairs); } });
    this.walkT = this.at(t + w, u => this.walk(u, next));
    this.block(t, t + 12);
  }
  gaveupSeq(t) { // 4.6
    this.kill(this.walkT);
    this.change(t, 'vi', 'A', 6, 6);
    this.walkT = this.at(t + this.tri3(this.rH, SC.gaveup.len), u => this.walk(u));
    this.block(t, t + 8);
  }
  /* 건반 (2.4) */
  block(a, b) { if (this.kbE > a) this.kbE = M.max(this.kbE, b); else { this.kbS = a; this.kbE = b; } this.resumeKeys(a, b - a); }
  resumeKeys(t, d) {
    if (!SC[this.scene].gap) return;
    const u = t + d + this.uni(this.rK, [0, SC[this.scene].gap[0]]); // 9.7-4
    if (this.keyWait || !this.keyT) { this.keyWait = false; this.keyT = this.at(u, this.gesture); }
    else if (this.keyT.t < t + d) { this.kill(this.keyT); this.keyT = this.at(u, this.gesture); }
  }
  keysFor(t, s, first) {
    if (!s.gap) { this.keyT = this.kill(this.keyT); this.keyWait = true; return; }
    if (this.keyWait || !this.keyT) { this.keyWait = false; this.keyT = this.at(t + this.uni(this.rK, first ? s.gap : [2, s.gap[0]]), this.gesture); }
  }
  restFor(t, s) {
    if (!s.rest) { this.restT = this.kill(this.restT); this.restUntil = 0; return; }
    if (!this.restT) this.restT = this.at(t + this.uni(this.rK, s.rest), this.rest);
  }
  rest(t) {
    const s = SC[this.scene]; this.restT = null;
    if (!s.rest) return;
    this.restFrom = t; this.restUntil = t + this.uni(this.rK, s.rest.slice(2));
    this.restT = this.at(t + this.uni(this.rK, s.rest), this.rest);
  }
  blocked(t) { return !SC[this.scene].gap || (t >= this.tkS && t < this.tkE) || (t >= this.kbS && t < this.kbE) || (t >= this.restFrom && t < this.restUntil); }
  gesture(t) {
    this.keyT = null;
    const s = this.scene === 'thinking' ? SC.play : SC[this.scene];
    if (!s.gap) { this.keyWait = true; return; }
    if (t >= this.tkS && t < this.tkE) { this.keyT = this.at(t + this.uni(this.rK, s.gap), this.gesture); return; }
    const end = t < this.restUntil && t >= this.restFrom ? this.restUntil : t < this.kbE && t >= this.kbS ? this.kbE : 0;
    if (end) { this.keyT = this.at(end + this.uni(this.rK, [0, s.gap[0]]), this.gesture); return; }
    const r = this.rK, x = r(), cnt = x < s.np[0] ? 1 : x < s.np[0] + s.np[1] ? 2 : 3;
    let tt = t, pv = 9;
    for (let i = 0; i < cnt; i++) {
      const v = M.min(pv, this.uni(r, s.vel) * [1, .8, .7][i]); pv = v;
      this.at(tt, u => this.note(u, v));
      if (i < cnt - 1) tt += .7 + .9 * r();
    }
    this.keyT = this.at(tt + this.uni(r, s.gap), this.gesture);
  }
  note(t, v) {
    if (this.blocked(t)) return;
    if (t < this.calm) v *= .5;
    const m = this.step(t);
    if (m == null) return;
    this.play(t, m, v);
    const up = this.k.pool[this.k.i + 2];
    if (this.rK() < .12 && up != null && up - m >= 3) this.at(t + .03, u => { if (!this.blocked(u)) this.play(u, up, v * .6); });
  }
  play(t, m, v) { this.emit({ type: 'note', t, midi: m, vel: v, pan: clamp((m - 69) / 12 * .35 + this.rK() * .2 - .1, -.45, .45) }); }
  dyad(t, pairs) {
    const p = pairs[M.floor(this.rK() * pairs.length) % pairs.length];
    this.play(t, p[0], .5); this.at(t + .04, u => this.play(u, p[1], .32));
  }
  step(t) {
    const K = this.k, s = SC[this.scene], q = this.walkT, x = []; // 9.7-6
    if (q && !q.dead && q.t > t && q.t - t < 3.5) x.push(...voc(s)); if (t - this.cur.t < 4.7) x.push(...this.out0);
    const P = CH[this.cur.id].keys.filter(m => m >= s.range[0] && m <= s.range[1] && !rub(m, x));
    if (!P.length) return null;
    const pk = P.join();
    if (K.pk !== pk) {
      if (K.last == null) K.i = (P.length - 1) >> 1;
      else { let b = 0; for (let i = 1; i < P.length; i++) if (M.abs(P[i] - K.last) < M.abs(P[b] - K.last)) b = i; K.i = b; }
      K.pk = pk; K.pool = P;
    }
    const c = (P.length - 1) / 2, w = [.15, .3, .1, .3, .15];
    if (K.i - c > 3) { w[0] *= 2; w[1] *= 2; } else if (c - K.i > 3) { w[3] *= 2; w[4] *= 2; }
    K.mot = K.mot.filter(x => x.t > t - 300);
    for (let tr = 0; tr < 5; tr++) {
      let st = wpick(w, this.rK) - 2;
      if (K.dirs[0] && K.dirs[0] === K.dirs[1] && M.sign(st) === K.dirs[1]) st = -st;
      const j = clamp(K.i + st, 0, P.length - 1), m = P[j], d = K.last == null ? 0 : M.sign(m - K.last);
      if (d && K.dirs[0] === d && K.dirs[1] === d) continue;
      if (m === K.last && K.same >= 2) continue;
      const key = K.hist.length >= 3 ? K.hist.slice(-3).concat(m).join() : null;
      if (key && K.mot.some(x => x.k === key)) continue;
      if (key) K.mot.push({ t, k: key });
      K.same = m === K.last ? K.same + 1 : 1;
      if (d) K.dirs = [K.dirs[1], d];
      K.hist.push(m); if (K.hist.length > 3) K.hist.shift();
      K.i = j; K.last = m;
      return m;
    }
    return null;
  }
  /* 공기 (3.6) */
  breath(t, layer) {
    const r = this.rA, st = layer === 'steam';
    this.emit({ type: 'tex', t, layer, db: (st ? -3 : -2) * r(), tau: st ? 3 : 5 });
    this.at(t + (st ? 9 + 6 * r() : 15 + 15 * r()), u => this.breath(u, layer));
  }
  drift(t, layer) {
    const r = this.rA, ramp = 20 + 20 * r();
    this.emit({ type: 'rate', t, layer, value: .98 + .04 * r(), ramp });
    this.at(t + ramp, u => this.drift(u, layer));
  }
}

/* 노드 (옛 Safari는 create*) */
const NEW = (c, C, m, o) => { try { return new W[C](c, o); } catch (x) { const n = c[m](); for (const k in o) { if (k === 'periodicWave') n.setPeriodicWave(o[k]); else if (n[k] && typeof n[k] === 'object') n[k].value = o[k]; else n[k] = o[k]; } return n; } };
const gain = (c, v) => NEW(c, 'GainNode', 'createGain', { gain: v });
const bq = (c, type, f, Q) => NEW(c, 'BiquadFilterNode', 'createBiquadFilter', { type, frequency: f, Q });
const osc = (c, w, f, det) => NEW(c, 'OscillatorNode', 'createOscillator', Object.assign(typeof w === 'string' ? { type: w } : { periodicWave: w }, { frequency: f, detune: det || 0 }));
const pan = (c, p) => (c.createStereoPanner ? NEW(c, 'StereoPannerNode', 'createStereoPanner', { pan: p }) : gain(c, 1));
const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
const off = n => T(() => n.disconnect());
/* 합류점은 입력 2개씩 (R2, 9장) */
const tree = (c, ns) => { while (ns.length > 1) { const nx = []; for (let i = 0; i < ns.length; i += 2) { if (i + 1 < ns.length) { const g = gain(c, 1); ns[i].connect(g); ns[i + 1].connect(g); nx.push(g); } else nx.push(ns[i]); } ns = nx; } return ns[0]; };
const slots = (c, k, dest) => { const s = []; for (let i = 0; i < k; i++) s.push(gain(c, 1)); tree(c, s).connect(dest); return s; };

function noise(c, seed, li, len, kind) { // 3.6, 16 kHz (9.6)
  const sr = T(() => c.createBuffer(1, 1, 16000)) ? 16000 : c.sampleRate, N = M.round(len * sr), X = M.round(.5 * sr), r = rng(M.imul(seed, 101) + li), raw = new Float32Array(N + X);
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < N + X; i++) {
    const w = r() * 2 - 1;
    if (kind === 'pink') { b0 = .99765 * b0 + w * .0990460; b1 = .96300 * b1 + w * .2965164; b2 = .57000 * b2 + w * 1.0526913; raw[i] = (b0 + b1 + b2 + w * .1848) * .2; }
    else if (kind === 'brown') { br = (br + .02 * w) / 1.02; raw[i] = 3.5 * br; }
    else raw[i] = w * .5;
  }
  const buf = c.createBuffer(1, N, sr), d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = i < X ? raw[i] * M.sqrt(i / X) + raw[N + i] * M.sqrt(1 - i / X) : raw[i];
  return buf;
}
function irNoise(c, seed) { // 3.7, 9장. 9.7-7: 노이즈 하나를 올패스 3단 두 벌에 통과시켜 L, R (크기 응답이 같다)
  const sr = c.sampleRate, len = M.round(3.5 * sr), pre = M.round(.025 * sr), fi = M.round(.01 * sr), fo = M.round(.2 * sr), h = new Float32Array(len);
  const k1 = M.pow(1200 / 5000, 1 / (3.5 * sr)), k2 = M.exp(-6.9078 / (3.4 * sr)), r = rng(M.imul(seed, 31) + 11);
  let y = 0, e = 0, fc = 5000 * M.pow(k1, pre), ex = 1, a = 0;
  for (let i = pre; i < len; i++, fc *= k1, ex *= k2) {
    if (!((i - pre) & 31)) a = 1 - M.exp(-2 * M.PI * fc / sr);
    const x = r() * 2 - 1, g = ex * (i - pre < fi ? (i - pre) / fi : 1) * (i > len - fo ? (len - i) / fo : 1);
    y += a * (x - y);
    h[i] = y * g; e += x * g * x * g;
  }
  const k = 1 / M.sqrt(e || 1); for (let i = 0; i < len; i++) h[i] *= k;
  return { h, b: c.createBuffer(2, len, sr) };
}
function irAp(o, ch) {
  const len = o.h.length, sr = o.b.sampleRate; let d = o.h;
  for (const s of ch ? [11.3, 24.7, 41.9] : [7.9, 19.3, 33.7]) { const D = M.round(s * sr / 1000), x = d; d = new Float32Array(len); for (let i = 0; i < len; i++) d[i] = -.5 * x[i] + (i >= D ? x[i - D] + .5 * d[i - D] : 0); }
  o.b.getChannelData(ch).set(d);
}
function impulse(c, seed) { const o = irNoise(c, seed); irAp(o, 0); irAp(o, 1); return o.b; }
const conv = (c, ir) => { const v = c.createConvolver(); v.normalize = false; v.buffer = ir; return v; }; // normalize는 buffer보다 먼저 (3.7)

/* 파라미터 추적 (7.5) */
class Param {
  constructor(eng, targets, v) { this.e = eng; this.ps = targets; this.v0 = v; this.ev = []; }
  val(T) {
    let x = null, v = this.v0, pt = -Infinity, pv = v;
    const f = t => (x ? x.g + (x.v - x.g) * M.exp(-(t - x.t) / x.tau) : v);
    for (const e of this.ev) {
      if (e.t > T) return e.k === 'l' ? pv + (e.v - pv) * (T - pt) / (e.t - pt) : f(T);
      if (e.k === 'x') { const s = f(e.t); x = { g: e.v, tau: e.tau, t: e.t, v: s }; pv = s; } else { x = null; v = pv = e.v; }
      pt = e.t;
    }
    return f(T);
  }
  add(k, v, t, tau) {
    this.ev.push({ k, v, t, tau }); this.e.ops++;
    for (const [p, s] of this.ps) { if (k === 's') p.setValueAtTime(v * s, t); else if (k === 'l') p.linearRampToValueAtTime(v * s, t); else p.setTargetAtTime(v * s, t, tau); }
  }
  begin(T) { // 4.2, 9장
    const v = this.val(T), nx = this.ev.find(e => e.t >= T);
    for (const [p] of this.ps) p.cancelScheduledValues(T);
    this.ev = []; this.v0 = v; this.add(nx && nx.k === 'l' ? 'l' : 's', v, T);
  }
  to(target, T, xf) { this.begin(T); this.add('x', target, T, M.max(xf, .01) / 3); }
  lin(T, pts) { this.begin(T); let v = this.val(T); for (const [t, x] of pts) { if (x == null) this.add('s', v, t); else { this.add('l', x, t); v = x; } } }
}

/* Engine (3장): 실시간과 오프라인이 같은 그래프 */
class Engine {
  constructor(ctx, o) {
    o = o || {};
    const c = this.ctx = ctx;
    this.seed = (o.seed == null ? 1 : o.seed) >>> 0;
    this.scene = SC[o.scene] ? o.scene : 'menu';
    this.theme = o.theme === 'day' ? 'day' : 'night';
    this.solo = o.solo || null;
    this.fadeIn = o.fadeIn == null ? 10 : +o.fadeIn;
    const L = this.L = Object.assign({}, LV, o.levels), pre = o.pre || {};
    this.comp = new Composer(this.seed, this.scene);
    this.live = 0; this.ops = 0; this.lastAt = 0; this.started = false; this.dead = false;
    this.pv = []; this.pend = []; this.notes = []; this.groups = new Set(); this.lfos = []; this.kn = 0; this.dn = 0;
    const S = SC[this.scene], th = TH[this.theme], vol = clamp(o.volume == null ? 1 : +o.volume, 0, 1), P = (n, v, s) => new Param(this, [[n.gain, s || 1]], v);
    // 마스터 (3.8)
    this.mIn = gain(c, 1);
    const fg = this.out = gain(c, this.fadeIn > 0 ? 0 : 1), vg = gain(c, vol);
    this.fadeP = P(fg, this.fadeIn > 0 ? 0 : 1); this.volP = P(vg, vol);
    chain(this.mIn, bq(c, 'highpass', 30, .707), bq(c, 'lowpass', 7000, .5), gain(c, dB(o.trimDb == null ? L.trim : +o.trimDb)), vg, fg, o.destination || c.destination);
    // 리버브 (3.7)
    const rv = gain(c, 1); rv.channelCount = 1; rv.channelCountMode = 'explicit';
    const cv = pre.cv || conv(c, pre.ir || impulse(c, this.seed));
    chain(rv, cv, bq(c, 'highpass', 140, .707), bq(c, 'lowpass', 4000, .707), this.mIn);
    const dry = [], wet = [];
    const bus = (k, lv, send) => { const b = gain(c, dB(lv)), s = gain(c, dB(send)); b.connect(s); if (!this.solo || this.solo === k) { dry.push(b); wet.push(s); } return [b, s]; };
    // 패드 (3.3)
    const pin = gain(c, dB(S.pad)), cut = S.cut * th.cut, lp1 = bq(c, 'lowpass', cut, .5), lp2 = bq(c, 'lowpass', cut, .5);
    this.padP = P(pin, dB(S.pad));
    chain(pin, lp1, lp2, bus('pad', L.padBus, L.padSend)[0]);
    this.padSlots = slots(c, 12, pin); this.busy = new Array(12).fill(0);
    const lfo = osc(c, 'sine', 1 / 77), dep = gain(c, .15 * cut);
    chain(lfo, dep); dep.connect(lp1.frequency); dep.connect(lp2.frequency);
    this.cutP = new Param(this, [[lp1.frequency, 1], [lp2.frequency, 1], [dep.gain, .15]], cut);
    const wow = osc(c, 'sine', .07); this.wowG = gain(c, 2); wow.connect(this.wowG);
    this.lfos.push(lfo, wow);
    const re = new Float32Array(13), im = new Float32Array(13);
    for (let n = 1; n <= 12; n++) im[n] = (n % 2 ? 1 : .6) / M.pow(n, 1.5);
    this.wave = c.createPeriodicWave(re, im);
    // 드론, 건반
    this.droneSlots = slots(c, 3, bus('drone', L.droneBus, L.droneSend)[0]);
    const kb = bus('keys', L.keysBus, th.send);
    this.keySlots = slots(c, 8, kb[0]); this.sendP = P(kb[1], dB(th.send));
    // 공기 (3.6)
    const tin = gain(c, dB(S.air)), layers = [];
    this.airP = P(tin, dB(S.air));
    tin.connect(bus('texture', L.texBus, L.texSend)[0]);
    this.tex = {};
    TEX.forEach(([name, len, kind, fl, db], li) => {
      const buf = (pre.tex && pre.tex[li]) || noise(c, this.seed, li, len, kind), mg = c.createChannelMerger(2), br = gain(c, 1), lv = gain(c, dB(db));
      const srcs = [0,1].map(ch => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(mg, 0, ch); return s; });
      let n = mg; for (const [ty, f] of fl) n = chain(n, bq(c, ty, f, .5));
      chain(n, br, lv);
      if (name === 'rain') { const tg = gain(c, th.rain); lv.connect(tg); layers.push(tg); this.rainP = P(tg, th.rain); } else layers.push(lv);
      this.tex[name] = { srcs, br, len: buf.duration };
    });
    tree(c, layers).connect(tin);
    if (dry.length) { tree(c, dry).connect(this.mIn); tree(c, wet).connect(rv); }
  }
  at(t) { t = t == null ? this.ctx.currentTime : +t; this.lastAt = t = M.max(t, this.lastAt); return t; }
  start(at) {
    if (this.started) return this;
    at = this.at(at); this.started = true; this.t0 = at;
    if (this.fadeIn > 0) this.fade(1, this.fadeIn, at);
    this.lfos.forEach(o => this.run(o, at));
    for (const k in this.tex) { const L = this.tex[k]; L.srcs.forEach((s, ch) => { s.playbackRate.setValueAtTime(1, at); s.start(at, ch ? L.len / 2 : 0); }); }
    this.comp.start(at);
    return this;
  }
  run(o, t, stop, fn) { o.start(t); if (stop != null) o.stop(stop); this.live++; o.onended = () => { this.live--; off(o); if (fn) fn(); }; }
  group(g, t, stop, fn, done) { // 7.6
    let left = g.oscs.length;
    this.groups.add(g);
    g.oscs.forEach(o => this.run(o, t, stop, () => { if (fn) fn(o); if (--left === 0) { g.nodes.forEach(off); this.groups.delete(g); g.done = true; if (done) done(); } }));
  }
  scheduleUntil(t) {
    if (!this.started || this.dead) return;
    const now = this.ctx.currentTime, min = now + .05, lapsed = this.comp.until > this.t0 && this.comp.until < min; // 7.4, 9.6
    for (const e of this.comp.generate(t)) {
      if (lapsed && e.t < min) { if (e.type === 'note') continue; e.t = min; }
      if (this.pend.length && e.t > this.pend[0].t) this.flush();
      if (e.type === 'release') this.pend.push(e); else this['_' + e.type](e);
    }
    this.flush();
    if (this.notes.length > 16) this.notes = this.notes.filter(n => n.end > now);
    if (this.pv.length > 16) this.pv = this.pv.filter(v => !v.done);
  }
  flush() { for (const r of this.pend) this.pv.forEach(v => { if (v.n === r.n) this.rel(v, r.t, v.fast && v.fast < r.rel ? v.fast : r.rel); }); this.pend = []; }
  _chord(e) { // 공통음은 이어 받고 (9장), 낮은 2도로 겹칠 성부는 엇갈려 넘긴다 (9.6)
    const c = this.ctx, t = e.t, C = CH[e.id], ns = C[e.voicing] || C.A, out = this.pend.map(r => r.n);
    const old = this.pv.filter(v => v.relT == null && !v.done && out.includes(v.n));
    ns.forEach((m, k) => {
      const lv = this.L.amp * dB(this.L.voice[k]), pp = this.L.pan[k];
      const held = old.find(v => v.m === m && v.n !== e.n);
      if (held) { held.n = e.n; held.vg.gain.setTargetAtTime(lv, t, e.att / 3); if (held.pn.pan) held.pn.pan.setTargetAtTime(pp, t, e.att / 3); return; }
      const cl = old.find(v => v.n !== e.n && !ns.includes(v.m) && M.abs(v.m - m) < 3 && M.min(v.m, m) < XLOW), st = cl && e.att >= 5 ? t + XD * e.att : t;
      if (cl) cl.fast = e.att >= 5 ? XD * e.att + XR : 1.5; // 9.7-3
      let si = 0; for (let i = 1; i < 12; i++) if (this.busy[i] < this.busy[si]) si = i;
      this.busy[si]++;
      const vg = gain(c, lv), pn = pan(c, pp), att = gain(c, 0), rel = gain(c, 1), v = { m, n: e.n, vg, pn, rel, oscs: [], nodes: [vg, pn, att, rel], relT: null, done: false };
      chain(vg, pn, att, rel, this.padSlots[si]);
      for (let j = 0; j < 2; j++) {
        const o = osc(c, this.wave, mtof(m), e.det[2 * k + j]);
        this.wowG.connect(o.detune);
        if (j) { const pg = gain(c, this.L.pair); chain(o, pg, vg); v.nodes.push(pg); } else o.connect(vg);
        v.oscs.push(o);
      }
      att.gain.setValueCurveAtTime(SINC, st, e.att);
      this.group(v, st, null, o => T(() => this.wowG.disconnect(o.detune)), () => { this.busy[si]--; });
      this.pv.push(v);
    });
    const live = []; for (const v of this.pv) if (v.relT == null && !v.done && !out.includes(v.n) && !live.includes(v.n)) live.push(v.n);
    if (live.length > 3) this.pv.forEach(v => { if (v.n === live[0]) this.rel(v, t, 3); });
  }
  rel(g, t, d) { // 6.8-6
    if (g.relT != null) return;
    g.relT = t; g.end = t + d;
    g.rel.gain.setValueCurveAtTime(COSC, t, d);
    g.oscs.forEach(o => T(() => o.stop(t + d + .1)));
  }
  _drone(e) {
    const c = this.ctx, t = e.t, f = mtof(e.root), att = gain(c, 0), rel = gain(c, 1), g = { rel, oscs: [], nodes: [att, rel], relT: null };
    chain(att, rel, this.droneSlots[this.dn++ % 3]);
    DR.forEach(([mul, a, lf]) => {
      const o = osc(c, 'sine', f * mul), og = gain(c, a), l = osc(c, 'sine', lf), lg = gain(c, .16 * a);
      chain(l, lg); lg.connect(og.gain); chain(o, og, att);
      g.oscs.push(o, l); g.nodes.push(og, lg);
    });
    att.gain.setValueCurveAtTime(SINC, t, e.att);
    this.group(g, t);
  }
  _note(e) { // 3.5
    const c = this.ctx, t = e.t, f = mtof(e.midi), v = e.vel, act = this.notes.filter(n => n.end > t);
    if (act.length >= 8) { const o = act[0], og = o.env.gain; og.cancelScheduledValues(t); og.setTargetAtTime(0, t, .1); og.setValueAtTime(0, t + .45); o.end = t + .5; o.oscs.forEach(x => T(() => x.stop(t + .5))); }
    const peak = M.pow(v, 1.5) * (e.midi > 72 ? .708 : 1);
    const car = osc(c, 'sine', f), mod = osc(c, 'sine', f), ix = gain(c, (.8 + .8 * v) * f), env = gain(c, 0), lp = bq(c, 'lowpass', M.min(2200, 4.5 * f), .3), pn = pan(c, e.pan);
    chain(mod, ix); ix.connect(car.frequency); chain(car, env, lp, pn, this.keySlots[this.kn++ % 8]);
    ix.gain.setTargetAtTime(.15 * f, t, .35);
    const g = env.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + .02); g.setTargetAtTime(.55 * peak, t + .02, .15);
    g.setTargetAtTime(1e-4, t + .45, 2.2); g.setTargetAtTime(0, t + 4.2, .6); g.setValueAtTime(0, t + 8); // 9장
    const n = { env, oscs: [car, mod], nodes: [ix, env, lp, pn], end: t + 8.2 };
    this.notes.push(n); this.group(n, t, t + 8.2);
  }
  _tex(e) { const L = this.tex[e.layer]; if (L) L.br.gain.setTargetAtTime(dB(e.db), e.t, e.tau); }
  _rate(e) { const L = this.tex[e.layer]; if (L) L.srcs.forEach(s => s.playbackRate.linearRampToValueAtTime(e.value, e.t + e.ramp)); }
  setScene(name, o) {
    o = o || {};
    if (!SC[name] || name === this.scene) return;
    const at = this.at(o.at), prev = this.scene, fin = name === 'solved' || name === 'gaveup', intro = fin && o.intro !== false, X = fin ? 6 : 8;
    this.scene = name;
    this.comp.control({ t: at, kind: 'scene', value: name, intro, x: X });
    if (PT(prev) && PT(name)) return;
    const S = SC[name], k = TH[this.theme].cut, pb = dB(S.pad);
    if (intro && name === 'solved') { // 4.5
      const cb = SC.play.cut * k;
      this.airP.to(dB(S.air), at, 6);
      this.padP.lin(at, [[at + 2, null], [at + 7, pb * dB(this.L.swell)], [at + 10, null], [at + 17, pb]]);
      this.cutP.lin(at, [[at + 2, null], [at + 7, cb * 1.6], [at + 10, null], [at + 17, S.cut * k]]);
      return;
    }
    this.padP.to(pb, at, X); this.cutP.to(S.cut * k, at, X); this.airP.to(dB(S.air), at, X);
  }
  cue(kind, o) { // 4.4
    if (kind !== 'chapter') return false;
    const at = this.at(o && o.at);
    if (!this.comp.control({ t: at, kind: 'cue', value: kind })) return false;
    const S = SC[this.scene], pb = dB(S.pad), cb = S.cut * TH[this.theme].cut, ab = dB(S.air);
    this.padP.lin(at, [[at + 6, pb * dB(this.L.breath)], [at + 7, null], [at + 12, pb]]); // 9.7-12
    this.cutP.lin(at, [[at + 6, cb * 1.6], [at + 12, cb]]);
    this.airP.lin(at, [[at + 3, ab * dB(-3)], [at + 6, null], [at + 11, ab]]);
    return true;
  }
  setTheme(name, o) {
    name = name === 'day' ? 'day' : 'night';
    if (name === this.theme) return;
    const at = this.at(o && o.at), th = TH[name];
    this.theme = name;
    this.cutP.to(SC[this.scene].cut * th.cut, at, 8); this.rainP.to(th.rain, at, 8); this.sendP.to(dB(th.send), at, 8);
  }
  setVolume(v, o) { o = o || {}; this.volP.to(clamp(+v || 0, 0, 1), this.at(o.at), o.seconds == null ? 1 : o.seconds); }
  fade(to, sec, at, from) { // 9.7-8
    at = this.at(at); to = clamp(to, 0, 1);
    if (from != null) { this.fadeP.begin(at); this.fadeP.add('s', from, at); }
    const v = this.fadeP.val(at);
    if (to > v) { const p = []; for (let i = 1; i <= 12; i++) { const s = M.sin(M.PI / 2 * i / 12); p.push([at + sec * i / 12, v + (to - v) * s * s]); } this.fadeP.lin(at, p); }
    else this.fadeP.to(to, at, sec * .75);
  }
  dispose(at) {
    if (this.dead) return;
    at = this.at(at); this.fadeP.to(0, at, 1.5); this.dead = true;
    const end = at + 2.1, stop = o => T(() => o.stop(end));
    this.lfos.forEach(stop); this.groups.forEach(g => g.oscs.forEach(stop));
    for (const k in this.tex) this.tex[k].srcs.forEach(s => { stop(s); s.onended = () => off(s); });
    if (typeof setTimeout === 'function') setTimeout(() => off(this.out), M.max(0, end - this.ctx.currentTime) * 1000 + 300);
  }
  get state() { const now = this.ctx.currentTime; return { scene: this.scene, theme: this.theme, chord: this.comp.cur ? this.comp.cur.id : null, voices: this.live, notes: this.notes.filter(n => n.end > now).length }; }
}

/* 오프라인 렌더 (7.2) */
async function render(o) {
  o = o || {};
  const sr = o.sampleRate || 48000, dur = o.duration || 100, OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext, ctx = new OAC(2, M.round(sr * dur), sr);
  const evs = (o.events || []).slice().sort((a, b) => a.t - b.t), first = evs[0] && evs[0].scene && evs[0].t <= 0 ? evs.shift() : null;
  const e = new Engine(ctx, { seed: o.seed == null ? 1 : o.seed, scene: first ? first.scene : 'play', theme: o.theme, fadeIn: o.fadeIn == null ? 10 : o.fadeIn, solo: o.solo, trimDb: o.trimDb, volume: o.volume, levels: o.levels });
  e.start(0);
  for (const v of evs) {
    if (o.lead) e.scheduleUntil(v.t + o.lead); // 실시간 예약 흉내 (9.6)
    if (v.scene) e.setScene(v.scene, { at: v.t, intro: v.intro !== false });
    else if (v.cue) e.cue(v.cue, { at: v.t });
    else if (v.theme) e.setTheme(v.theme, { at: v.t });
    else if (v.volume != null) e.setVolume(v.volume, { at: v.t });
  }
  e.scheduleUntil(dur);
  const t0 = Date.now(), buf = await ctx.startRendering();
  render.lastMs = Date.now() - t0; render.lastEngine = e;
  return buf;
}

/* 페이지 컨트롤러 (4.1, 6장) */
const KEY = 'sea-turtle-soup:music', SPK = '<path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/>';
const SVG = `<svg class="i-on" viewBox="0 0 24 24" aria-hidden="true">${SPK}<path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.2 6.8a7.4 7.4 0 0 1 0 10.4"/></svg><svg class="i-off" viewBox="0 0 24 24" aria-hidden="true">${SPK}<path d="M16 9.6l4.6 4.8M20.6 9.6L16 14.4"/></svg>`;
const OFF = '.music-btn[aria-pressed="false"]';
const CSS = `.music-btn .i-off{display:none}${OFF} .i-on{display:none}${OFF} .i-off{display:block}${OFF}{color:var(--muted)}.music-btn[aria-disabled="true"]{opacity:.45}@media (max-width:389px){.music-btn{width:36px;height:36px}#play-view .tb-right{gap:2px}#play-view .clock{padding:0 8px}}@media (max-width:359px){.topnav .beta-chip{display:none}}`;
const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'], OPT = { capture: true, passive: true };
const $ = s => document.querySelector(s);
const vis = el => !!el && !el.hidden && !el.closest('[hidden]');
const LEAD = .02; // 9.7-10
const nowS = () => (W.performance ? performance.now() : Date.now()) / 1000;
const quiet = p => { if (p && p.catch) p.catch(() => {}); return p; };
let told = false;
const info = err => { if (!told) { told = true; T(() => console.info('[배경음악] 꺼 둡니다:', err && err.message ? err.message : err)); } };
const AC = W.AudioContext || W.webkitAudioContext;
const later = (f, ms) => (W.requestIdleCallback ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, ms)); // 9.6: 게임이 이 동작을 다 그린 뒤 빈 시간에

class Controller {
  constructor() {
    this.history = []; this.ctx = null; this.engine = null; this.muted = false;
    this.loopT = 0; this.offT = 0; this.mutedAt = 0; this.mutedCt = 0; this.ran = false; this.jt = 0; this.bt = 0; this.armed = false; this.broken = false; this.held = false;
    this.seen = new Set(); this.lastCue = -1e9; this.playVis = false; this.playSince = 0;
    this.pref = T(() => localStorage.getItem(KEY)) === 'off' ? 'off' : 'on';
    this.onG = e => this.gesture(e);
    this.prev = this.snap(); this.markPlay();
    this.log('scene', this.prev.scene, false); this.log('theme', this.prev.theme);
    if (!$('#sts-music-style')) { const st = document.createElement('style'); st.id = 'sts-music-style'; st.textContent = CSS; document.head.appendChild(st); }
    this.buttons(); this.observe();
    if (this.pref === 'on') this.arm();
    document.addEventListener('visibilitychange', () => (document.hidden ? this.mute() : this.wakeUp()));
    W.addEventListener('pagehide', () => this.sleep());
    W.addEventListener('pageshow', e => { if (e.persisted) this.wakeUp(); });
  }
  log(kind, value, intro) { const h = { t: M.round(nowS() * 1000) / 1000, kind, value }; if (intro !== undefined) h.intro = intro; this.history.push(h); if (this.history.length > 200) this.history.shift(); }
  snap() { // 4.1
    const rv = vis($('#reveal')), t = document.documentElement.getAttribute('data-theme'), txt = s => { const el = $(s); return el ? el.textContent : ''; };
    const scene = rv ? (vis($('#rv-seal')) ? 'solved' : 'gaveup') : vis($('#play-view')) ? ($('#log .pending') ? 'thinking' : 'play') : 'menu';
    const dark = t ? t === 'dark' : !!(W.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    return { scene, rv, theme: dark ? 'night' : 'day', key: txt('#p-no') + '|' + txt('#p-title'), n: document.querySelectorAll('#log .entry-chapter').length };
  }
  markPlay() { const v = vis($('#play-view')); if (v && !this.playVis) this.playSince = nowS(); this.playVis = v; }
  judge() {
    const s = this.snap(), p = this.prev, t = nowS(), c = this.ctx, e = this.pref === 'on' ? this.engine : null, at = c ? c.currentTime + LEAD : 0; // 9.7-11
    const live = !!e && !this.muted && c.state === 'running'; // 9.6
    this.markPlay();
    try {
      if (s.theme !== p.theme) { this.log('theme', s.theme); if (e) e.setTheme(s.theme, { at }); }
      if (s.scene !== p.scene) {
        let intro = false;
        if (s.scene === 'solved' || s.scene === 'gaveup') { const k = s.key + '|' + s.scene; intro = !this.seen.has(k); this.seen.add(k); }
        this.log('scene', s.scene, intro);
        if (e) e.setScene(s.scene, { at, intro: intro && live });
      }
      if (PT(p.scene) && PT(s.scene) && s.key === p.key && s.n === p.n + 1 && t - this.playSince >= 1.5 && !s.rv && t - this.lastCue >= 20) {
        this.lastCue = t; this.log('cue', 'chapter');
        if (live) e.cue('chapter', { at });
      }
    } catch (err) { info(err); }
    this.prev = s;
  }
  observe() {
    const kick = () => { clearTimeout(this.jt); this.jt = setTimeout(() => this.judge(), 250); };
    const mo = new MutationObserver(kick), obs = (el, o) => { if (el) mo.observe(el, o); };
    obs(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    ['#menu-view', '#play-view', '#reveal', '#rv-seal'].forEach(s => obs($(s), { attributes: true, attributeFilter: ['hidden'] }));
    obs($('#log'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    ['#p-no', '#p-title'].forEach(s => obs($(s), { childList: true, characterData: true, subtree: true }));
    T(() => { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', kick); else mq.addListener(kick); });
  }
  buttons() { // 6.3
    document.querySelectorAll('.theme-btn').forEach(tb => {
      const pr = tb.previousElementSibling;
      if (pr && pr.classList.contains('music-btn')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'icon-btn music-btn'; b.setAttribute('aria-label', '배경음악'); b.innerHTML = SVG;
      b.addEventListener('click', () => this.toggle());
      tb.parentNode.insertBefore(b, tb);
    });
    this.sync();
  }
  sync() { // 9.7-13
    const x = this.broken, on = this.pref === 'on' && !x;
    document.querySelectorAll('.music-btn').forEach(b => { b.setAttribute('aria-pressed', String(on)); b.title = x ? '배경음악을 재생할 수 없어요' : on ? (this.ran ? '배경음악 끄기' : '배경음악 끄기 (화면을 누르면 재생돼요)') : '배경음악 켜기'; if (x) b.setAttribute('aria-disabled', 'true'); });
  }
  toggle() {
    if (this.broken) return;
    this.pref = this.pref === 'on' ? 'off' : 'on';
    T(() => localStorage.setItem(KEY, this.pref));
    this.sync(); this.log('state', this.pref);
    if (this.pref === 'on') {
      this.arm(); if (!document.hidden) this.wake(4);
      const e = this.engine; if (e) T(() => { const at = this.ctx.currentTime + LEAD; e.setTheme(this.prev.theme, { at }); e.setScene(this.prev.scene, { at, intro: false }); });
    } else { this.disarm(); this.mute(); }
  }
  arm() { if (!this.armed) { this.armed = true; GESTURES.forEach(g => document.addEventListener(g, this.onG, OPT)); } }
  disarm() { if (this.armed) { this.armed = false; GESTURES.forEach(g => document.removeEventListener(g, this.onG, OPT)); } }
  gesture(e) { // 9.6
    if (!e.isTrusted || (e.type === 'pointerdown' && e.pointerType && e.pointerType !== 'mouse')) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    const t = e.target;
    if (t && t.closest && t.closest('.music-btn')) return;
    if (this.pref === 'on' && !document.hidden) this.wake(10);
  }
  wake(fadeSec) { // 6.2
    if (this.broken) return;
    try {
      if (!this.ctx) {
        T(() => { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; });
        this.ctx = T(() => new AC({ latencyHint: 'playback' })) || new AC();
        this.ctx.onstatechange = () => this.onState();
      }
      const c = this.ctx, z = this.from0(), p = T(() => quiet(c.resume()));
      T(() => { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.onended = () => off(s); s.start(0); });
      clearTimeout(this.offT);
      if (!this.engine) this.build(fadeSec);
      else if (this.muted) this.engine.fade(1, 4, z === 0 ? c.currentTime : c.currentTime + LEAD, z);
      this.muted = false; this.loop();
      const done = () => { if (c.state === 'running') this.disarm(); };
      done(); if (p && p.then) p.then(done, () => {});
    } catch (err) { this.fail(err); }
  }
  build(fadeSec) { // 9.6: 뒤 태스크에서 하나씩
    if (this.bt) return;
    const c = this.ctx, seed = (Date.now() ^ (M.random() * 4294967296)) >>> 0, pre = { tex: [] };
    const jobs = TEX.map((L, i) => () => { pre.tex[i] = noise(c, seed, i, L[1], L[2]); });
    let ir, ne; // 9.7-14: 임펄스 노이즈, L, R, 컨볼버, 그래프, 시작을 따로
    jobs.push(() => { ir = irNoise(c, seed); }, () => irAp(ir, 0), () => irAp(ir, 1), () => { pre.cv = conv(c, ir.b); }, () => { ne = new Engine(c, { seed, scene: this.prev.scene, theme: this.prev.theme, fadeIn: fadeSec, pre }); }, () => {
      const e = this.engine = ne, at = c.currentTime + .05;
      e.start(at); e.setTheme(this.prev.theme, { at }); e.setScene(this.prev.scene, { at, intro: false }); this.log('state', 'start'); // 두 조각 사이에 바뀐 장면
      if (document.hidden) this.mute(); else this.loop();
    });
    const step = () => {
      this.bt = 0;
      if (this.pref !== 'on') { T(() => quiet(c.suspend())); return; }
      try { jobs.shift()(); } catch (err) { return this.fail(err); }
      if (jobs.length) this.bt = later(step, 0);
    };
    this.bt = later(step, 250);
  }
  fail(err) { info(err); this.broken = true; this.disarm(); this.sync(); const c = this.ctx; if (c) T(() => quiet(c.suspend())); }
  from0() { // 9.7-8
    const c = this.ctx;
    return this.muted && !!c && (c.state !== 'running' || (nowS() - this.mutedAt) - (c.currentTime - this.mutedCt) > .5) ? 0 : null;
  }
  onState() { // 6.8-3
    const c = this.ctx, e = this.engine; if (!c) return;
    this.log('state', c.state);
    const on = this.pref === 'on' && !this.muted;
    if (c.state === 'running') { if (!this.ran) { this.ran = true; this.sync(); } this.disarm(); if (on) { if (this.held && e) T(() => e.fade(1, 4, c.currentTime, 0)); this.held = false; this.loop(); } }
    else if (on && !document.hidden) { this.arm(); if (e && !this.held) { this.held = true; T(() => { const t = e.at(c.currentTime); e.fadeP.begin(t); e.fadeP.add('s', 0, t); }); } }
  }
  loop() { // 7.4
    if (this.loopT) return;
    const tick = () => {
      this.loopT = 0;
      const c = this.ctx;
      if (this.muted || !this.engine || this.pref !== 'on' || c.state !== 'running') return;
      try { this.engine.scheduleUntil(c.currentTime + 1.5); } catch (err) { info(err); return; }
      this.loopT = setTimeout(tick, 200);
    };
    tick();
  }
  mute() { // 6.3, 6.6
    const c = this.ctx, e = this.engine;
    if (c && e && !this.muted && c.state === 'running') T(() => e.scheduleUntil(c.currentTime + 3.2)); // 9.7-9
    clearTimeout(this.loopT); this.loopT = 0;
    if (!c || !e || this.muted) { this.muted = this.muted || !!e; return; }
    this.muted = true; this.mutedAt = nowS(); this.mutedCt = c.currentTime;
    T(() => e.fade(0, 1.2, c.currentTime + LEAD));
    clearTimeout(this.offT);
    this.offT = setTimeout(() => { if (this.muted) T(() => quiet(c.suspend())); }, 1900);
  }
  sleep() {
    const c = this.ctx, e = this.engine; if (!c || !e) return;
    clearTimeout(this.loopT); this.loopT = 0; this.muted = true; this.mutedAt = nowS(); this.mutedCt = c.currentTime;
    T(() => { e.fadeP.to(0, e.at(c.currentTime + LEAD), .05); quiet(c.suspend()); });
  }
  wakeUp() {
    const c = this.ctx, e = this.engine;
    if (!c || !e || this.pref !== 'on' || document.hidden) return;
    clearTimeout(this.offT);
    const z = this.from0(), p = T(() => c.resume());
    if (c.state !== 'running') this.arm();
    T(() => e.fade(1, 4, z === 0 ? c.currentTime : c.currentTime + LEAD, z));
    this.muted = false; this.loop();
    if (p && p.then) p.then(() => { if (c.state !== 'running') this.arm(); }, () => this.arm());
  }
}

const prior = W.STSMusic;
const API = {
  version: '1.0.0', supported: !!AC, TABLES, Composer, Engine, Param, render, controller: null,
  state() { const c = API.controller; return { enabled: !!c && c.pref === 'on' && !c.broken, scene: c ? c.prev.scene : null, contextState: c && c.ctx ? c.ctx.state : 'none', voices: c && c.engine ? c.engine.live : 0, muted: !!(c && c.muted) }; },
};
if (prior && prior.controller) return;
W.STSMusic = API;
if (typeof document !== 'undefined' && AC && W.STS_MUSIC_AUTOSTART !== false) {
  const go = () => { try { if (!API.controller && document.getElementById('menu-view')) API.controller = new Controller(); } catch (err) { info(err); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
} catch (err) { try { console.info('[배경음악] 꺼 둡니다:', err && err.message); } catch (x) {} }
})(typeof window !== 'undefined' ? window : globalThis);
