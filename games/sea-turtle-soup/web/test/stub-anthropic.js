// 로컬 테스트용 가짜 Claude Messages API. 실제 키 없이 서버 전체 흐름을 돌려 보려고 쓴다.
//   질문 안의 "#N"  → 핵심 단서 N을 짚은 '예'
//   추리             → 그 장의 핵심 단서를 모두 맞힘
//   "#REFUSE"        → stop_reason: refusal
//   "#BOOM"          → 500 오류
// 받은 요청은 test/.out/stub-requests.jsonl 에 남겨 캐시 구조를 검사한다.
import http from 'node:http';
import fs from 'node:fs';

const port = Number(process.argv[2] || 8790);
const log = process.argv[3] || 'test/.out/stub-requests.jsonl';
const seen = new Set();

http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => {
    if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) { res.writeHead(404); res.end('{}'); return; }
    const body = JSON.parse(raw || '{}');
    fs.appendFileSync(log, JSON.stringify({ headers: { key: req.headers['x-api-key'] }, body }) + '\n');
    const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : '';
    const quoted = (user.match(/"""([\s\S]*?)"""/) || [, ''])[1];
    if (quoted.includes('#BOOM')) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } })); return; }
    let out;
    if (user.includes('[과제: 추리 판정]')) {
      const keys = ((user.match(/이 장의 핵심 단서 번호: ([\d, ]+)/) || [, ''])[1]).split(',').map(x => Number(x.trim())).filter(Boolean);
      out = { matched: quoted.includes('#NONE') ? [] : keys, comment: '핵심을 정확히 짚었어요.' };
    } else {
      const hits = [...quoted.matchAll(/#(\d+)/g)].map(m => Number(m[1]));
      const a = hits.length ? 'yes' : (quoted.length % 3 === 0 ? 'irrelevant' : quoted.length % 2 ? 'no' : 'partly');
      out = { answer: a, note: a === 'partly' ? '방향은 맞아요.' : '', hits };
    }
    const sys = JSON.stringify(body.system);
    const cached = seen.has(body.model + sys);
    seen.add(body.model + sys);
    const msg = {
      id: 'msg_stub_' + Math.random().toString(36).slice(2), type: 'message', role: 'assistant', model: body.model,
      content: [{ type: 'text', text: JSON.stringify(out) }],
      stop_reason: quoted.includes('#REFUSE') ? 'refusal' : 'end_turn', stop_sequence: null,
      usage: { input_tokens: 900, output_tokens: 60, cache_read_input_tokens: cached ? 14000 : 0, cache_creation_input_tokens: cached ? 0 : 14000 },
    };
    setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(msg)); }, 120);
  });
}).listen(port, '127.0.0.1', () => console.log(`stub anthropic on ${port}`));
