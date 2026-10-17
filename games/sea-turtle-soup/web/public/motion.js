/* 바다거북 스프 — 모션 (docs/MOTION.md). 의존성 없음. CSS를 넣고 DOM을 관찰만 합니다(게임 로직·포커스·hidden·aria·글자는 그대로, 1.10).
   STS_MOTION='off' 끔, 'force' 자동화에서도 메뉴 리빌·표지 인사(1.9). 전역은 window.STSMotion 하나. */
(() => {
'use strict';
const W = window, D = document, R = D.documentElement;
if (W.STSMotion || W.STS_MOTION === 'off' || !W.MutationObserver || !W.matchMedia) return;
const P = performance, now = () => P.now(), t0 = now(), $ = s => D.querySelector(s), $$ = (s, e) => [...(e || D).querySelectorAll(s)];
const cl = e => e.classList, has = (e, c) => !!e && cl(e).contains(c), later = setTimeout, raf = f => requestAnimationFrame(f), mq = q => matchMedia(q);
const CAP = { capture: true, passive: true }, IN = ['pointerdown', 'keydown', 'wheel', 'touchstart'], HID = { attributes: true, attributeFilter: ['hidden'] };
const AUTO = W.STS_MOTION === 'force' || !navigator.webdriver, S = { max: {}, n: {}, err: [], vt: 0 }, MOS = [], IOS = [];
let dead = false;
const n1 = k => { S.n[k] = (S.n[k] || 0) + 1; };
const run = (m, f) => { try { return f(); } catch (e) { if (S.err.length < 20) S.err.push(m + ': ' + e.message); } };
const mo = (m, f, ts) => { // 묶음당 한 번, 최종 DOM만. measure ≤ 2 ms(4.2)
  const o = new MutationObserver(() => {
    if (dead) return;
    const t = now(); run(m, f);
    const d = now() - t; if (d > (S.max[m] || 0)) S.max[m] = d;
    run('measure', () => { P.clearMeasures('sts-motion:' + m); P.measure('sts-motion:' + m, { start: t }); });
  });
  ts.forEach(([e, x]) => e && o.observe(e, x)); MOS.push(o); return o;
};
const io = (f, o) => { const x = new IntersectionObserver(f, o); IOS.push(x); return x; };
const moment = type => later(() => run('moment', () => D.dispatchEvent(new CustomEvent('sts:moment', { detail: { type } })))); // P2-10, 다음 태스크에
const fade = e => run('fade', () => e && e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })); // reduced: 네 곳만(1.7)
const TM = new WeakMap(), tmp = (e, c, ms) => { if (!e) return; let m = TM.get(e); if (!m) TM.set(e, m = {}); clearTimeout(m[c]); cl(e).add(c); m[c] = later(() => cl(e).remove(c), ms); }; // 요소·클래스마다 타이머 하나
const EL = {}, txt = s => { const e = EL[s] || (EL[s] = $(s)); return e ? e.textContent : ''; }; // 바뀌지 않는 요소는 한 번만 찾음

