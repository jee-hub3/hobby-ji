# 베타 운영 안내

## 매일 볼 것

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "https://<주소>/api/admin/stats?days=7" | jq
```

| 항목 | 뜻 | 볼 점 |
| --- | --- | --- |
| `spend` | 날짜별 AI 호출 수와 비용(백만분의 1달러) | 하루 예산에 자주 닿으면 예산을 올리거나 한도를 낮춘다 |
| `calls` | 종류·모델별 호출 수, 성공 수, 평균 응답 시간, 토큰 | `cache_read`가 `input`보다 훨씬 커야 캐시가 잘 맞는 것 |
| `funnel` | start, chapter_clear, solved, gaveup, hint, skip 수 | 시작 대비 완식 비율, 포기가 몰리는 곳 |
| `perPuzzle` | 문제별 시작·완식·포기·힌트·넘김 | 너무 어렵거나 쉬운 문제 찾기 |
| `costPerGame` | 문제별 판 수와 AI 비용 | 유료 가격을 정하는 근거 |
| `feedback` | 의견 보내기 내용 | 이상한 답, 막힌 장 |

## 비상 정지

AI 비용이 이상하게 늘거나 악용이 보이면 바로 끕니다. 친구 진행은 계속 됩니다.

```bash
# wrangler.jsonc 에서 "AI_ENABLED": "false" 로 바꾼 뒤
npm run deploy
```

키가 새어 나갔다고 의심되면 Anthropic 콘솔에서 키를 폐기하고 새 키를 `wrangler secret put ANTHROPIC_API_KEY`로 넣습니다.

## 예산과 한도 바꾸기

`wrangler.jsonc`의 `AI_DAILY_BUDGET_USD`, `AI_DEVICE_DAILY_CALLS` 등을 고치고 `npm run deploy`.
하루 예산 5달러는 한 판 200~350원 기준으로 하루 20~35판 정도입니다(docs/ROADMAP.md 비용 표 참고).

## 진행자 모델 고르기

1. `node eval/run.js --dry` 로 시험 비용을 봅니다(기본 설정 4개, 약 3달러).
2. `ANTHROPIC_API_KEY=... node eval/run.js --yes` 로 실행합니다.
3. 결과 표에서 **답 일치**와 **예↔아니오 뒤집힘**을 가장 먼저 봅니다. 뒤집힘은 플레이어를 엉뚱한 길로 보내는 가장 나쁜 오답입니다.
4. 품질이 충분한 가장 싼 설정을 `MODEL_ASK`/`EFFORT_ASK`에 넣고 배포합니다.

참고 판정은 플레이테스트 때 강한 모델이 진행자로 낸 답이라 정답표가 아닙니다. 불일치 사례는 `eval/.out/report-*.json`에서 직접 읽어 보고 판단하세요.
시험 세트는 지금 《불 하나의 밤》 90문항뿐입니다. 베타에서 모인 실제 질문(의견 보내기로 들어온 이상한 답 포함)을 `eval/data/`에 더해 가면 좋습니다.

## 개인정보 요청

이용자는 익명 ID로만 구분됩니다. 삭제 요청이 오면 그 브라우저에서 "기록 지우기"를 누르게 안내하는 것이 가장 정확합니다.
보관 기간이 지난 데이터는 매일 새벽 4시(한국 시간)에 자동으로 지워집니다(`scheduled` 핸들러).
