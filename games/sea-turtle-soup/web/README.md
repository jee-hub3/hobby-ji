# 바다거북 스프 웹 서비스 (베타)

claude.ai 아티팩트로 만든 게임을 누구나 접속하는 독립 웹 서비스로 옮긴 것입니다.
디자인은 확정한 「밤의 카운터」 그대로이고, 게임 진행과 AI 진행자만 서버로 옮겼습니다.

## 무엇이 달라졌나

| | claude.ai 아티팩트판 (`../index.html`) | 웹 서비스판 (이 폴더) |
| --- | --- | --- |
| AI 비용 | 보는 사람의 Claude 사용량 | 운영자의 Anthropic API 키 (베타 동안 무료 제공) |
| 접속 | claude.ai 계정, 공유 링크 | 아무 브라우저, 로그인 없음 |
| 정답 보관 | 페이지 안에 전부 들어 있음 | 서버에만 있음. 푼 장의 정답만 화면으로 나감 |
| 기록 | 브라우저 localStorage | 서버(D1), 브라우저마다 익명 ID |
| 비용 방어 | 없음 | 하루 예산, 기기·IP별 하루 한도, 분당 한도 |

## 구조

```
브라우저 (public/index.html)
   │  /api/*  (같은 출처, 쿠키 하나)
   ▼
Cloudflare Worker (src/worker.js)
   ├─ engine.js   게임 규칙: 장 해결, 힌트, 넘기기, 별점 (원래 게임과 같은 규칙)
   ├─ prompts.js  진행자 지시문: 공통 규칙 + 문제 본문(캐시) + 이번 질문
   ├─ ai.js       Claude 호출 (구조화 출력, 비용 계산)
   ├─ limits.js   하루 예산·한도 확인과 기록
   └─ D1          games, records, usage_daily, ai_calls, events, feedback
content/puzzles.json  문제 원문 (워커에 묶여 배포되고, 정적 파일로는 나가지 않음)
```

- 진행자 지시문은 서버가 만듭니다. 그래서 이 서버로는 '문제에 대한 판정' 말고는 Claude를 쓸 수 없습니다.
- 공통 규칙과 문제 본문을 앞에 두고 캐시 표시를 달아, 같은 문제를 여러 사람이 풀 때 입력 비용이 크게 줄어듭니다.
- 결제를 붙일 자리는 `canPlay()`(worker.js)와 문제별 `access` 값입니다. 지금은 모두 무료입니다.

## 로컬에서 실행

```bash
npm install
cp .dev.vars.example .dev.vars          # 값 채우기
npm run db:migrate:local
npm run dev                             # http://localhost:8787
```

실제 키 없이 해 보려면 가짜 Claude 서버를 띄우고 `.dev.vars`의 `ANTHROPIC_BASE_URL`을 그쪽으로 돌리면 됩니다.

```bash
node test/stub-anthropic.js 8790
```

## 테스트

```bash
npm test          # 엔진 단위 테스트 + 브라우저 통합 테스트 + 예산 소진 테스트
```

통합 테스트는 가짜 Claude 서버와 로컬 D1로 메뉴부터 결말까지 실제 브라우저에서 플레이합니다.
정답이 페이지나 API로 새지 않는지, 다른 브라우저가 남의 판을 읽을 수 없는지, 캐시 구조가 맞는지도 확인합니다.

## 설정값 (wrangler.jsonc `vars`)

| 이름 | 기본값 | 뜻 |
| --- | --- | --- |
| `MODEL_ASK` / `EFFORT_ASK` | claude-haiku-5-5 / low | 예·아니오 질문 판정 모델 |
| `MODEL_GUESS` / `EFFORT_GUESS` | claude-sonnet-5-5 / medium | 추리 판정 모델 |
| `AI_ENABLED` | true | false면 AI 진행 즉시 중단 (비상 스위치) |
| `AI_DAILY_BUDGET_USD` | 5 | 하루 전체 AI 예산. 넘으면 그날은 친구 진행만 |
| `AI_DEVICE_DAILY_CALLS` | 150 | 브라우저 하나의 하루 AI 호출 수 |
| `AI_IP_DAILY_CALLS` | 400 | IP 하나의 하루 AI 호출 수 |
| `AI_DEVICE_PER_MINUTE` | 8 | 브라우저 하나의 1분 호출 수 |
| `ALL_ACCESS` | false | true면 유료 표시된 문제도 모두 열기 |

비밀값: `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `ADMIN_TOKEN` (`wrangler secret put`).

## 문서

- [docs/DEPLOY.md](docs/DEPLOY.md) 처음 배포하는 순서
- [docs/OPERATIONS.md](docs/OPERATIONS.md) 베타 운영: 비용 보기, 비상 정지, 모델 바꾸기
- [docs/ROADMAP.md](docs/ROADMAP.md) 유료화까지 남은 일과 한 판당 비용
- [eval/](eval/run.js) 진행자 모델 정확도 시험