/* CSS (~ = ".m-on "). 키프레임은 시작 쪽만: 끝 상태는 기본 스타일(1.7) */
const O = 'var(--m-out) both';
const CSS = `:root{--m-out:cubic-bezier(.2,.8,.2,1);--m-std:cubic-bezier(.4,0,.2,1);--m-emph:cubic-bezier(.05,.7,.1,1);--m-spring:cubic-bezier(.34,1.56,.64,1);--m-sine:cubic-bezier(.37,0,.63,1);--m-hex:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)}
@keyframes m-fade{from{opacity:0}}@keyframes m-fade-up{from{opacity:0;transform:translateY(8px)}}@keyframes m-fade-up-sm{from{opacity:0;transform:translateY(6px)}}@keyframes m-pop{from{opacity:0;transform:scale(.96)}}@keyframes m-badge{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.06)}}@keyframes m-draw{from{stroke-dashoffset:30}}@keyframes m-tag{from{opacity:0;transform:translateX(-6px)}}@keyframes m-tick{40%{transform:translateY(-3px)}}@keyframes m-bub{from{opacity:0;transform:translateY(10px) scale(.98)}}
@media (prefers-reduced-motion:reduce){~.m-wisp{opacity:.6}}
~.m-pref::before{content:'';width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1.5px}~.m-pref[aria-pressed=true]::before{background:currentColor;box-shadow:inset 0 0 0 1.5px,inset 0 0 0 3.5px var(--ground)}
~.cover .lamp{transform-origin:50% -320px;will-change:transform;animation:m-sway 9s var(--m-sine) infinite alternate}@keyframes m-sway{from{transform:rotate(-.5deg)}to{transform:rotate(.5deg)}}
~.bowl .steam{display:none}~.m-steam{position:absolute;left:50%;bottom:58px;width:160px;height:52px;margin-left:-80px;pointer-events:none}@media (max-width:599px){~.m-steam{bottom:46px;width:128px;height:42px;margin-left:-64px}}
~.m-wisp{position:absolute;bottom:0;width:14px;height:44px;opacity:0;will-change:transform,opacity;animation:m-wisp 6.6s var(--m-sine) infinite}~.m-wisp svg{display:block;width:100%;height:100%;overflow:visible;fill:none;stroke:var(--faint);stroke-width:3;stroke-linecap:round;filter:blur(1.5px)}
~.m-wisp.w1{left:calc(37.5% - 7px)}~.m-wisp.w2{left:calc(50% - 7px);animation-duration:7.4s;animation-delay:-2.4s}~.m-wisp.w2 svg{transform:scaleX(-1)}~.m-wisp.w3{left:calc(62.5% - 7px);animation-duration:6s;animation-delay:-4.2s}
@keyframes m-wisp{0%{opacity:0;transform:translate3d(0,10px,0) scale(.9,.8)}30%{opacity:.85;transform:translate3d(1.5px,-4px,0) scale(1,1)}65%{opacity:.4;transform:translate3d(-2px,-16px,0) scale(1.05,1.08)}100%{opacity:0;transform:translate3d(1px,-28px,0) scale(1.1,1.15)}}
~.ft-art::before{animation:m-glow 7s var(--m-sine) infinite alternate}@keyframes m-glow{from{opacity:.75}}
.m-on:is(.m-paused,.m-scrolling) .m-amb,.m-on:is(.m-paused,.m-scrolling) .cover .lamp,~.cover:is(.m-off,.m-idle) .m-amb,~.cover:is(.m-off,.m-idle) .lamp,.m-on:is(.m-paused,.m-scrolling) .cover::before,.m-on:is(.m-paused,.m-scrolling) .ft-art::before,~.cover:is(.m-off,.m-idle)::before,~#featured:is(.m-off,.m-idle) .ft-art::before{animation-play-state:paused!important}
~.typing i{animation:m-typing 1.4s var(--m-sine) infinite}~.typing i+i{animation-delay:.18s}~.typing i+i+i{animation-delay:.36s}~#convo.m-long .pending .typing i{animation-duration:2.4s}@keyframes m-typing{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-2px)}}
~#log :is(.pending,.fresh.by-host) .msg-out .bubble{animation:m-lift .3s ${O};transform-origin:100% 100%}~#log .fresh:not(.by-host) .msg-out .bubble{animation:none}@keyframes m-lift{from{opacity:0;transform:translateY(12px) scale(.96)}}
~#log .fresh .m-morph{animation:m-morph .24s var(--m-std) backwards}~#log .fresh.by-host .reply-bubble{animation:m-pop .24s .12s ${O};transform-origin:0 0}
~#log .fresh .stamp{animation:m-badge .42s var(--m-spring) both}~#log .fresh .stamp .ic path,~#log .fresh .stamp .ic circle{stroke-dasharray:30;animation:m-draw .32s .16s ${O}}~#log .fresh .stamp .ic .fill{animation:m-fade .24s .16s both}~#log .fresh .entry-note{animation:m-fade .2s .06s ${O}}
@keyframes m-morph{from{clip-path:inset(0 calc(100% - 68px) calc(100% - 44px) 0 round 20px 20px 20px 6px)}to{clip-path:inset(0 round 20px 20px 20px 6px)}}
~#log .fresh .entry-hit{animation:m-tag .24s .06s ${O}}~#log .fresh .entry-hit::before{animation:m-hex-fill .48s .12s var(--m-spring) both}
~#log .fresh .entry-hit::after,~#goal.m-up::after{content:'';width:12px;height:11px;clip-path:var(--m-hex);background:var(--lamp-bright);opacity:0;pointer-events:none;animation:m-hex-ring .64s .24s var(--m-out) forwards}
~#log .fresh .entry-hit::after{order:-1;flex:none;margin-right:-18px}~#goal.m-up::after{position:absolute;left:0;top:50%;margin-top:-5.5px;animation-delay:.6s}
@keyframes m-hex-fill{0%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1.25)}}@keyframes m-hex-pop{60%{transform:scale(1.25)}}@keyframes m-hex-ring{from{opacity:.55;transform:none}to{opacity:0;transform:scale(2.4)}}
~#goal{position:relative}~#goal.m-up::before{animation:m-hex-pop .48s .48s var(--m-spring)}~#goal b.m-r{animation:m-roll .3s ${O}}~.goal .roll.go b{animation:none}@keyframes m-roll{from{transform:translateY(60%)}}
~.clue-dot.pop i,~.clue-dot.pop::after{animation:none}~.clue-dot:is(.m-lit,.m-wait) i::before{content:'';position:absolute;inset:0;background:var(--fill)}
~.clue-dot.m-lit i::before{transform-origin:50% 0;animation:m-drain .42s var(--m-d,0s) ${O}}~.clue-dot.m-lit i{animation:m-bump .32s calc(var(--m-d,0s) + .3s) var(--m-spring) both}
~.clue-dot.m-lit::after{content:'';position:absolute;inset:-2px;border-radius:0;clip-path:var(--m-hex);background:radial-gradient(closest-side,transparent 58%,rgba(240,154,62,.65) 72%,transparent);opacity:0;pointer-events:none;animation:m-hex-ring-soft .64s calc(var(--m-d,0s) + .3s) var(--m-out) forwards}
@keyframes m-drain{to{transform:scaleY(0)}}@keyframes m-bump{50%{transform:scale(1.1)}}@keyframes m-hex-ring-soft{from{opacity:1;transform:scale(.9)}to{opacity:0;transform:scale(1.5)}}~#clue-count.m-tick{animation:m-tick .32s var(--m-d,0s) var(--m-out)}
~.hint-open{animation:none}~.hint-open.m-new{animation:m-paper .32s var(--m-out) backwards}~.m-new .hint-no .ic{animation:m-key .36s var(--m-spring) both}~.hint-open.m-new p{animation:m-fade .2s .06s ${O}}
@keyframes m-paper{from{clip-path:inset(0 0 calc(100% - 48px) 0 round 20px 20px 20px 6px)}to{clip-path:inset(0 round 20px 20px 20px 6px)}}@keyframes m-key{from{transform:rotate(-35deg) scale(.8)}}
~#log .entry-chapter.fresh{animation:m-unfold .64s .12s var(--m-emph) both}~.fresh .dv-num{animation:m-num .72s .22s ${O}}
~.entry-chapter .dv-top::after{content:'';position:absolute;z-index:-1;top:-40%;right:-20%;width:70%;height:140%;background:radial-gradient(closest-side,rgba(255,180,98,.55),transparent);opacity:0;pointer-events:none}~.fresh .dv-top::after{animation:m-flare 1s .3s ${O}}
~.fresh .dv-label{animation:m-fade-up .32s .26s ${O}}~.entry-chapter.fresh h3{animation:m-fade-up .32s .3s ${O}}~.fresh .dv-sub,~.fresh .dv-go-top{animation:m-fade-up .32s .34s ${O}}~.fresh .dv-body{animation:m-fade .24s .42s ${O}}~.fresh .dv-next{animation:m-fade-up .32s .48s ${O}}
~#convo.m-quiet .fresh,~#convo.m-quiet .fresh .bubble,~#convo.m-quiet .fresh .stamp,~#convo.m-quiet .fresh path,~#convo.m-quiet .fresh circle,~#convo.m-quiet .fresh .entry-note,~#convo.m-quiet .fresh .entry-hit,~#convo.m-quiet .fresh .entry-hit::before,~#convo.m-quiet .fresh .entry-hit::after,~#convo.m-quiet .fresh .dv-num,~#convo.m-quiet .fresh .dv-top::after,~#convo.m-quiet .fresh .dv-label,~#convo.m-quiet .fresh h3,~#convo.m-quiet .fresh .dv-sub,~#convo.m-quiet .fresh .dv-go-top,~#convo.m-quiet .fresh .dv-body,~#convo.m-quiet .fresh .dv-next{animation:none!important}
@keyframes m-unfold{from{clip-path:inset(0 0 100% 0 round 28px)}to{clip-path:inset(0 round 28px)}}@keyframes m-num{from{opacity:0;transform:translateY(40px)}}@keyframes m-flare{0%{opacity:0;transform:scale(.96)}35%{opacity:.9}100%{opacity:0;transform:scale(1.04)}}
~.m-hold{opacity:0!important;pointer-events:none!important}~.problem.turn .ch-head,~.problem.turn .scene-card{animation:none}
~#problem.m-turn-in .ch-head{animation:m-fade-up .28s ${O}}~#problem.m-turn-in :is(.scene-card,.ch-question,.ch-truth),~.toolbox.m-turn-in{animation:m-fade .24s ${O}}
~#problem.m-turn-in .scene-card{position:relative}~#problem.m-turn-in .scene-card::before{content:'';position:absolute;left:24px;right:24px;top:0;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--lamp-bright) 30% 70%,transparent);transform-origin:0;opacity:0;pointer-events:none;animation:m-sweep .56s .12s ${O}}
@keyframes m-sweep{0%{opacity:1;transform:scaleX(0)}70%{opacity:1;transform:none}}
~#problem.m-xfade .ch-head,~#problem.m-xfade .scene-card,~#problem.m-xfade .ch-truth{animation:m-fade .16s ${O}}
~.clock-bar span{transition:none}~.clock.over .clock-time,~.clock.over .clock-note{transition:color .6s var(--m-std)}~#composer-status.m-new{animation:m-fade .16s ${O}}
~.m-pre{opacity:0;pointer-events:none}~.m-pre:is(.m-head,.m-card){transform:translateY(12px)}~.m-bub-host{transform-origin:0 100%}~.m-bub-me{transform-origin:100% 100%}~.m-pre:is(.m-bub-host,.m-bub-me){transform:translateY(10px) scale(.98)}
~#menu-view .m-in{transition:opacity .36s var(--m-out) var(--m-delay,0s),transform .36s var(--m-out) var(--m-delay,0s)!important}~#menu-cols>.m-in{transition-duration:.32s!important}~#menu-view .m-in:is(.m-bub-host,.m-bub-me){transition-duration:.28s!important}
~#menu-view :is(.m-pre,.m-in):focus-within{opacity:1!important;transform:none!important;transition:none!important}
~#featured{position:relative;isolation:isolate}~#featured::before{content:'';position:absolute;inset:24px 24px 0;z-index:-1;border-radius:28px;box-shadow:0 40px 80px -28px rgba(0,0,0,.55);opacity:0;transition:opacity .32s var(--m-out);pointer-events:none}
~.dish-featured .ft-art svg,~.dish-featured .ft-art::before{transition:transform .48s var(--m-out)}~.dish-featured:active{transform:translateY(-1px) scale(.985);transition-duration:.12s}
@media (hover:hover) and (pointer:fine){~.dish-featured:is(:hover,:focus-visible){transform:translateY(-3px)}~#featured:has(.dish-featured:is(:hover,:focus-visible))::before{opacity:1}~.dish-featured:is(:hover,:focus-visible) .ft-art svg{transform:translateY(-4px)}~.dish-featured:is(:hover,:focus-visible) .ft-art::before{transform:scale(1.04)}}
~#play-view.m-enter .topbar,~#menu-view.m-enter .topnav{animation:m-drop .28s ${O}}~#play-view.m-enter:not(.m-same) .play-grid,~#menu-view.m-enter>.cover,~#menu-view.m-enter>.sec,~#menu-view.m-enter>.foot{animation:m-fade .24s ${O}}~#play-view.m-enter #composer,~#play-view.m-enter #ended-bar{animation:m-rise .32s .06s ${O}}
@keyframes m-drop{from{opacity:0;transform:translateY(-8px)}}@keyframes m-rise{from{opacity:0;transform:translateY(12px)}}
@keyframes m-lamp-in{from{clip-path:circle(0 at var(--m-tx) var(--m-ty))}to{clip-path:circle(var(--m-tr) at var(--m-tx) var(--m-ty))}}
~.ch-tab{position:relative}~:is(.ch-tab,.tab,.seg).m-press{animation:m-settle .2s var(--m-std) both}
~.ch-tab.m-unlock::after{content:'';position:absolute;inset:-3px;border-radius:inherit;box-shadow:0 0 0 2px var(--lamp-bright);opacity:0;pointer-events:none;animation:m-ring .72s var(--m-d,0s) var(--m-out) forwards}@keyframes m-settle{from{transform:scale(.94)}}@keyframes m-ring{from{opacity:1;transform:scale(.96)}to{opacity:0;transform:scale(1.1)}}
~.reveal:not([hidden]) .reveal-card{animation:m-sheet .56s var(--m-emph) both}~.reveal:not([hidden]) .medal{animation:m-medal .9s .24s var(--m-spring) both}
~.rv-hero::after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:0;background:radial-gradient(45% 55% at 50% 0,rgba(255,180,98,.38),transparent 70%)}~.reveal:not([hidden]) .rv-hero::after{animation:m-flare-top 1.2s .3s ${O}}
~.reveal:not([hidden]) .rv-stat{animation:m-fade-up .24s .56s ${O}}~.reveal .rv-stat:nth-child(2){animation-delay:.6s}~.reveal .rv-stat:nth-child(3){animation-delay:.64s}~.reveal .rv-stat:nth-child(4){animation-delay:.68s}~.reveal .rv-stat:nth-child(5){animation-delay:.72s}~.reveal:not([hidden]) .rv-foot{animation:m-fade .24s .8s both}
~.m-again .medal,~.m-again .rv-stars span,~.m-again .rv-stat,~.m-again .rv-foot,~.m-again .medal::after,~.m-again .rv-hero::after{animation:none!important}~.reveal.m-again .reveal-card{animation-duration:.32s}
@keyframes m-sheet{from{opacity:0;transform:translateY(32px)}}@keyframes m-medal{from{opacity:0;transform:translateY(16px) scale(.3) rotate(-20deg)}}@keyframes m-flare-top{35%{opacity:1}}
~.rv-bye:is(.m-wait,.m-in){position:relative}~.rv-bye.m-wait>.bubble:not(.m-dots){opacity:0}~.rv-bye.m-in>.bubble:not(.m-dots){animation:m-bub .28s ${O};transform-origin:0 100%}~.rv-bye.m-in>.m-dots{animation:m-fade .12s reverse forwards}~.m-dots{position:absolute;left:44px;top:8px}
~#ended-bar.m-in{animation:m-rise-sm .28s ${O}}~#ended-bar.m-in p::before{animation:m-badge .42s .12s var(--m-spring) both}@keyframes m-rise-sm{from{opacity:0;transform:translateY(12px)}}
.m-intro .cover::after{content:'';position:absolute;inset:0;z-index:-1;background:var(--ground);opacity:0;pointer-events:none;animation:m-warm .9s ${O}}@keyframes m-warm{from{opacity:.9}}
.m-intro .cover-eyebrow,.m-intro .cover-title,.m-intro .cover-promise{animation:m-fade-up .4s ${O}}.m-intro .cover-title{animation-delay:.04s}.m-intro .cover-promise{animation-delay:.08s}
.m-intro .cover-chat .say{animation:m-bub .28s .16s ${O};transform-origin:0 100%}.m-intro .reply{animation:m-bub .28s .26s ${O};transform-origin:100% 100%}.m-intro .reply+.reply{animation-delay:.32s}.m-intro .reply-note{animation:m-fade .24s .38s ${O}}
~.confirm{animation:m-fade-up-sm .22s ${O}}~.world[open] .world-body,~.host-body{animation:m-fade .2s ${O}}~body{transition:opacity .16s var(--m-std)}~body.loading-play{transition-delay:.12s}
~.toast{transition:opacity .24s var(--m-out),transform .24s var(--m-out),display .24s allow-discrete}~.toast[hidden]{opacity:0;transform:translate(-50%,12px)}@starting-style{~.toast:not([hidden]){opacity:0;transform:translate(-50%,12px)}}`.replace(/~/g, '.m-on ');
/* 오른쪽 끝이 *인 규칙은 필요할 때만 켜는 시트로(7.6.4-11) */
const CSS_R = '*,::before,::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.bowl .steam,.m-on .m-wisp,.typing i{opacity:.6}.medal::after{opacity:0}'; // m-reduce (1.7.1)
const CSS_SW = `*,::before,::after{transition:none!important}::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}.m-theme-vt::view-transition-new(root){animation:m-lamp-in .32s var(--m-std) both}`; // m-swap (P1-4)
const sheet = (id, css, off) => { let st = D.getElementById(id); if (!st) { st = D.createElement('style'); st.id = id; st.textContent = css; D.head.appendChild(st); } st.disabled = off; return st; };
sheet('sts-motion-css', CSS, false);
const stR = sheet('sts-motion-reduce', CSS_R, true), stSW = sheet('sts-motion-swap', CSS_SW, true);
const swap = on => { cl(R).toggle('m-swap', on); stSW.disabled = !on; };

