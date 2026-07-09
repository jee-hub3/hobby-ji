# API 응답 구조 — `GET /api/oauth/usage`

비공식 API. `scripts/verify-usage.js`로 실제 덤프해 확인함 (2026-07-09, claude CLI 2.1.205 기준).
필드명·존재 여부는 예고 없이 바뀔 수 있으므로 파싱 코드는 방어적으로 작성할 것.

## 요청

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <claudeAiOauth.accessToken>
Content-Type: application/json
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/<claude --version 에서 추출한 버전>
```

## 응답 예시 (실제 값은 마스킹/각색)

```json
{
  "five_hour": {
    "utilization": 87,
    "resets_at": "2026-07-09T07:20:00.099682+00:00",
    "limit_dollars": null,
    "used_dollars": null,
    "remaining_dollars": null
  },
  "seven_day": {
    "utilization": 20,
    "resets_at": "2026-07-14T22:00:00.099705+00:00",
    "limit_dollars": null,
    "used_dollars": null,
    "remaining_dollars": null
  },
  "seven_day_oauth_apps": null,
  "seven_day_opus": null,
  "seven_day_sonnet": null,
  "seven_day_cowork": null,
  "seven_day_omelette": null,
  "tangelo": null,
  "iguana_necktie": null,
  "omelette_promotional": null,
  "nimbus_quill": null,
  "cinder_cove": null,
  "amber_ladder": null,
  "extra_usage": {
    "is_enabled": false,
    "monthly_limit": 2000,
    "used_credits": 0,
    "utilization": 0,
    "currency": "USD",
    "decimal_places": 2,
    "disabled_reason": "out_of_credits",
    "daily": null,
    "weekly": null
  },
  "limits": [
    {
      "kind": "session",
      "group": "session",
      "percent": 87,
      "severity": "warning",
      "resets_at": "2026-07-09T07:20:00.099682+00:00",
      "scope": null,
      "is_active": true
    },
    {
      "kind": "weekly_all",
      "group": "weekly",
      "percent": 20,
      "severity": "normal",
      "resets_at": "2026-07-14T22:00:00.099705+00:00",
      "scope": null,
      "is_active": false
    },
    {
      "kind": "weekly_scoped",
      "group": "weekly",
      "percent": 8,
      "severity": "normal",
      "resets_at": "2026-07-14T22:00:00.099974+00:00",
      "scope": { "model": { "id": null, "display_name": "Fable" }, "surface": null },
      "is_active": false
    }
  ],
  "spend": {
    "used": { "amount_minor": 0, "currency": "USD", "exponent": 2 },
    "limit": { "amount_minor": 2000, "currency": "USD", "exponent": 2 },
    "percent": 0,
    "severity": "normal",
    "enabled": false,
    "disabled_reason": "out_of_credits",
    "cap": { "money": null, "credits": { "amount_minor": 2000, "exponent": 2 } },
    "balance": null,
    "auto_reload": null,
    "disclaimer": "Usage credits cover you when you hit your plan limits. [Learn more](https://support.claude.com/articles/12429409)",
    "can_purchase_credits": false,
    "can_toggle": false
  },
  "member_dashboard_available": false
}
```

## 필드 설명 (위젯에 필요한 핵심 위주)

### `five_hour` — 세션(5시간) 사용량 ⭐

| 필드 | 타입 | 설명 |
|---|---|---|
| `utilization` | number (0-100) | 세션 사용률(%). 위젯 메인 바에 표시 |
| `resets_at` | string (ISO 8601, UTC) | 세션 리셋 시각. 카운트다운에 사용 |
| `limit_dollars` / `used_dollars` / `remaining_dollars` | number \| null | 관측 응답에서는 항상 `null`. Max 플랜 등 일부 플랜에서만 채워질 가능성 있음 — 존재 여부 확인 후 사용 |

### `seven_day` — 주간(7일) 사용량 ⭐

`five_hour`와 동일한 필드 구조. 전체 모델 통합 주간 사용률.

### `seven_day_*`, `tangelo`, `iguana_necktie`, `omelette_promotional`, `nimbus_quill`, `cinder_cove`, `amber_ladder`

관측된 응답에서는 전부 `null`. 모델별/프로모션별 별도 주간 한도를 위해 예약된 필드로 추정되나 현재 계정에서는 비활성 상태로 보임. **파싱 코드에서 사용하지 말 것** — 값이 채워질 때 구조가 어떻게 바뀔지 알 수 없음.

### `limits[]` — 세션/주간 한도의 배열 표현 (중복 정보 + 부가 메타)

`five_hour`/`seven_day`와 같은 수치를 배열 형태로도 제공하며, 추가로 `severity`(`normal`/`warning`/...)와 `is_active`(현재 이 한도가 실제로 소비 제한 중인지)를 담고 있음.

| 필드 | 타입 | 설명 |
|---|---|---|
| `kind` | string | `"session"` \| `"weekly_all"` \| `"weekly_scoped"` 등 |
| `group` | string | `"session"` \| `"weekly"` |
| `percent` | number (0-100) | `five_hour.utilization` / `seven_day.utilization`과 동일 값 |
| `severity` | string | `"normal"`, `"warning"` 등 — 위젯 경고 색상에 활용 가능 |
| `resets_at` | string (ISO) | 위와 동일 |
| `scope` | object \| null | `weekly_scoped`일 때 `{ model: { id, display_name }, surface }` 형태로 특정 모델 한정 한도를 나타냄 |
| `is_active` | boolean | 현재 이 한도로 인해 실제 제한이 걸려있는지 |

`kind: "session"` → `five_hour`와 매칭, `kind: "weekly_all"` → `seven_day`와 매칭.

### `extra_usage` — 종량제(pay-as-you-go) 초과 사용량

플랜 한도 초과 시 과금되는 크레딧 관련 정보. `is_enabled: false`면 종량제 미사용.

### `spend` — 크레딧/결제 정보

`extra_usage`와 유사하나 더 상세한 결제 관련 필드(`cap`, `balance`, `auto_reload` 등). 위젯 MVP 범위 밖.

### `member_dashboard_available`

boolean. 팀/조직 대시보드 접근 가능 여부로 추정. 위젯과 무관.

## 위젯에서 실제로 쓰는 필드 (요약)

```
session: five_hour.utilization, five_hour.resets_at, (선택) limits[kind=session].severity
weekly:  seven_day.utilization, seven_day.resets_at, (선택) limits[kind=weekly_all].severity
```

`parseUsage()` 구현은 [scripts/verify-usage.js](../scripts/verify-usage.js) 참고.

## 오류 응답

- `401 Unauthorized`: 토큰 만료. 본문 구조 미확인 — 발생 시 여기에 추가할 것.
- `429 Too Many Requests`: `Retry-After` 헤더 존재 예상 (02-아키텍처.md 참고, 미검증).
