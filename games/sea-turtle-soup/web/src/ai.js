// Claude 호출. 키는 서버 비밀값(ANTHROPIC_API_KEY)에만 있고, 지시문은 전부 서버가 만든다.
// 그래서 이 서버를 통해서는 '문제에 대한 예·아니오 판정' 말고는 Claude를 쓸 수 없다.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';
import { SYSTEM_RULES, puzzleBlock, askMessage, guessMessage } from './prompts.js';
import { ANSWER_CODES } from './engine.js';

const AskSchema = z.object({
  answer: z.enum(ANSWER_CODES),
  note: z.string(),
  hits: z.array(z.number().int()),
});
const GuessSchema = z.object({
  matched: z.array(z.number().int()),
  comment: z.string(),
});

// USD per million tokens. Cache reads ≈ 0.1×, 5-minute cache writes ≈ 1.25× of the input price.
// Override with the PRICES_JSON variable if the price list changes.
const DEFAULT_PRICES = {
  'claude-haiku-5-5': { in: 0.10, out: 0.50, read: 0.01, write: 0.125 },
  'claude-sonnet-5-5': { in: 2.00, out: 10.00, read: 0.20, write: 2.50 },
  'claude-opus-5-5': { in: 4.00, out: 20.00, read: 0.20, write: 5.00 },
};

export function priceFor(env, model) {
  let table = DEFAULT_PRICES;
  try { if (env.PRICES_JSON) table = { ...DEFAULT_PRICES, ...JSON.parse(env.PRICES_JSON) }; } catch { /* keep defaults */ }
  return table[model] || DEFAULT_PRICES['claude-sonnet-5-5'];
}

/** Cost of one call in micro-dollars (1e-6 USD). */
export function costMicro(env, model, usage) {
  const pr = priceFor(env, model);
  const u = usage || {};
  const usd = ((u.input_tokens || 0) * pr.in + (u.output_tokens || 0) * pr.out +
    (u.cache_read_input_tokens || 0) * pr.read + (u.cache_creation_input_tokens || 0) * pr.write) / 1e6;
  return Math.round(usd * 1e6);
}

export class AIError extends Error {
  constructor(code, message, usage) { super(message || code); this.code = code; this.usage = usage || null; }
}

function client(env) {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined, // tests point this at a local stub
    maxRetries: 1,
    timeout: 45_000,
  });
}

function system(p) {
  return [
    { type: 'text', text: SYSTEM_RULES },
    { type: 'text', text: puzzleBlock(p), cache_control: { type: 'ephemeral' } },
  ];
}

async function call(env, { model, effort, maxTokens, p, message, format }) {
  let res;
  try {
    res = await client(env).messages.parse({
      model,
      max_tokens: maxTokens,
      system: system(p),
      messages: [{ role: 'user', content: message }],
      output_config: { format, ...(effort ? { effort } : {}) },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AIError('upstream_busy', e.message);
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AIError('misconfigured', e.message);
    if (e instanceof Anthropic.BadRequestError) throw new AIError('bad_request', e.message);
    if (e instanceof Anthropic.APIConnectionError) throw new AIError('upstream_error', e.message);
    if (e instanceof Anthropic.APIError) throw new AIError('upstream_error', e.message);
    throw new AIError('invalid_json', e && e.message);
  }
  if (res.stop_reason === 'refusal') throw new AIError('refused', 'refusal', res.usage);
  if (!res.parsed_output) throw new AIError('invalid_json', `stop_reason=${res.stop_reason}`, res.usage);
  return { out: res.parsed_output, usage: res.usage, model: res.model || model };
}

const clean = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const nums = (list, allowed) => [...new Set((list || []).map(Number).filter(n => Number.isInteger(n) && allowed.includes(n)))];

export async function judgeQuestion(env, p, g, question) {
  const model = env.MODEL_ASK || 'claude-haiku-5-5';
  const r = await call(env, {
    model, effort: env.EFFORT_ASK || undefined, maxTokens: Number(env.MAX_TOKENS_ASK) || 4096,
    p, message: askMessage(p, g, question), format: zodOutputFormat(AskSchema),
  });
  const counts = r.out.answer !== 'invalid' && r.out.answer !== 'irrelevant';
  return {
    ruling: { answer: r.out.answer, note: clean(r.out.note, 80), hits: counts ? nums(r.out.hits, p.keyList.map(k => k.n)) : [] },
    usage: r.usage, model: r.model,
  };
}

export async function judgeGuess(env, p, g, guess) {
  const model = env.MODEL_GUESS || 'claude-sonnet-5-5';
  const r = await call(env, {
    model, effort: env.EFFORT_GUESS || undefined, maxTokens: Number(env.MAX_TOKENS_GUESS) || 8192,
    p, message: guessMessage(p, g, guess), format: zodOutputFormat(GuessSchema),
  });
  return {
    ruling: { matched: nums(r.out.matched, p.chapters[g.chapter - 1].keys), comment: clean(r.out.comment, 160) },
    usage: r.usage, model: r.model,
  };
}