/* 기반: reduced(1.7)와 페이지 안 스위치(1.7.1) */
const KEY = 'sea-turtle-soup:motion', mqR = mq('(prefers-reduced-motion: reduce)'), mqD = mq('(min-width: 1024px)'), coarse = mq('(pointer: coarse)'), flush = [];
let pref = false, btn = null;
try { pref = localStorage.getItem(KEY) === 'reduce'; } catch (e) { /* 저장소 없음: 이 페이지에서만 */ }
const os = () => mqR.matches, red = () => pref || os();
function sync() {
  const r = red();
  cl(R).toggle('m-reduce', r); stR.disabled = !r;
  if (r) flush.forEach(f => run('flush', f)); // 숨겨 둔 것은 바로 다 보입니다
  if (!btn) return;
  btn.setAttribute('aria-pressed', r);
  if (os()) { btn.setAttribute('aria-disabled', 'true'); btn.title = '기기 설정에서 켜져 있어요'; } else { btn.removeAttribute('aria-disabled'); btn.removeAttribute('title'); }
}
cl(R).add('m-on');
mqR.addEventListener ? mqR.addEventListener('change', sync) : mqR.addListener(sync);
run('pref', () => {
  const box = $('#sec-footer .foot-reset'), rb = $('#reset-btn');
  if (!box) return;
  btn = D.createElement('button'); btn.type = 'button'; btn.className = 'text-btn m-pref'; btn.textContent = '화면 움직임 줄이기';
  box.insertBefore(btn, rb && rb.parentNode === box ? rb : box.firstChild);
  btn.addEventListener('click', () => {
    if (dead || os()) return;
    pref = !pref;
    try { pref ? localStorage.setItem(KEY, 'reduce') : localStorage.removeItem(KEY); } catch (e) { /* 이 페이지에서만 */ }
    sync();
  });
});
sync();

