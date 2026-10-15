// 통합 테스트: 가짜 Claude 서버 + wrangler dev(로컬 D1)를 띄우고, 실제 브라우저로 메뉴부터 결말까지 플레이한다.
// 실행: npm run test:e2e   (Playwright는 전역 설치본을 쓴다: PW=$(npm root -g)/playwright)
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const PW = process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright');
const { chromium } = require(PW);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'test/.out');
const STUB_PORT = 8790, APP_PORT = 8799;
const BASE = `http://localhost:${APP_PORT}`;
const BUDGET = process.env.E2E_BUDGET || '5';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const DEV_VARS = path.join(ROOT, '.dev.vars'), DEV_BAK = DEV_VARS + '.before-test';
if (fs.existsSync(DEV_VARS) && !fs.existsSync(DEV_BAK)) fs.renameSync(DEV_VARS, DEV_BAK);
process.on('exit', () => { try { fs.rmSync(DEV_VARS, { force: true }); if (fs.existsSync(DEV_BAK)) fs.renameSync(DEV_BAK, DEV_VARS); } catch (e) { /* best effort */ } });
fs.writeFileSync(path.join(ROOT, '.dev.vars'), [
  'ANTHROPIC_API_KEY=sk-test-not-real',
  `ANTHROPIC_BASE_URL=http://127.0.0.1:${STUB_PORT}`,
  'SESSION_SECRET=e2e-session-secret-0123456789',
  'ADMIN_TOKEN=e2e-admin',
  'AI_DEVICE_PER_MINUTE=1000',
  `AI_DAILY_BUDGET_USD=${BUDGET}`,
].join('\n') + '\n');

const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const procs = [];
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };

function run(cmd, args, name) {
  const p = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const logf = fs.createWriteStream(path.join(OUT, `${name}.log`));
  p.stdout.pipe(logf); p.stderr.pipe(logf);
  procs.push(p);
  return p;
}
async function waitFor(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch (e) { /* not yet */ }
    await sleep(500);
  }
  throw new Error(`timeout waiting for ${url}`);
}
function cleanup() { for (const p of procs) { try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { /* gone */ } } procs.length = 0; }
process.on('exit', cleanup);

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/puzzles.json'), 'utf8'));
const secrets = raw.flatMap(p => [...p.chapters.flatMap(c => [c.truth[0].slice(0, 24), ...c.keys.map(k => k.slice(0, 20))]), ...(p.secret || []).map(x => x.slice(0, 20))]);
const leaks = text => secrets.filter(s => s && text.includes(s));

