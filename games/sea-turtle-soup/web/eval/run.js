// 진행자 모델 정확도·비용·속도 시험.
// 플레이테스트에서 나온 실제 질문을, 그때와 같은 진행 상황(장, 앞선 질문과 답, 밝힌 단서)으로 다시 물어
// 참고 판정(eval/data/*.json)과 얼마나 일치하는지 잰다. 실제 API를 부르므로 돈이 든다.
//
//   예상 비용만 보기:   node eval/run.js --dry
//   실행:               ANTHROPIC_API_KEY=... node eval/run.js --yes
//   설정 고르기:        --configs claude-haiku-5-5:low,claude-sonnet-5-5:low   (모델:노력 수준)
//   일부만:             --limit 30        동시 호출 수: --concurrency 4
import fs from 'node:fs';
import path from 'node:path';
import { normalizePuzzles } from '../src/content.js';
import { judgeQuestion, judgeGuess, costMicro } from '../src/ai.js';
import { SYSTEM_RULES, puzzleBlock, askMessage } from '../src/prompts.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null).filter(Boolean));
const CONFIGS = String(args.configs || 'claude-haiku-5-5:low,claude-haiku-5-5:medium,claude-sonnet-5-5:low,claude-sonnet-5-5:medium')
  .split(',').map(s => { const [model, effort] = s.split(':'); return { model, effort: effort || undefined, name: s }; });
const LIMIT = Number(args.limit) || Infinity;
const CONC = Number(args.concurrency) || 4;
const GUESS_MODEL = args['guess-model'] || 'claude-sonnet-5-5:medium';

const P = Object.fromEntries(normalizePuzzles(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/puzzles.json'), 'utf8'))).map(p => [p.id, p]));
const sets = fs.readdirSync(path.join(ROOT, 'eval/data')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'eval/data', f), 'utf8')));
const questions = sets.flatMap(s => s.questions).slice(0, LIMIT);
const guesses = sets.flatMap(s => s.guesses || []);

function gameFor(item) {
  return {
    id: 'eval', puzzleId: item.puzzleId, chapter: item.chapter, found: [...item.found], phase: 'play',
    hints: [0, 0, 0, 0], skipped: [], elapsed: 0,
    log: item.history.map(h => ({ kind: 'q', text: h.q, a: h.a })),
  };
}