/* 1.8 멈춤: 탭 숨김 · 화면 밖 · 스크롤 중 · 무입력 30초 */
const AMB = [$('.cover'), $('#featured')].filter(Boolean);
let scr = false, scT, idle = false, last = Date.now(), idT;
const pause = () => cl(R).toggle('m-paused', D.hidden);
const scEnd = () => { clearTimeout(scT); if (scr) { scr = false; cl(R).remove('m-scrolling'); } };
const arm = () => { clearTimeout(idT); idT = later(() => { if (Date.now() - last < 29990) return arm(); idle = true; AMB.forEach(e => has(e, 'm-off') || cl(e).add('m-idle')); }, last + 30000 - Date.now()); };
const act = () => { last = Date.now(); if (idle) { idle = false; AMB.forEach(e => cl(e).remove('m-idle')); arm(); } };
D.addEventListener('visibilitychange', pause); pause();
W.addEventListener('scroll', () => { if (!scr) { scr = true; cl(R).add('m-scrolling'); } clearTimeout(scT); scT = later(scEnd, 200); act(); }, { passive: true });
W.addEventListener('scrollend', () => { clearTimeout(scT); scT = later(scEnd, 120); }, { passive: true }); // 7.6.4-10
IN.forEach(t => D.addEventListener(t, act, CAP)); arm();
run('ambient', () => { // P0-1 · P2-5 ①
  if (W.IntersectionObserver) { const o = io(es => es.forEach(e => { cl(e.target).toggle('m-off', !e.isIntersecting); if (e.isIntersecting && idle) cl(e.target).add('m-idle'); })); AMB.forEach(e => o.observe(e)); }
  const ct = $('.counter-top'), s = '<svg viewBox="0 0 14 44"><path d="M7 42c-6-8 6-13 0-21s5-12 0-19"/></svg>';
  if (ct && !ct.querySelector('.m-steam')) ct.insertAdjacentHTML('beforeend', '<span class="m-steam" aria-hidden="true">' + [1, 2, 3].map(i => `<i class="m-wisp m-amb w${i}">${s}</i>`).join('') + '</span>');
  $$('.cover-cue .typing i').forEach(i => cl(i).add('m-amb'));
});