(async () => {
  execSync(`npx wrangler d1 migrations apply DB --local --persist-to ${path.join(OUT, 'state')}`, { cwd: ROOT, env, stdio: 'ignore' });
  run('node', ['test/stub-anthropic.js', String(STUB_PORT), path.join(OUT, 'stub-requests.jsonl')], 'stub');
  run('npx', ['wrangler', 'dev', '--port', String(APP_PORT), '--ip', '127.0.0.1', '--persist-to', path.join(OUT, 'state'), '--show-interactive-dev-session=false'], 'wrangler');
  await waitFor(`${BASE}/api/config`);

  // ---- content never leaves the server before its time
  const html = await (await fetch(BASE + '/')).text();
  check('page source carries no answers or clues', leaks(html).length === 0, leaks(html).slice(0, 2).join(' | '));
  const list = await (await fetch(BASE + '/api/puzzles')).text();
  check('menu API carries no answers or clues', leaks(list).length === 0);
  check('raw content file is not served', (await fetch(BASE + '/content/puzzles.json')).status !== 200 || !(await (await fetch(BASE + '/content/puzzles.json')).text()).includes('"truth"'));
  const xo = await fetch(BASE + '/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{"puzzleId":"turtle-soup"}' });
  check('cross-origin POST is refused', xo.status === 403, String(xo.status));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|status of [45]\d\d/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(BASE + '/');
  await page.waitForSelector('#menu-cols button');
  const data = raw;
  check('menu lists every puzzle', (await page.$$('#menu-cols button')).length === data.length);

  // reading order (same contract as the design smoke test)
  const order = await page.evaluate(() => ['cover', 'howto', 'today', 'menu', 'host', 'footer'].map(k => {
    const el = document.querySelector(`#menu-view [data-section="${k}"]`); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null;
  }));
  check('six sections in reading order', order.every((t, i) => t !== null && (i === 0 || t > order[i - 1])), order.join(' < '));
  const expectedId = await page.evaluate(ids => { const d = new Date(); const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); return ids[day % ids.length]; }, data.map(x => x.id));
  const featuredId = await page.getAttribute('.dish-featured', 'data-id');
  check("today's pick follows the date rule", featuredId === expectedId, `${featuredId} vs ${expectedId}`);
  const first = data.find(x => x.id === featuredId);
  check('AI host is offered as available', (await page.textContent('#menu-host-note')).includes('무료'));

  // ---- play with the AI host
  await page.click('.dish-featured');
  await page.waitForSelector('#play-view:not([hidden])');
  check('chapter 1 scene shown', (await page.textContent('#ch-scene')).includes(first.chapters[0].scene[0].slice(0, 12)));
  const snapshot = await page.content();
  const later = first.chapters.slice(1).map(c => c.scene[0].slice(0, 20));
  check('later chapters are not in the page', later.every(s => !snapshot.includes(s)));
  await page.waitForTimeout(1300);
  check('clock runs', (await page.textContent('#clock-time')) !== '00:00');

  const ask = async t => {
    await page.fill('#q-input', t);
    await page.press('#q-input', 'Enter');
    await page.waitForFunction(() => !document.querySelector('#log .pending'), null, { timeout: 15000 });
  };
  await ask('이 일은 사고였나요?');
  check('question logged with an answer', (await page.$$('#log .stamp, #log .badge, #log .entry')).length >= 1);
  const ch1 = first.chapters[0].keys.length;
  for (let n = 1; n <= ch1; n++) await ask(`단서 질문 #${n}`);
  await page.waitForFunction(() => document.querySelector('#p-progress').textContent.trim().startsWith('2장'), null, { timeout: 10000 }).catch(() => {});
  check('chapter 1 clears via hits and chapter 2 opens', (await page.textContent('#p-progress')).trim().startsWith('2장'), await page.textContent('#p-progress'));
  check('chapter 1 answer now on screen', (await page.content()).includes(first.chapters[0].truth[0].slice(0, 20)));
  check('chapter-clear card in log', (await page.$$('#log .entry-chapter')).length === 1);

  await page.click('#tab-guess');
  await page.fill('#q-input', '추리합니다');
  await page.click('#send-btn');
  await page.waitForFunction(() => document.querySelector('#p-progress').textContent.trim().startsWith('3장'), null, { timeout: 10000 }).catch(() => {});
  check('chapter 2 clears via a guess', (await page.textContent('#p-progress')).trim().startsWith('3장'), await page.textContent('#p-progress'));

  await page.click('#tab-ask');
  await ask('거절해 주세요 #REFUSE');
  check('a refusal shows a polite message and keeps the text', (await page.textContent('#composer-status')).includes('답할 수 없어요') && (await page.inputValue('#q-input')).includes('#REFUSE'));
  await page.fill('#q-input', '');
  await ask('서버 오류 #BOOM');
  check('an upstream error is reported', (await page.textContent('#composer-status')).length > 0);
  await page.fill('#q-input', '');

  const hb = await page.$('.hint-btn:not([disabled])');
  if (hb) await hb.click();
  await page.waitForSelector('.hint-open', { timeout: 5000 }).catch(() => {});
  check('hint opens', (await page.$$('.hint-open')).length === 1);
  check('the opened hint is the real one', (await page.textContent('.hint-open')).includes(first.chapters[2].hints[0].slice(0, 12)));

  for (let i = 0; i < 4 && !(await page.isVisible('#reveal')); i++) {
    await page.click('#skip-btn'); await page.click('#skip-yes');
    await page.waitForTimeout(700);
  }
  check('reveal opens at the end', await page.isVisible('#reveal'));
  check('reveal shows every chapter answer', (await page.$$('#rv-body .rv-section')).length >= first.chapters.length);
  check('reveal shows the epilogue', (await page.textContent('#rv-body')).includes(first.epilogue[0].slice(0, 16)));
  await page.click('#rv-close');
  check('ended bar shown', await page.isVisible('#ended-bar'));
  await page.click('#back-btn');
  check('menu shows the finished record', ((await page.textContent('#menu-view')) || '').includes('완주'));

  // records survive a reload (they live on the server now)
  await page.reload();
  await page.waitForSelector('#menu-cols button');
  check('record survives a reload', ((await page.textContent('#menu-view')) || '').includes('완주'));
  const nextId = data[(data.findIndex(x => x.id === featuredId) + 1) % data.length].id;
  check('finished pick hands over to the next unsolved', (await page.getAttribute('.dish-featured', 'data-id')) === nextId);

  // ---- friend host
  await page.click('text=친구가 진행');
  const dishes = await page.$$('#menu-cols button');
  let target = dishes[0];
  for (const d of dishes) if (!((await d.textContent()) || '').includes(first.title)) { target = d; break; }
  const friendTitle = ((await target.textContent()) || '').trim();
  await target.click();
  await page.waitForSelector('#play-view:not([hidden])');
  check('friend mode shows answer buttons', await page.isVisible('[data-answer="yes"]'));
  await page.click('#host-toggle');
  await page.waitForSelector('#host-body input[type=checkbox]', { timeout: 5000 }).catch(() => {});
  const boxes = await page.$$('#host-body input[type=checkbox]');
  check('host note loads the chapter clues', boxes.length > 0, `${boxes.length} boxes for ${friendTitle.slice(0, 20)}`);
  for (const b of boxes) await b.click();
  await page.waitForFunction(() => document.querySelector('#p-progress').textContent.trim().startsWith('2장'), null, { timeout: 10000 }).catch(() => {});
  check('ticking every clue advances the chapter', (await page.textContent('#p-progress')).trim().startsWith('2장'), await page.textContent('#p-progress'));
  await page.click('[data-answer="no"]');
  await page.waitForTimeout(400);
  check('a friend answer is logged', (await page.$$('#log .entry')).length >= 1);
  await page.click('#giveup-btn'); await page.click('#giveup-yes');
  await page.waitForSelector('#reveal:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('give up reveals', await page.isVisible('#reveal'));
  await page.click('#rv-close');
  await page.click('#restart-btn');
  await page.waitForTimeout(600);
  check('restart begins a fresh game at chapter 1', (await page.textContent('#p-progress')).trim().startsWith('1장'));
  await page.click('#back-btn');

  // ---- feedback, reset
  await page.click('#feedback summary');
  await page.fill('#fb-text', '테스트 의견입니다.');
  await page.click('#fb-send');
  await page.waitForTimeout(500);
  check('feedback is accepted', (await page.textContent('#fb-status')).includes('받았어요'));
  await page.click('#reset-btn'); await page.click('#reset-yes');
  await page.waitForTimeout(500);
  check('reset clears records', !((await page.textContent('#menu-cols')) || '').includes('완주'));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  // ---- phone
  const phone = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
  await phone.goto(BASE + '/');
  await phone.waitForSelector('#menu-cols button');
  check('no horizontal overflow at 375px', (await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  await browser.close();

  // ---- API guards
  const cookie = (await fetch(BASE + '/api/config')).headers.get('set-cookie').split(';')[0];
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const game = await (await fetch(BASE + '/api/games', { method: 'POST', headers: H, body: '{"puzzleId":"parrot-702"}' })).json();
  const long = await fetch(`${BASE}/api/games/${game.game.id}/ask`, { method: 'POST', headers: H, body: JSON.stringify({ text: 'ㄱ'.repeat(400) }) });
  check('an over-long question is refused', long.status === 400);
  const other = await fetch(`${BASE}/api/games/${game.game.id}`, { headers: { Cookie: 'sts=forged.value' } });
  check("another browser cannot read someone's game", other.status === 404, String(other.status));
  const note = await fetch(`${BASE}/api/games/${game.game.id}/host-note`, { headers: H });
  check('host note only covers the current chapter', !leaks(JSON.stringify(await note.json())).some(s => raw[1].chapters[1].truth[0].startsWith(s)));
  check('admin stats need the token', (await fetch(BASE + '/api/admin/stats')).status === 401);
  const stats = await (await fetch(BASE + '/api/admin/stats', { headers: { Authorization: 'Bearer e2e-admin' } })).json();
  check('admin stats count AI calls and spend', stats.calls.length > 0 && stats.spend.length > 0 && stats.spend[0].cost_micro > 0, JSON.stringify(stats.spend));
  check('admin stats list the feedback', stats.feedback.some(f => f.text.includes('테스트 의견')));

  // ---- what went to Claude
  const reqs = fs.readFileSync(path.join(OUT, 'stub-requests.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  check('the API key never comes from the browser', reqs.every(r => r.headers.key === 'sk-test-not-real'));
  check('puzzle block is marked for caching', reqs.every(r => r.body.system[1] && r.body.system[1].cache_control));
  const sameP = reqs.filter(r => r.body.system[1].text.includes(first.title) && r.body.model === reqs[0].body.model);
  check('system prompt is byte-identical across questions of one puzzle', new Set(sameP.map(r => JSON.stringify(r.body.system))).size === 1, `${sameP.length} calls`);
  check('structured output schema is sent', reqs.every(r => r.body.output_config && r.body.output_config.format && r.body.output_config.format.type === 'json_schema'));

  cleanup();
  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log(failed ? `E2E: ${failed} FAILED` : `E2E: ALL PASS (${results.length})`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('E2E CRASHED:', e && e.stack || e); console.log(results.join('\n')); cleanup(); process.exit(1); });
