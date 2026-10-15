// 아이콘 PNG와 공유 미리보기(og.png)를 만든다. 실행: node tools/render-images.js
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const svg = fs.readFileSync(path.join(ROOT, 'public/icon.svg'), 'utf8');
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy });
const page = await browser.newPage();
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: path.join(ROOT, `public/icon-${size}.png`), omitBackground: true });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html lang="ko"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@800&family=IBM+Plex+Sans+KR:wght@500&display=block">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0D0F11;font-family:"Gothic A1","WenQuanYi Zen Hei",sans-serif;color:#F3EFE7}
.glow{position:absolute;left:600px;top:-120px;width:760px;height:760px;transform:translateX(-50%);background:radial-gradient(circle,rgba(240,154,62,.42),rgba(240,154,62,0) 62%)}
.cord{position:absolute;left:600px;top:0;width:3px;height:110px;background:#B9BEBF}
.shade{position:absolute;left:530px;top:108px;width:0;height:0;border-left:70px solid transparent;border-right:70px solid transparent;border-bottom:74px solid #F3EFE7}
.bulb{position:absolute;left:566px;top:172px;width:68px;height:22px;border-radius:50%;background:#F09A3E}
h1{position:absolute;left:0;right:0;top:250px;margin:0;text-align:center;font-size:118px;font-weight:800;letter-spacing:-2px}
p{position:absolute;left:0;right:0;top:420px;margin:0;text-align:center;font:500 38px "IBM Plex Sans KR","WenQuanYi Zen Hei",sans-serif;color:#B9BEBF}
.tag{position:absolute;left:0;right:0;top:500px;text-align:center;font:500 26px "IBM Plex Sans KR","WenQuanYi Zen Hei",sans-serif;color:#FFB462}
</style></head><body><div class="glow"></div><div class="cord"></div><div class="shade"></div><div class="bulb"></div>
<h1>바다거북 스프</h1><p>예와 아니오로 푸는 한 시간짜리 추리 게임</p><div class="tag">이상한 장면 하나 · AI 진행자 · 장을 넘기며 푸는 이야기</div></body></html>`, { waitUntil: 'networkidle' }).catch(() => {});
await page.evaluate(() => document.fonts.ready);
const fam = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join(','));
console.log('fonts loaded:', fam || '(fallback)');
await page.screenshot({ path: path.join(ROOT, 'public/og.png') });
await browser.close();
console.log('images written');