/* P1-9 표지 첫 인사: 세션 첫 방문, 첫 페인트 전만 */
run('intro', () => {
  const mv = $('#menu-view');
  if (!AUTO || red() || location.hash || !mv || mv.hidden || P.getEntriesByName('first-contentful-paint').length) return;
  const nav = P.getEntriesByType && P.getEntriesByType('navigation')[0]; // scrollY 대신 새로 연 페이지만(7.6.4-9)
  if (nav && nav.type !== 'navigate') return;
  const ne = W.navigation && W.navigation.currentEntry; // 탭에 앞선 기록이 있으면 본 세션. sessionStorage 첫 읽기는 동기 IPC라 대체로만(7.7)
  if (ne) { if (ne.index > 0) return; } else try { if (sessionStorage.getItem('sts:intro')) return; later(() => { try { sessionStorage.setItem('sts:intro', '1'); } catch (e) { /* 이 페이지에서만 */ } }); } catch (e) { /* 페이지당 한 번 */ }
  tmp(R, 'm-intro', 1000); flush.push(() => cl(R).remove('m-intro'));
});

/* P1-1 메뉴 리빌: 처음부터 화면 밖이던 것만, 세션에 한 번 */
const pre = new Map(), G = [['#sec-howto', 90, '.howto-head|m-head,.script>.msg-me|m-bub-me,.script .say>.avatar|m-bub-host,.script .say-stack>li|m-bub-host'], ['#sec-today', 90, '.today-say|m-bub-host,#featured>*|m-card,#today-after|m-head'],
  ['#sec-menu', 40, '.sec-head|m-head,#menu-cols>*|m-card'], ['#sec-host', 70, '.sec-head|m-head,#menu-host .host-opt|m-card,.host-say|m-bub-host,.host-end|m-head']];
let rio, tio, preOff = false;
function show(e, d) {
  const m = pre.get(e);
  if (!m) return;
  pre.delete(e); if (rio) rio.unobserve(e);
  if (d == null || red() || !e.isConnected) cl(e).remove('m-pre', m[0]);
  else {
    e.style.setProperty('--m-delay', d + 'ms'); cl(e).add('m-in'); raf(() => cl(e).remove('m-pre'));
    let ok; const done = () => { if (!ok) { ok = 1; cl(e).remove('m-in', m[0]); e.style.removeProperty('--m-delay'); } };
    e.addEventListener('transitionend', x => x.target === e && x.propertyName === 'opacity' && done()); later(done, 1000 + d);
  }
  if (!pre.size) preEnd();
}
const showAll = s => [...pre].forEach(([e, m]) => (!s || m[2] === s) && show(e)), preAll = () => showAll();
const preDown = e => { const s = e.target.closest && e.target.closest('[data-section]'); if (s) showAll(s); }; // 1.5-4
const preFocus = e => { for (const [el, m] of pre) if (el.contains(e.target)) return showAll(m[2]); };
function preEnd() { if (preOff) return; preOff = true; rio && rio.disconnect(); tio && tio.disconnect(); D.removeEventListener('pointerdown', preDown, true); D.removeEventListener('focusin', preFocus, true); W.removeEventListener('beforeprint', preAll); }
flush.push(preAll);
function preStart() {
  const mv = $('#menu-view');
  if (preOff || !AUTO || red() || !W.IntersectionObserver || !mv || mv.hidden) return preEnd();
  const f = new Map();
  G.forEach(([s, st, l]) => { const sec = $(s); if (sec) l.split(',').forEach(x => { const [q, k] = x.split('|'); $$(q, sec).forEach(e => f.set(e, [k, st, sec])); }); });
  // ⑤ 처음부터 화면 아래: IO 첫 보고에서 "교차 안 함, top > 0"(layout 강제 없음, iframe에서도 동작. 7.6.4-8)
  const first = new IntersectionObserver(es => {
    first.disconnect();
    const t = now();
    es.forEach(x => { if (!x.isIntersecting && x.boundingClientRect.top > 0 && x.target.isConnected) { const m = f.get(x.target); pre.set(x.target, m); cl(x.target).add('m-pre', m[0]); } });
    S.max.reveal = now() - t; run('measure', () => P.measure('sts-motion:reveal', { start: t }));
    if (!pre.size || red() || mv.hidden) return preAll(), preEnd();
    rio = io(es2 => {
      const k = new Map();
      es2.filter(x => x.isIntersecting && pre.has(x.target)).map(x => x.target).sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))
        .forEach(e => { const m = pre.get(e), i = k.get(m[2]) || 0; k.set(m[2], i + 1); show(e, Math.min(i, 5) * m[1]); });
    }, { rootMargin: '0px 0px -8% 0px' });
    pre.forEach((m, e) => rio.observe(e));
    const tail = $('#foot-credit'); // 페이지 끝: 아래 띠에 남은 것도
    if (tail) (tio = new IntersectionObserver(x => x.some(y => y.isIntersecting) && preAll())).observe(tail);
    D.addEventListener('pointerdown', preDown, true); D.addEventListener('focusin', preFocus, true); W.addEventListener('beforeprint', preAll);
  });
  IOS.push(first);
  f.forEach((m, e) => first.observe(e));
}
run('reveal', () => {
  const c = $('#menu-cols');
  if (!c) return;
  let k = 0;
  const kick = () => { if (k++) return; let f = 0; const g = () => f++ || run('reveal', preStart); raf(g); later(g, 1500); }; // 첫 렌더 다음 rAF, 늦어도 1,500 ms
  if (c.children.length) kick(); else { const o = mo('reveal', () => { if (c.children.length) { o.disconnect(); kick(); } }, [[c, { childList: true }]]); }
});

