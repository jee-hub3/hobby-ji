// public/music.js를 claude.ai 아티팩트판 index.html(한 파일)에 그대로 인라인한다. 몇 번을 돌려도 결과가 같다.
//   node tools/sync-music.js            표시 사이를 원본으로 덮어쓴다 (없으면 넣는다)
//   node tools/sync-music.js --check    덮어쓰지 않고, 사본이 원본과 바이트 단위로 같은지만 본다 (다르면 exit 1)
// 표시: <!-- music:start --> <script id="sts-music"> … </script> <!-- music:end -->
// 넣는 자리: 게임 스크립트 다음, </body>가 있으면 그 앞, <!-- motion:start -->가 있으면 그 앞 (docs/MOTION.md 4.6)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'public/music.js');
const PAGE = path.resolve(ROOT, '..', 'index.html');
const START = '<!-- music:start -->', END = '<!-- music:end -->';
const OPEN = '<script id="sts-music">\n', CLOSE = '</script>';

let js = fs.readFileSync(SRC, 'utf8');
if (!js.endsWith('\n')) js += '\n';
if (/<\/script/i.test(js) || js.includes(START) || js.includes(END)) { console.error('music.js must not contain </script or the markers'); process.exit(1); }
const block = START + '\n' + OPEN + js + CLOSE + '\n' + END;
const html = fs.readFileSync(PAGE, 'utf8');

export function extract(text) { // 테스트(U12)도 쓴다: 아티팩트 안의 사본
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a < 0 || b < a) return null;
  const inner = text.slice(a + START.length, b);
  const i = inner.indexOf(OPEN), j = inner.lastIndexOf(CLOSE);
  return i < 0 || j < i ? null : inner.slice(i + OPEN.length, j);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  if (process.argv.includes('--check')) {
    const ok = extract(html) === js;
    console.log(ok ? 'music: artifact copy matches public/music.js' : 'music: artifact copy is missing or stale (run npm run music:sync)');
    process.exit(ok ? 0 : 1);
  }
  let out;
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a >= 0 && b > a) out = html.slice(0, a) + block + html.slice(b + END.length);
  else {
    const at = [html.indexOf('<!-- motion:start -->'), html.lastIndexOf('</body>')].filter(i => i >= 0);
    const pos = at.length ? Math.min(...at) : -1;
    out = pos >= 0 ? html.slice(0, pos) + block + '\n' + html.slice(pos) : html.replace(/\s*$/, '') + '\n' + block + '\n';
  }
  if (out === html) console.log('music: artifact already up to date');
  else { fs.writeFileSync(PAGE, out); console.log(`music: inlined ${Buffer.byteLength(js)} bytes into ${path.relative(process.cwd(), PAGE) || PAGE}`); }
}
