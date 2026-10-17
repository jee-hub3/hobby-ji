// public/music.js만 claude.ai 아티팩트판 index.html(한 파일)에 인라인한다 (npm run music:sync). 음악과 모션을 함께는 npm run sync.
//   node tools/sync-music.js            표시 사이를 원본으로 덮어쓴다 (없으면 넣는다)
//   node tools/sync-music.js --check    덮어쓰지 않고, 사본이 원본과 바이트 단위로 같은지만 본다 (다르면 exit 1)
// 표시: <!-- music:start --> <script id="sts-music"> … </script> <!-- music:end -->
// 넣는 자리와 공통 구현: tools/sync-modules.js (docs/MOTION.md 4.1, 4.6)
import path from 'node:path';
import { extract as extractModule, main } from './sync-modules.js';

export function extract(text) { return extractModule(text, 'music'); } // 테스트(U12)가 쓴다: 아티팩트 안의 사본

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main(['music', ...process.argv.slice(2)]);