/* P1-4 테마 전환: .theme-btn만(스피커 .music-btn은 그대로) */
let rp = false, cur = null;
D.addEventListener('click', e => {
  const b = !dead && !rp && e.target.closest && e.target.closest('.theme-btn');
  if (!b) return;
  n1('theme'); moment('theme');
  if (!D.startViewTransition || red() || coarse.matches) { swap(true); return raf(() => raf(() => swap(false))); } // 같은 프레임에 즉시. 터치 기기는 VT 없이(V11-p)
  e.stopPropagation(); // stopPropagation만: document의 다른 캡처 리스너(음악)는 그대로 받음
  const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, s = R.style;
  s.setProperty('--m-tx', x + 'px'); s.setProperty('--m-ty', y + 'px'); s.setProperty('--m-tr', Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + 'px');
  swap(true); cl(R).add('m-theme-vt');
  const replay = () => { rp = true; try { b.click(); } finally { rp = false; } };
  let vt;
  const skip = ev => { // 1.5-4 입력이 오면 끝냄. VT 중 <html>에 맞은 클릭은 포인터 아래로 다시 보냄
    try { vt.skipTransition(); } catch (x2) { /* 이미 끝남 */ }
    if (ev.type !== 'pointerdown' || ev.target !== R) return;
    const x = ev.clientX, y = ev.clientY, f = c => {
      D.removeEventListener('click', f, true);
      if (c.target !== R) return;
      const t = D.elementFromPoint(x, y);
      if (!t || t === R) return;
      c.stopPropagation();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: W, detail: 1 }));
    };
    D.addEventListener('click', f, true); later(() => D.removeEventListener('click', f, true), 1000);
  };
  const end = () => { D.removeEventListener('pointerdown', skip, true); D.removeEventListener('keydown', skip, true); if (cur !== vt) return; cur = null; swap(false); cl(R).remove('m-theme-vt'); ['--m-tx', '--m-ty', '--m-tr'].forEach(p => s.removeProperty(p)); }; // 뒤 전환의 상태는 남김
  try { vt = cur = D.startViewTransition(replay); S.vt++; D.addEventListener('pointerdown', skip, CAP); D.addEventListener('keydown', skip, CAP); vt.finished.then(end, end); } catch (x2) { vt = cur; end(); replay(); }
}, true);

