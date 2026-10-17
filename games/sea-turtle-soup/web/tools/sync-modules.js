// public/의 페이지 모듈(music.js, motion.js)을 claude.ai 아티팩트판 index.html(한 파일)에 그대로 인라인한다. 몇 번을 돌려도 결과가 같다.
//   node tools/sync-modules.js                 두 모듈 모두 표시 사이를 원본으로 덮어쓴다 (없으면 넣는다)   = npm run sync
//   node tools/sync-modules.js motion          하나만
//   node tools/sync-modules.js --check         덮어쓰지 않고, 사본이 원본과 바이트 단위로 같은지만 본다 (다르면 exit 1)
// 표시: <!-- NAME:start --> <script id="sts-NAME"> … </script> <!-- NAME:end -->
// 순서: 게임 스크립트 → music → motion (docs/MOTION.md 4.1, 4.6). 표시가 없을 때 넣는 자리:
//   music  — <!-- motion:start --> 앞, 없으면 </body> 앞, 없으면 맨 끝
//   motion — <!-- music:end --> 뒤, 없으면 </body> 앞, 없으면 맨 끝
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const PAGE = path.resolve(ROOT, '..', 'index.html');
export const MODULES = {
  music: { src: path.join(ROOT, 'public/music.js') },
  motion: { src: path.join(ROOT, 'public/motion.js') },
};
const marks = name => ({ START: `<!-- ${name}:start -->`, END: `<!-- ${name}:end -->`, OPEN: `<script id="sts-${name}">\n`, CLOSE: '</script>' });

export function source(name) {
  let js = fs.readFileSync(MODULES[name].src, 'utf8');
  if (!js.endsWith('\n')) js += '\n';
  const { START, END } = marks(name);
  if (/<\/script/i.test(js) || js.includes(START) || js.includes(END) || /<!--/.test(js)) throw new Error(`${name}.js must not contain </script, <!-- or its markers`);
  return js;
}

/* 아티팩트 안의 사본 (없으면 null). 테스트(U12, V9)도 쓴다 */
export function extract(text, name) {
  const { START, END, OPEN, CLOSE } = marks(name);
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a < 0 || b < a) return null;
  const inner = text.slice(a + START.length, b);
  const i = inner.indexOf(OPEN), j = inner.lastIndexOf(CLOSE);
  return i < 0 || j < i ? null : inner.slice(i + OPEN.length, j);
}

export function inline(html, name, js) {
  const { START, END, OPEN, CLOSE } = marks(name);
  const block = START + '\n' + OPEN + js + CLOSE + '\n' + END;
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a >= 0 && b > a) return html.slice(0, a) + block + html.slice(b + END.length);
  const body = html.lastIndexOf('</body>');
  if (name === 'motion') {
    const m = html.indexOf(marks('music').END);
    if (m >= 0) { const at = m + marks('music').END.length; return html.slice(0, at) + '\n' + block + html.slice(at); }
  } else {
    const m = html.indexOf(marks('motion').START);
    if (m >= 0) return html.slice(0, m) + block + '\n' + html.slice(m);
  }
  if (body >= 0) return html.slice(0, body) + block + '\n' + html.slice(body);
  return html.replace(/\s*$/, '') + '\n' + block + '\n';
}

export function main(argv) {
  const check = argv.includes('--check');
  const names = argv.filter(a => !a.startsWith('--'));
  const list = names.length ? names : Object.keys(MODULES);
  for (const n of list) if (!MODULES[n]) { console.error(`unknown module: ${n} (known: ${Object.keys(MODULES).join(', ')})`); process.exit(2); }
  const rel = path.relative(process.cwd(), PAGE) || PAGE;
  let html = fs.readFileSync(PAGE, 'utf8');
  if (check) {
    let bad = 0;
    for (const n of list) {
      const ok = extract(html, n) === source(n);
      if (!ok) bad++;
      console.log(ok ? `${n}: artifact copy matches public/${n}.js` : `${n}: artifact copy is missing or stale (run npm run sync)`);
    }
    process.exit(bad ? 1 : 0);
  }
  const before = html;
  for (const n of list) {
    const js = source(n), next = inline(html, n, js);
    console.log(next === html ? `${n}: artifact already up to date` : `${n}: inlined ${Buffer.byteLength(js)} bytes into ${rel}`);
    html = next;
  }
  if (html !== before) fs.writeFileSync(PAGE, html);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main(process.argv.slice(2));
