# 처음 배포하기

사용자님 계정이 필요한 단계라 제가 대신할 수 없는 부분입니다. 30분 정도 걸립니다.
아래 명령은 사용자님 컴퓨터의 이 폴더(`games/sea-turtle-soup/web`)에서 실행합니다.

## 1. 계정 준비

1. **Anthropic API 키**: console.anthropic.com 에서 결제 수단을 등록하고 API 키를 만듭니다.
   - **Limits에서 월 사용 한도를 먼저 걸어 두세요.** 서버에도 하루 예산 상한이 있지만, 계정 한도가 최후의 안전장치입니다. 베타라면 월 50달러 정도로 시작을 권합니다.
2. **Cloudflare 계정**: dash.cloudflare.com 에서 무료 계정을 만듭니다. 베타 규모에서는 무료 요금제로 충분합니다.
3. (선택) **도메인**: 있으면 연결하고, 없으면 `sea-turtle-soup.<계정이름>.workers.dev` 주소를 그대로 씁니다.

## 2. 설치와 로그인

```bash
npm install
npx wrangler login            # 브라우저가 열리면 Cloudflare 로그인
```

## 3. 데이터베이스 만들기

```bash
npx wrangler d1 create sea-turtle-soup
```

출력된 `database_id`를 `wrangler.jsonc`의 `"database_id"` 자리에 붙여 넣고, 표를 만듭니다.

```bash
npm run db:migrate:remote
```

## 4. 비밀값 등록

```bash
npx wrangler secret put ANTHROPIC_API_KEY     # 1단계에서 만든 키
npx wrangler secret put SESSION_SECRET        # 아무 긴 무작위 문자열 (예: openssl rand -hex 32)
npx wrangler secret put ADMIN_TOKEN           # 운영 통계를 볼 때 쓸 무작위 문자열
```

## 5. 법적 문서 채우기

`public/privacy.html`, `public/terms.html`의 `[운영자 이름]`, `[연락처 이메일]`, `[시행일]`을 채웁니다.
두 문서는 초안이라, 정식 출시(특히 유료 판매) 전에는 전문가 검토를 받으세요.

## 6. 배포

```bash
npm test          # 배포 전 확인 (가짜 Claude로 끝까지 플레이)
npm run deploy
```

출력된 주소로 접속해 한 판을 직접 해 봅니다. 첫 질문의 답이 오면 성공입니다.

## 7. 확인

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://<주소>/api/admin/stats?days=1
```

`spend`에 오늘 쓴 금액, `calls`에 모델별 호출 수와 평균 응답 시간이 나옵니다.

## 자동 배포 (선택)

GitHub에 올릴 때마다 배포하려면 Cloudflare API 토큰을 저장소 비밀값 `CLOUDFLARE_API_TOKEN`으로 등록하고,
`cloudflare/wrangler-action`으로 `npm run deploy`를 돌리는 워크플로를 추가하면 됩니다.
베타 초기에는 손으로 배포하는 편이 안전합니다.