/* 플레이 화면. 관찰자 생성 순서 = 같은 묶음의 콜백 순서 */
const log = $('#log'), cv = $('#convo'), rv = $('#reveal'), pv = $('#play-view'), mv = $('#menu-view'), eb = $('#ended-bar'), prob = $('#problem');
const key = s => txt('#p-title') + '|' + txt(s), pr = b => b.getAttribute('aria-pressed') === 'true', AP = { attributes: true, attributeFilter: ['aria-pressed'] }, CD = { childList: true, characterData: true, subtree: true };
let heroAt = -1e9, fresh = true, turn = null;
if (log && cv && rv && pv && mv && prob) later(() => { // init 뒤 태스크에서(숨은 #play-view는 첫 클릭 전에 안 바뀜)
  if (dead) return;
  run('view', () => { // P1-3
    const vis = new Map([[mv, !mv.hidden], [pv, !pv.hidden]]);
    let bowl = null;
    mo('view', () => {
      vis.forEach((was, v) => {
        const on = !v.hidden;
        if (on && !was) {
          if (v === pv) { const k = txt('#p-title'); cl(pv).toggle('m-same', k === bowl); bowl = k; fresh = true; } // 같은 그릇이면 그리드는 다시 페이드하지 않음(R1)
          if (!red()) tmp(v, 'm-enter', 450);
        }
        vis.set(v, on);
      });
      if (mv.hidden) preAll();
      if (pv.hidden && turn) turn();
    }, [[mv, HID], [pv, HID]]);
  });

  /* P0-7 장면 넘김: 보류(≤ 700 ms, 눌리지 않음) → 조용한 공개. 장 탭·세계관은 숨기지 않음(R1) */
  const hold = hero => {
    if (red()) return;
    if (turn) turn();
    const desk = mqD.matches, tb = desk ? $$('.toolbox') : [], els = $$(':scope>:not(#ch-tabs)', prob).concat(tb), ins = [prob].concat(tb), t = now(), tm = [], ac = new AbortController();
    els.forEach(e => cl(e).add('m-hold'));
    const fin = () => {
      if (turn !== fin) return;
      turn = null; ac.abort(); tm.forEach(clearTimeout);
      els.forEach(e => cl(e).remove('m-hold'));
      if (!red()) ins.forEach(e => tmp(e, 'm-turn-in', 700));
      later(() => has(prob, 'm-turn-in') || cl(prob).remove('turn'), 720); // D9
    };
    turn = fin;
    const cond = () => { const w = hero ? 640 - (now() - t) : 0; if (w > 0) tm.push(later(fin, w)); else fin(); }; // ⓐ는 히어로(640 ms)가 먼저
    const o = { capture: true, passive: true, once: true, signal: ac.signal };
    ((desk && $('#col-left')) || W).addEventListener('scrollend', cond, o);
    tm.push(later(cond, desk ? 520 : 700), later(fin, 700));
    IN.forEach(x => D.addEventListener(x, fin, o)); // 트리거 뒤 입력만(keyup 제외)
    n1('turn');
  };
  flush.push(() => turn && turn());
  let tc = false; // P2-6 사용자가 장면을 바꿈
  const sceneClick = () => { tc = true; later(() => { tc = false; }); };
  const still = () => { // 스크롤이 없음(클릭이라 layout 읽기 허용, A7)
    if (mqD.matches) { const c = $('#col-left'); return !c || c.scrollTop < 2; }
    const cs = getComputedStyle, y = Math.min(Math.max(0, scrollY + prob.getBoundingClientRect().top - (parseFloat(cs(R).scrollPaddingTop) || 0) - (parseFloat(cs(prob).scrollMarginTop) || 0)), R.scrollHeight - innerHeight);
    return Math.abs(y - scrollY) < 2;
  };
  D.addEventListener('click', e => { if (!dead && e.target.closest && e.target.closest('.dv-go')) run('turn', () => (still() ? sceneClick() : hold(false))); }, true); // ⓑ 게임보다 먼저(캡처). 흐를 것이 없으면 숨기지 않음

  /* P0-2 · P0-3 · P0-6: #log 안은 같은 마이크로태스크에 붙이기만(4.6) */
  run('log', () => {
    const seen = new WeakSet();
    let had = false, lp = null, lt, qn = null;
    mo('log', () => {
      const p = log.querySelector(':scope>.pending'), r = red(), gone = had && !p, open = !rv.hidden;
      let ch = 0;
      if (p !== lp) { lp = p; clearTimeout(lt); cl(cv).remove('m-long'); if (p) lt = later(() => p.isConnected && cl(cv).add('m-long'), 10000); } // P1-8
      if (qn && !qn.isConnected) { qn = null; cl(cv).remove('m-quiet'); }
      $$(':scope>.fresh', log).forEach(li => {
        if (seen.has(li)) return;
        seen.add(li);
        if (has(li, 'entry-chapter')) { ch++; if (r) fade(li); if (open) { cl(cv).add('m-quiet'); qn = li; } return; } // 리빌 뒤의 디바이더 모션은 생략
        const b = li.querySelector('.reply-bubble');
        if (!b) return;
        n1('answer'); moment('answer');
        if (li.querySelector('.entry-hit')) { n1('clue'); moment('clue'); } // 찾은 순간(미터는 보일 때)
        if (r) return fade(b);
        if (gone && !has(li, 'by-host')) {
          cl(b).add('m-morph');
          raf(() => b.getAnimations && b.getAnimations().forEach(a => a.effect && a.effect.getKeyframes().some(k => 'width' in k || 'height' in k) && a.cancel())); // E1 전 페이지 방어(다음 rAF, 7.6.4-12)
        }
      });
      had = !!p;
      if (ch) { heroAt = now(); n1('chapter'); moment('chapter'); if (mqD.matches && !open) hold(true); } // P0-7 ⓐ: 폰은 왼쪽이 위에 있어 생략
    }, [[log, { childList: true }]]);
  });

  /* P1-5 장 탭 · P2-3 질문/추리 탭·진행자 세그먼트. 첫 렌더는 기준값만 */
  run('tabs', () => {
    let tk = null, tm0 = [], pm = {};
    const settle = b => tmp(b, 'm-press', 300), chT = $('#ch-tabs'), ask2 = [$('#tab-ask'), $('#tab-guess')], ph = $('#play-host');
    mo('tabs', () => {
      const k = txt('#p-title'), base = fresh || k !== tk || red(), bs = [...chT.children], st = bs.map(b => [b.disabled, pr(b)]);
      if (!base) bs.forEach((b, i) => {
        const o = tm0[i];
        if (!o) return;
        if (o[0] && !st[i][0]) { b.style.setProperty('--m-d', (now() - heroAt < 200 ? 760 : 0) + 'ms'); tmp(b, 'm-unlock', 1600); } else if (!o[1] && st[i][1]) settle(b);
      });
      tk = k; tm0 = st;
      [...ask2, ...(ph ? ph.querySelectorAll('.seg') : [])].forEach((b, i) => { if (!b) return; const p = pr(b); if (!base && p && pm[i] === false) settle(b); pm[i] = p; });
      fresh = false;
    }, [[chT, { childList: true }], [ask2[0], AP], [ask2[1], AP], [ph, { childList: true }]]);
  });

  /* P0-4 단서: 태그 ①은 CSS. 목표 ②, 미터 ③(보일 때까지 미룸, 미리 덮기) */
  run('clues', () => {
    const dots = $('#clue-dots'), cnt = $('#clue-count'), goal = $('#goal'), num = e => parseInt(e ? e.textContent : '', 10) || 0;
    if (!dots || !cnt) return;
    let ck = null, cp = [], cw = null, cu = false, cvis = false, gk = null, gv = 0, cn = 0, gT;
    const play = (idx, base) => {
      const lit = idx.map(i => dots.children[i]).filter(Boolean);
      lit.forEach((e, k) => { cl(e).remove('m-wait'); e.style.setProperty('--m-d', base + k * 90 + 'ms'); cl(e).add('m-lit'); });
      if (cu) { cu = false; cnt.style.setProperty('--m-d', base + 'ms'); tmp(cnt, 'm-tick', base + 420); }
      later(() => lit.forEach(e => cl(e).remove('m-lit')), base + lit.length * 90 + 1000);
      n1('meter');
    };
    const unwait = () => { cw = null; cu = false; $$('.m-wait,.m-lit', dots).forEach(e => cl(e).remove('m-wait', 'm-lit')); };
    flush.push(unwait);
    if (W.IntersectionObserver) io(es => { cvis = es[es.length - 1].intersectionRatio >= 0.5; if (cvis && cw && !red()) { const w = cw; cw = null; play(w, 0); } }, { threshold: [0, 0.5, 1] }).observe(dots); // A7: 보이는지는 IO 기억값
    mo('clues', () => {
      const k = key('#clue-title'), pat = [...dots.children].map(e => has(e, 'on')), n = num(cnt), r = red();
      if (k !== ck || r) { ck = k; cp = pat; cn = n; unwait(); } // 장이 바뀐 첫 렌더는 재생 없음
      else {
        const idx = [...new Set([...(cw || []), ...pat.map((v, i) => (v && !cp[i] ? i : -1))])].filter(i => i >= 0 && pat[i]).sort((a, b) => a - b);
        if (n > cn) cu = true;
        cp = pat; cn = n;
        if (idx.length) { if (cvis) { cw = null; play(idx, 480); } else { cw = idx; idx.forEach(i => cl(dots.children[i]).add('m-wait')); } }
      }
      const b = goal && goal.querySelector('.roll b'), v = num(b);
      if (goal && k === gk && v > gv && !r) { cl(goal).add('m-up'); if (b) cl(b).add('m-r'); clearTimeout(gT); gT = later(() => cl(goal).remove('m-up'), 1200); }
      gk = k; gv = v;
    }, [[dots, { childList: true }], [cnt, CD], [goal, { childList: true, subtree: true }]]);
  });

  /* P0-5 힌트: 새로 연 힌트만 펼침 */
  run('hints', () => {
    const hl = $('#hint-list');
    let hk = null, hn = 0;
    mo('hints', () => {
      const k = key('#hint-title'), o = $$(':scope>.hint-open', hl), n = o.length;
      if (k === hk && n > hn) { if (red()) fade(o[n - 1]); else tmp(o[n - 1], 'm-new', 460); n1('hint'); }
      hk = k; hn = n;
    }, [[hl, { childList: true }]]);
  });

  /* P2-6 장 탭으로 다른 장 · P2-9 상태 줄(경고는 모션 없이) */
  run('scene', () => {
    let sk = null, st = '';
    const cs = $('#composer-status');
    D.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.ch-tab'); if (t && !t.disabled) sceneClick(); }, true);
    mo('scene', () => { const k = txt('#ch-title'); if (tc && sk !== null && k !== sk && !turn && !red()) tmp(prob, 'm-xfade', 260); tc = false; sk = k; }, [[$('#ch-scene'), { childList: true }]]);
    if (cs) mo('status', () => { const t = cs.textContent; if (t && t !== st && !has(cs, 'warn') && !red()) tmp(cs, 'm-new', 260); st = t; }, [[cs, CD]]);
  });

  /* P1-6 리빌 · P1-7 끝 바 · P2-4 마지막 인사 */
  run('sheet', () => {
    let ag = -1e9, ro = !rv.hidden, eo = !!eb && !eb.hidden, eh = false, bio = null;
    D.addEventListener('click', e => { if (e.target.closest && e.target.closest('#reopen-btn')) ag = now(); }, true);
    const ebShow = () => red() || tmp(eb, 'm-in', 560);
    const ebFree = () => { if (!eh) return false; eh = false; cl(eb).remove('m-hold'); return true; };
    const byeEnd = () => { if (bio) bio.disconnect(); bio = null; $$('.rv-bye').forEach(e => { cl(e).remove('m-wait', 'm-in'); $$('.m-dots', e).forEach(d => d.remove()); }); };
    flush.push(byeEnd, ebFree);
    const bye = () => {
      const e = $('#rv-body .rv-bye'), root = $('#rv-scroll');
      if (!e || !root || !W.IntersectionObserver) return;
      let first = true;
      bio = new IntersectionObserver(es => {
        const x = es[es.length - 1];
        if (first) { first = false; if (x.isIntersecting) byeEnd(); else cl(e).add('m-wait'); return; } // 열 때 이미 보이면 하지 않음
        if (!x.isIntersecting) return;
        bio.disconnect(); bio = null;
        e.insertAdjacentHTML('beforeend', '<span class="bubble host thinking-bubble m-dots" aria-hidden="true"><span class="typing"><i></i><i></i><i></i></span></span>');
        later(() => { if (has(e, 'm-wait')) { cl(e).remove('m-wait'); tmp(e, 'm-in', 420); } $$('.m-dots', e).forEach(d => { d.addEventListener('animationend', x => x.target === d && d.remove()); later(() => d.remove(), 400); }); }, 480); // 점은 말풍선과 같은 프레임에 걷히기 시작
      }, { root, threshold: 0.5 });
      bio.observe(e);
    };
    mo('sheet', () => {
      const open = !rv.hidden, on = !!eb && !eb.hidden;
      if (open !== ro) {
        ro = open;
        if (open) { const a = now() - ag < 1000; cl(rv).toggle('m-again', a); if (red()) fade($('.reveal-card')); else if (!a) raf(() => ro && run('sheet', bye)); n1('reveal'); moment('reveal'); } // P2-4는 다음 프레임에
        else { cl(rv).remove('m-again'); byeEnd(); if (ebFree()) ebShow(); }
      }
      if (eb && on !== eo) {
        eo = on;
        if (!on) { eh = false; cl(eb).remove('m-hold', 'm-in'); } else if (open && !red()) { eh = true; cl(eb).add('m-hold'); } else ebShow(); // 리빌을 닫은 뒤에 올라옴
      }
    }, [[rv, HID], [eb, HID]]);
  });
});