// rough cost preview (characters → tokens with a deliberately generous ratio)
function preview() {
  const tpc = 1.2;
  console.log(`questions: ${questions.length} · guesses: ${guesses.length} · configs: ${CONFIGS.map(c => c.name).join(', ')}`);
  let total = 0;
  for (const c of CONFIGS) {
    let micro = 0;
    for (const it of questions) {
      const p = P[it.puzzleId];
      const stat = (SYSTEM_RULES.length + puzzleBlock(p).length) * tpc;
      const dyn = askMessage(p, gameFor(it), it.text).length * tpc;
      micro += costMicro({}, c.model, { cache_read_input_tokens: stat, input_tokens: dyn, output_tokens: c.effort === 'low' ? 300 : 900 });
    }
    micro += costMicro({}, c.model, { cache_creation_input_tokens: 25000 });
    console.log(`  ${c.name.padEnd(28)} ≈ $${(micro / 1e6).toFixed(2)}`);
    total += micro;
  }
  console.log(`  total ≈ $${(total / 1e6).toFixed(2)} (+ guesses on ${GUESS_MODEL})`);
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const POS = new Set(['yes', 'partly']);
function score(rows) {
  const ok = rows.filter(r => !r.error);
  const exact = ok.filter(r => r.answer === r.ref.answer).length;
  const polarity = ok.filter(r => (POS.has(r.answer) === POS.has(r.ref.answer)) && ((r.answer === 'irrelevant') === (r.ref.answer === 'irrelevant'))).length;
  const yesNoFlip = ok.filter(r => (r.answer === 'yes' && r.ref.answer === 'no') || (r.answer === 'no' && r.ref.answer === 'yes')).length;
  let tp = 0, fp = 0, fn = 0;
  for (const r of ok) { const ref = new Set(r.ref.hits); for (const h of r.hits) ref.has(h) ? tp++ : fp++; for (const h of ref) if (!r.hits.includes(h)) fn++; }
  const ms = ok.map(r => r.ms).sort((a, b) => a - b);
  const conf = {};
  for (const r of ok) { conf[r.ref.answer] = conf[r.ref.answer] || {}; conf[r.ref.answer][r.answer] = (conf[r.ref.answer][r.answer] || 0) + 1; }
  return {
    n: rows.length, errors: rows.length - ok.length,
    exact: ok.length ? exact / ok.length : 0, polarity: ok.length ? polarity / ok.length : 0, yesNoFlip,
    hitsPrecision: tp + fp ? tp / (tp + fp) : 1, hitsRecall: tp + fn ? tp / (tp + fn) : 1,
    p50ms: ms[Math.floor(ms.length * 0.5)] || 0, p90ms: ms[Math.floor(ms.length * 0.9)] || 0,
    costUsd: rows.reduce((a, r) => a + (r.cost || 0), 0) / 1e6, confusion: conf,
  };
}

async function main() {
  preview();
  if (args.dry) return;
  if (!args.yes) { console.log('\n실제 API를 부르려면 --yes 를 붙이세요 (위 금액이 듭니다).'); return; }
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY가 필요합니다.'); process.exit(1); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(ROOT, 'eval/.out');
  fs.mkdirSync(outDir, { recursive: true });
  const report = { at: stamp, configs: {}, guesses: null };

  for (const c of CONFIGS) {
    const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL, MODEL_ASK: c.model, EFFORT_ASK: c.effort };
    process.stdout.write(`\n${c.name}: `);
    const rows = await pool(questions, CONC, async it => {
      const p = P[it.puzzleId];
      const t0 = Date.now();
      try {
        const r = await judgeQuestion(env, p, gameFor(it), it.text);
        process.stdout.write(r.ruling.answer === it.ref.answer ? '.' : 'x');
        return { id: it.id, ref: it.ref, answer: r.ruling.answer, hits: r.ruling.hits, note: r.ruling.note, ms: Date.now() - t0, cost: costMicro(env, c.model, r.usage), usage: r.usage };
      } catch (e) {
        process.stdout.write('E');
        return { id: it.id, ref: it.ref, error: e.code || String(e), ms: Date.now() - t0, cost: costMicro(env, c.model, e.usage) };
      }
    });
    report.configs[c.name] = { summary: score(rows), rows };
  }

  if (guesses.length && !args['no-guesses']) {
    const [model, effort] = GUESS_MODEL.split(':');
    const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL, MODEL_GUESS: model, EFFORT_GUESS: effort };
    process.stdout.write(`\nguesses on ${GUESS_MODEL}: `);
    const rows = await pool(guesses, CONC, async it => {
      const p = P[it.puzzleId];
      try {
        const r = await judgeGuess(env, p, gameFor(it), it.text);
        const keys = p.chapters[it.chapter - 1].keys;
        const cleared = keys.every(k => r.ruling.matched.includes(k) || it.found.includes(k));
        process.stdout.write(cleared === it.ref.cleared ? '.' : 'x');
        return { id: it.id, ref: it.ref, matched: r.ruling.matched, cleared, comment: r.ruling.comment, cost: costMicro(env, model, r.usage) };
      } catch (e) { process.stdout.write('E'); return { id: it.id, error: e.code || String(e) }; }
    });
    report.guesses = { model: GUESS_MODEL, agree: rows.filter(r => !r.error && r.cleared === r.ref.cleared).length, n: rows.length, rows };
  }

  fs.writeFileSync(path.join(outDir, `report-${stamp}.json`), JSON.stringify(report, null, 1));
  const pct = x => `${(x * 100).toFixed(1)}%`;
  const lines = ['| 설정 | 답 일치 | 방향 일치 | 예↔아니오 뒤집힘 | 단서 정밀도 | 단서 재현율 | 중앙 응답 | 90% 응답 | 비용 | 오류 |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const [name, { summary: s }] of Object.entries(report.configs)) {
    lines.push(`| ${name} | ${pct(s.exact)} | ${pct(s.polarity)} | ${s.yesNoFlip} | ${pct(s.hitsPrecision)} | ${pct(s.hitsRecall)} | ${(s.p50ms / 1000).toFixed(1)}s | ${(s.p90ms / 1000).toFixed(1)}s | $${s.costUsd.toFixed(3)} | ${s.errors} |`);
  }
  if (report.guesses) lines.push('', `추리 판정(${report.guesses.model}): 참고 결과와 장 해결 여부 일치 ${report.guesses.agree}/${report.guesses.n}`);
  fs.writeFileSync(path.join(outDir, `report-${stamp}.md`), lines.join('\n') + '\n');
  console.log('\n\n' + lines.join('\n'));
  console.log(`\n자세한 결과: eval/.out/report-${stamp}.json`);
}
main().catch(e => { console.error(e); process.exit(1); });