S.init = now() - t0;
run('measure', () => P.measure('sts-motion:init', { start: t0 }));
W.STSMotion = {
  version: '1.0.0', reduced: red,
  off() {
    if (dead) return;
    flush.forEach(f => run('flush', f));
    dead = true; MOS.forEach(o => o.disconnect()); IOS.forEach(o => o.disconnect()); if (tio) tio.disconnect();
    $$('.m-steam,.m-pref,#sts-motion-reduce,#sts-motion-swap').forEach(e => e.remove());
    cl(R).remove('m-on', 'm-reduce', 'm-paused', 'm-scrolling', 'm-intro', 'm-swap', 'm-theme-vt');
  },
  state: () => ({
    version: '1.0.0', on: !dead && has(R, 'm-on'), reduced: red(), os: os(), pref, paused: has(R, 'm-paused'), scrolling: scr, idle,
    cover: AMB[0] ? { off: has(AMB[0], 'm-off'), idle: has(AMB[0], 'm-idle') } : null, pre: $$('.m-pre').length, holds: $$('.m-hold').length, waits: $$('.m-wait').length, lit: $$('.m-lit').length,
    turn: !!turn, vt: S.vt, init: S.init, max: Object.assign({}, S.max), n: Object.assign({}, S.n), errors: S.err.slice(),
  }),
};
})();
