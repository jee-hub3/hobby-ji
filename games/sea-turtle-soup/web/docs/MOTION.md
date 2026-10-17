# 바다거북 스프 — 모션 사양 (「밤의 카운터」)

- 대상 화면: claude.ai 아티팩트 `index.html`, 웹 클라이언트 `web/public/index.html`. 두 화면의 DOM과 CSS는 같습니다.
- 구현: `web/public/motion.js` 모듈 하나(CSS를 한 번 주입하고 DOM을 관찰하며, 게임 로직은 바꾸지 않음)와 공유 수정 S1–S5, E1(4.4절).
- 이 문서는 사양만 정합니다. 프로젝트 파일은 아직 고치지 않았습니다. 같은 시기에 다른 팀이 배경 음악(`music.js`, `.theme-btn` 앞의 스피커 버튼 `.music-btn`, 사양 `web/docs/MUSIC.md`)을 넣고 있으므로 4.6절의 공존 규칙을 따릅니다.
- 근거 자료(이번 감사, 세션 스크래치패드): `/tmp/claude-0/-home-user-hobby-ji/b752a374-c720-5d5b-8066-f49aab6d8a5d/scratchpad/motion-audit/`
  - `stills/`: `shots.js` 스틸 23장. 콘솔 오류와 가로 넘침은 없습니다.
  - `video2/desktop-dark.webm`, `video2/phone-light.webm`: 1440×900 어두움, 390×844 밝음 전 과정 녹화. `*.anims.json`은 순간별 `document.getAnimations()` 목록이고, `*.vt.json`은 순간별 영상 시각입니다.
  - `strips2/`: 순간별 프레임 띠(ffmpeg fps=8). 아래 문서는 이 파일 이름으로 근거를 적습니다.
  - `tools/`: `rec.js`(녹화와 색 마커), `marks.py`(마커로 영상 시각 찾기), `strip.sh`(프레임 띠), `perf.js`(CDP 지표, CLS, 긴 작업), `csscheck.js`(이 문서의 CSS 블록 24개를 Chromium으로 파싱: 모두 통과), `proto-cover.js`(P0-1 시제품 측정).
- 상위 사양: `design-kit/review2/REVIEW.md` §4.2의 C2 모션 표와 §5.2 수용 기준. 이 문서는 그 표를 대체하지 않고 다듬고 넓힙니다. 숫자가 다르면 이 문서를 따릅니다.
- **접근성·UX 검토 반영본(2026-10-16)**: 오너 조건 "게임 진행을 방해하거나 내용을 파악하기 어렵게 하는 요소는 넣지 마"를 기준으로 항목마다 승인·조건부 승인·제외를 정했습니다. 바뀐 곳은 본문에 **[검토]** 표시를 달았고, 제외한 항목은 **제외**와 이유를 남겼습니다. 요약은 맨 끝 「검토 결과」에 있습니다.
  - 검토 측정 스크립트(세션 스크래치패드): `/tmp/claude-0/-home-user-hobby-ji/b752a374-c720-5d5b-8066-f49aab6d8a5d/scratchpad/motion-review/` (`busy.js`, `observer.js`, `clock.js`, `midphone.js`). 폰 프로필은 390×844, DPR 3, 터치, CPU 4배 감속입니다.
  - 이 문서의 CSS 블록을 고쳤으므로 구현 전에 `tools/csscheck.js`를 다시 돌립니다(검토 시점: 25개 모두 통과). 1.7.1에 블록이 하나 들어가 번호가 밀렸으므로, `proto-cover.js`로 다시 잴 때는 블록 0, 2, 3, 4(토큰, 흔들림, 김, 멈춤)를 씁니다.
- **[2차] 1차 구현 검토 반영(2026-10-17)**: 구현을 두 리뷰어가 프레임 단위로 검토한 결과(차단 8, 다듬기 14)를 본문에 반영했습니다. 바뀐 곳은 **[2차]** 표시를 달았고, 무엇을 왜 바꿨는지는 7.7에 모았습니다.

---

## 0. 한눈에

지금 있는 모션은 방향이 맞습니다. 답 배지, 장 디바이더, 리빌 메달이 그렇습니다. 감사에서 나온 문제는 네 갈래입니다.

1. **이미 읽은 글을 다시 움직입니다.**
   - 힌트를 하나 열면 앞서 연 힌트가 모두 다시 페이드업합니다(D2).
   - AI 답이 도착하면 방금 보낸 질문 말풍선이 한 번 더 나타납니다(D1).
2. **레이아웃을 매 프레임 건드립니다.**
   - 시계 막대: 플레이 내내 초당 60회 layout이 일어납니다(D3).
   - 표지의 김: 화면 밖에서도 초당 60회 style과 layout이 일어납니다(D4).
   - 답 말풍선 크기 변형: 폰에서 프레임마다 layout shift가 납니다(D5).
3. **큰 모션 두 개가 겹칩니다.** 장이 풀리면 오른쪽 디바이더가 펼쳐지는 동안 왼쪽 패널의 긴 장면 글이 흐려진 채 1,500px 넘게 스크롤됩니다(D6).
4. **비어 있는 순간이 있습니다.** 메뉴 스크롤, 메뉴⇄플레이 전환, 끝 바는 정적입니다. 테마 전환은 일부 요소만 따로 전환되어 얼룩집니다(D7). 단서 숫자 굴림은 AI 모드에서 보이지 않습니다(D8).

이번 사양의 구성입니다.

| 등급 | 수 | 내용 |
|---|---|---|
| P0 | 9 | 위 결함을 고치고, 표지·답·단서·힌트·장 해금의 핵심 순간을 다시 짭니다 |
| P1 | 10 | 메뉴 리빌, 오늘의 추천 깊이, 화면 진입, 테마 전환, 장 탭, 리빌·끝 바, 표지 첫 인사 등을 더합니다 |
| P2 | 10 | 토스트, 탭 안착, 가장자리 앰비언트 등 있으면 좋은 디테일입니다. **[검토]** P2-2, P2-7과 P2-4·P2-5의 일부는 제외했습니다 |

**[검토] 함께 들어가는 안전장치**: 페이지 안 「화면 움직임 줄이기」 스위치(1.7.1, WCAG 2.2.2), 스크롤 중·무입력 30초 뒤 앰비언트 정지(1.8), 보이지 않는 요소는 눌리지 않음(1.5-4), 접근성 불변 조건(1.10).

숫자 목표는 5절에 있습니다.
- 모션 때문에 생기는 CLS 0
- 플레이 화면의 상시 반복 애니메이션 0(대기 표시 제외)
- **[검토]** 표지 앰비언트의 layout 0회/프레임. 메인 스레드가 프레임을 그리는 동안의 추가 작업은 폰 프로필(CPU 4배 감속)에서 1.2 ms/프레임 이하이고, 스크롤 중에는 0(정지)
- `motion.js` **[2차]** 40 KB 이하(4.5)

---

## 1. 원칙

### 1.1 모션이 하는 일

모션은 두 가지 일만 합니다.

- **이해를 돕습니다.** 무엇이 새로 생겼는지, 어디서 왔는지, 무엇이 바뀌었는지 알려 줍니다(질문이 보내졌다, 답이 왔다, 단서가 찼다, 장이 열렸다).
- **분위기를 만듭니다.** 램프 한 등, 김, 밤 카드의 빛이 그렇습니다.

꾸밈만을 위한 모션은 넣지 않습니다. 한 그릇은 40–80분이고 대부분 읽는 시간입니다. 그래서 플레이 화면에서는 **사건이 있을 때만** 움직입니다.

### 1.2 글을 지키는 규칙 (가장 먼저 지킵니다)

**긴 글(LONG)**: 아래 요소와 그 안의 모든 글입니다.

```
#ch-scene, #ch-question-text, #ch-truth-body, #world-body, .hint-open p,
.dv-body, .rv-section .story, .rules-body
```

**짧은 글(SHORT)**: 말풍선(1–3줄), 답 배지, 라벨, 제목, 버튼, 탭, 숫자입니다.

| 규칙 | 내용 |
|---|---|
| R1 | **화면에 이미 있는 글은 움직이지 않습니다.** transform, opacity, filter, clip-path를 바꾸지 않고, 글자 크기·행간·폭·줄바꿈도 바꾸지 않습니다. 재렌더(`replaceChildren`)로 같은 글이 다시 그려지거나, `display:none`에서 다시 보일 때도 입장 모션을 다시 틀지 않습니다. |
| R2 | 새로 나타나는 **긴 글**은 한 번만, opacity만, 240ms 이하로 들어옵니다. 이동과 블러는 0입니다. |
| R3 | 새로 나타나는 **짧은 글**은 translate 12px 이하, scale 0.96 이상, 320ms 이하로 들어옵니다. **[검토]** 말풍선, 바, 독, 카드처럼 짧은 글을 담은 상자도 같습니다(P0-2, P1-1, P1-3, P1-7을 이 값으로 맞춤). 예외는 글자가 1–4자인 기호형 요소입니다: 48px 이하의 답 배지·단서 칸·탭과 리빌 메달(112px)은 1.6절 크기 제한 안에서 scale 0.6부터 씁니다. 같은 뜻이 옆 글과 `#log-announce`로도 전해지기 때문입니다. |
| R4 | **글 뒤에서 움직이는 배경은 없습니다.** 본문 박스 안에 빛·입자·그라디언트 움직임을 두지 않습니다. 빛과 번짐은 가장자리에만 둡니다(카드 윗선, 표지 램프 주변, 장 디바이더 머리의 숫자 쪽, 리빌 히어로). |
| R5 | 글을 숨기는 시간은 0입니다. 예외는 장 넘김 보류(P0-7, 최대 700ms, 폰 포함)와 메뉴 리빌(P1-1, 화면 밖 요소만)입니다. **[검토]** 오류·경고 문구(`#composer-status.warn`, 토스트)는 어떤 경우에도 첫 프레임부터 보입니다. |

허용하는 예외는 아래 세 가지뿐입니다.

| 예외 | 대상 | 허용 범위 | 이유 |
|---|---|---|---|
| X1 | `.reveal-card` 입장 | translateY 32px → 0, 560ms | 모달이 열리는 순간이라 아직 읽기 전입니다 |
| X2 | `.entry-chapter.fresh`, `.hint-open.m-new` | clip-path 펼침(위→아래), 640ms / 320ms | 글의 위치·크기·투명도는 그대로이고, 가려진 부분이 드러날 뿐입니다 |
| X3 | `.cover .lamp` 흔들림 | 표지 제목(H1) 뒤 빛 원뿔이 ±4.6px 이내로 이동 | 제목은 장식 글이고 원뿔은 투명도 34% → 0 그라디언트입니다 |

### 1.3 레이아웃: 모션이 만드는 CLS는 0입니다

- **애니메이션하는 속성**: `transform`, `opacity`.
- **제한적으로 허용**: 아래 범위 안에서만 씁니다.
  - `clip-path`: X2, 답 말풍선 변형(P0-3), 테마 원(P1-4)
  - `stroke-dashoffset`: 20px 이하 아이콘
  - `outline-offset`: P2-2 포커스 링
- **금지**: `width`, `height`, `top`, `left`, `margin`, `padding`, `font-*`, `line-height`, `letter-spacing`, `grid-*`, `flex-*`. 스크롤에 묶인 애니메이션(`animation-timeline`)도 쓰지 않습니다.
- **`filter`**: 애니메이션하지 않습니다. 정적 filter는 측정된 두 곳만 씁니다.
  - 김 줄기 `blur(1.5px)`: 합성 레이어 안에서 한 번만 래스터됩니다.
  - 기존 `.ft-art::before`의 `blur(12px)`
- **[검토] clip-path 키프레임**(`m-morph`, `m-paper`)은 `animation-fill-mode: backwards`로 씁니다. 끝나면 clip이 남지 않습니다(남은 clip은 안쪽 포커스 링과 그림자를 자를 수 있음). `to` 키프레임은 꼭 적습니다(`inset()` ↔ `none`은 보간되지 않고 50%에서 튐).
- **`motion.js`가 넣는 요소**는 모두 `position:absolute`이거나 의사 요소입니다. 문서 흐름에 들어가지 않습니다. 예외는 1.7.1의 스위치 버튼 하나뿐입니다(푸터, 사용자 설정).
- **기존 hover·상태 전환**(`background-color`, `color`, `box-shadow` 200ms)은 유지합니다. 사용자 입력 직후라 CLS와 무관합니다.

### 1.4 토큰

```css
:root {
  /* easing */
  --m-out:    cubic-bezier(.2, .8, .2, 1);   /* 입장. 기존 --ease-out과 같음 */
  --m-std:    cubic-bezier(.4, 0, .2, 1);    /* 상태 변화, 형태 변형. 기존 --ease-std */
  --m-in:     cubic-bezier(.4, 0, 1, 1);     /* 퇴장 */
  --m-emph:   cubic-bezier(.05, .7, .1, 1);  /* 히어로 펼침(디바이더, 리빌 시트) */
  --m-spring: cubic-bezier(.34, 1.56, .64, 1); /* 48px 이하 작은 요소만(배지, 칸, 메달 112px 예외) */
  --m-sine:   cubic-bezier(.37, 0, .63, 1);  /* 상시 왕복(앰비언트) */
  /* duration */
  --m-t-press: 120ms;   /* 누름 */
  --m-t-state: 200ms;   /* 상태 */
  --m-t-text: 240ms;    /* 긴 글 입장 상한 */
  --m-t-bubble: 280ms;  /* 말풍선 */
  --m-t-enter: 320ms;   /* 짧은 글·바·독 입장 상한 */
  --m-t-section: 360ms; /* 메뉴 섹션 리빌 */
  --m-t-badge: 420ms;   /* 배지·칸 */
  --m-t-hero: 640ms;    /* 디바이더 펼침 */
  --m-t-theme: 320ms;   /* 테마 전환. [2차] 360 → 320(V11 여유) */
  /* shape */
  --m-hex: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%);
}
```

**스태거**: 말풍선 90ms, 카드 70ms, 숫자 칸 40ms. 한 묶음은 6개까지만 엇갈립니다. 7번째부터는 6번째와 같이 들어옵니다. 한 묶음은 800ms 안에 끝나야 하고, 리빌만 1,100ms까지 허용합니다.

### 1.5 안무

1. **히어로는 한 번에 하나입니다.** 히어로는 네 가지입니다: 화면 진입(P1-3), 장 해금(P0-6), 리빌(P1-6), 테마 전환(P1-4).
   - 장 해금 중 왼쪽 패널은 디바이더가 펼쳐진 뒤(640ms)에 들어옵니다.
   - 리빌이 열려 있으면 그 뒤에서 일어나는 디바이더·끝 바 모션은 생략하거나 리빌을 닫을 때로 미룹니다.
2. **시선 순서는 "행동한 곳 → 결과 → 보조 지표"입니다.** 예를 들어 답이 오면 이 순서로 움직입니다.

   | 시각 | 요소 |
   |---|---|
   | 0ms | 답 배지 |
   | 60ms | 단서 태그. **[2차]** 320 → 60ms: 말풍선이 열리는 동안 함께 들어와, 다 열린 말풍선에 빈 줄이 보이는 프레임이 없게(FS-05) |
   | 480ms | 입력창 목표 아이콘. **[2차]** 숫자는 바뀌는 순간(0ms) 반 줄 아래에서 올라와 자리 잡습니다(불투명도는 늘 1, 숫자가 비는 프레임 0) |
   | 480ms 또는 보일 때 | 왼쪽 미터 |

3. **입장 모션은 요소마다 세션에 한 번입니다.**
   - `motion.js`가 붙이는 `m-*` 입장 클래스는 animationend 때 지웁니다(`#log` 안은 예외, P0-9).
   - 게임이 남겨 두는 `.fresh`와 `.turn` 때문에 다시 재생되면 안 됩니다(D9).
4. **조작은 막지 않습니다.**
   - 모든 모션 중에도 클릭과 입력이 됩니다. 모션 때문에 늦어지는 조작은 0입니다.
   - **[검토] 보이지 않는 것은 눌리지 않습니다.** 숨겨 둔 요소(`m-hold`, `m-pre`)에는 `pointer-events: none`을 겁니다. 사용자는 보이지 않는 힌트 버튼이나 메뉴를 실수로 누를 수 없습니다(힌트는 별점에 영향). 그 대신 `pointerdown`·`keydown`·`wheel`·`touchstart`가 오면 숨긴 요소를 바로 공개하므로, 다음 동작은 보이는 화면에서 일어납니다.
   - **[검토]** 테마 전환의 View Transition(**[2차]** 320ms) 중에 `pointerdown`이나 `keydown`이 오면 `skipTransition()`으로 즉시 끝냅니다. 입력을 삼키는 시간은 0입니다.
   - **[2차]** VT가 도는 동안 Chrome은 전환 덮개를 `<html>`로 맞힙니다. 그래서 `pointerdown`은 `<html>`에, `pointerup`은 실제 버튼에 가서 click이 둘의 공통 조상 `<html>`로 가고 삼켜졌습니다(스피커, 두 번째 테마 클릭, 「시작하기」). `<html>`에 맞은 누름이면 그 누름의 click을 포인터 아래 요소로 다시 보냅니다(`elementFromPoint`, 신뢰되지 않은 click). 음악의 오디오 잠금 해제는 원래의 신뢰된 `pointerdown`을 그대로 받습니다.
5. **기다림을 만들지 않습니다.** 내용이 준비됐는데 연출 때문에 늦게 보여 주지 않습니다. 예외는 리빌 스탯(560ms 지연)과 장 넘김 보류(최대 700ms)입니다. 둘 다 그 순간의 히어로를 먼저 보이기 위해서입니다.

### 1.6 전정 안전 (어지럼 방지)

- 패럴랙스, 스크롤 연동 이동, 3D 틸트, 화면 흔들기는 쓰지 않습니다.
- 크기 제한
  - 200px보다 큰 요소의 scale은 0.96–1.04 안에서만 씁니다.
  - 1.1보다 큰 scale은 48px 이하 요소에만 씁니다. 리빌 메달(112px)은 예외입니다.
  - 회전은 120px 이하 요소에만, 20° 이하로 씁니다. 표지 램프(96×128px, 0.5°)만 예외입니다.
- 이동 제한
  - 이동 거리는 48px 이하입니다(테마 원은 이동이 아님).
  - 화면의 25%가 넘는 면적은 이동 16px 이하, scale 0.96–1.04로만 움직입니다. 그보다 큰 변화는 opacity나 clip으로만 합니다(리빌 시트 32px은 X1).
- 깜빡임
  - 밝기가 크게 바뀌는 깜빡임은 초당 3회 미만입니다.
  - 빛 플레어는 600ms 이상 걸리는 한 번의 오르내림이고, 화면 25% 이하 면적입니다.
- 상시 루프
  - 주기 1.4s 이상, 진폭 4px 이하입니다. 김 28px 상승(투명도 0.85 이하의 장식선)과 전송 버튼의 로딩 스피너(14px, 0.8s)는 예외입니다.
  - **[검토]** 상시 루프는 표지(P0-1)와 오늘의 추천 아트(P2-5 ①)에만 둡니다. 둘 다 1.7.1 스위치로 멈출 수 있고, 무입력 30초 뒤 스스로 멈춥니다(1.8).
- **[검토] 스크롤과 겹치는 독립 모션 없음**: 페이지나 패널이 스크롤되는 동안 앰비언트 루프는 멈춥니다(1.8). 흐르는 화면 위에 따로 움직이는 것이 겹치면 전정 부담이 커지고, 폰에서는 스크롤 프레임마다 비용이 붙습니다(2.1 보충 측정).
- **[검토] 긴 스크롤**: 게임이 1.5화면을 넘게 부드럽게 스크롤하는 곳은 즉시 이동으로 바꿉니다(E2, **[2차]** E4). 몇 화면 분량의 글이 빠르게 흐르는 것은 화면 전체가 움직이는 것과 같습니다. **[2차]** E2는 `turnPage`만 다뤘고, 폰에서 장면 맨 위에서 질문을 보내면 게임의 `scrollToEntry`가 장면 글 1.8화면을 부드럽게 흘려보냈습니다. 같은 규칙을 `scrollToEntry`에도 둡니다(E4).

### 1.7 reduced motion (`prefers-reduced-motion: reduce`)

- 페이지의 전역 규칙(`*{animation:none!important; transition:none!important}`)을 그대로 둡니다. 그래서 주입 CSS의 키프레임은 모두 자동으로 꺼집니다.
- **주입 CSS의 최종 상태는 애니메이션이 없어도 맞아야 합니다.**
  - 키프레임은 `from`(시작) 쪽만 씁니다. 끝 상태는 기본 스타일입니다.
  - 처음과 끝이 모두 보이지 않는 장식(플레어, 링, 쓸기선)은 기본 `opacity:0`으로 둡니다.
- `motion.js`는 reduced에서 아래만 합니다.
  - 트랜스폼이 없는 **opacity 크로스페이드**를 WAAPI로, 160ms 이하로 씁니다. 대상은 답 말풍선, 새 힌트, 장 디바이더, 리빌 카드 네 곳뿐입니다.
  - 나머지는 즉시 바뀝니다.
- reduced에서 꺼지는 것: 화면을 가리는 보류(`m-hold`), 메뉴 리빌 숨김(`m-pre`), 표지 인사, View Transition.
- 앰비언트는 정지 프레임으로 둡니다.
  - 김: 불투명도 0.6
  - 램프: 기울지 않음
  - 타이핑 점: 0.6
- 실행 중에 설정이 바뀌면(`change` 이벤트) `html.m-reduce`를 바꾸고, 숨겨 둔 요소를 바로 다 보입니다.

#### 1.7.1 [검토] 페이지 안 스위치 「화면 움직임 줄이기」

- **이유**: 표지 앰비언트는 저절로 시작하고, 5초 넘게 이어지고, 다른 내용과 함께 보입니다. WCAG 2.2.2(일시 정지·정지·숨기기, A등급)는 이것을 멈출 수단을 페이지 안에 요구합니다. OS의 reduced motion 설정은 이 수단으로 인정되지 않고, 그 설정을 모르는 플레이어도 많습니다. 한 그릇이 40–80분이라 어지럼을 느끼는 사람에게는 게임 안 끄기가 필요합니다.
- **자리**: 메뉴 푸터 `#sec-footer .foot-reset` 안, `#reset-btn` 바로 앞. 상단 바에는 넣지 않습니다. 상단 바는 음악 스피커 버튼(`.music-btn`)과 테마 버튼으로 이미 찼고, 375px 폰 플레이 바에는 자리가 없습니다. 플레이 화면에는 상시 루프가 없으므로 메뉴에만 둡니다.
- **마크업**(`motion.js`가 한 번 넣음, 기존 `.text-btn` 스타일 그대로)
  ```html
  <button type="button" class="text-btn m-pref" aria-pressed="false">화면 움직임 줄이기</button>
  ```
  - 켜면 `aria-pressed="true"`. 글자는 그대로 두고 상태는 `aria-pressed`로만 전합니다(음악 버튼과 같은 꼴).
  - OS 설정이 이미 reduce면 `aria-pressed="true"`, `aria-disabled="true"`, `title="기기 설정에서 켜져 있어요"`로 둡니다.
- **동작**: 켜면 `html.m-reduce`를 붙이고 OS reduce와 **똑같은 경로**(1.7)를 탑니다. 숨긴 요소는 바로 공개, 루프는 정지 프레임, 남는 모션은 opacity 160ms 네 곳뿐입니다.
- **저장**: `localStorage['sea-turtle-soup:motion'] = 'reduce'`(끄면 키 삭제). 테마·음악 키와 같은 꼴이고 try/catch로 감쌉니다. 첫 렌더 전에 읽어 `m-reduce`를 붙입니다.
- **게임 CSS도 멈춤**: 페이지의 전역 reduce 규칙은 미디어 쿼리라 이 스위치로는 켜지지 않습니다. 그래서 `motion.js`가 같은 규칙을 클래스 범위로 한 번 더 넣습니다.
  ```css
  html.m-reduce *, html.m-reduce *::before, html.m-reduce *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  html.m-reduce .bowl .steam, html.m-reduce .m-wisp, html.m-reduce .typing i { opacity: .6; }
  html.m-reduce .medal::after { opacity: 0; }
  ```
  WAAPI 크로스페이드 네 곳은 CSS `animation`과 무관하므로 그대로 동작합니다.
- **게임 스크롤**: 게임의 `reduceMotion()`이 이 클래스도 보도록 공유 수정 E3를 넣습니다(4.4). 그래야 부드러운 스크롤도 멈춥니다.

### 1.8 멈춤

- **탭 숨김**: `visibilitychange`에서 `document.hidden`이면 `html.m-paused`를 붙입니다. 모든 앰비언트에 `animation-play-state:paused`가 걸립니다.
- **화면 밖**: 앰비언트를 가진 컨테이너는 IntersectionObserver로 봅니다. 대상은 `.cover`, `#featured`입니다(**[검토]** `.rv-hero` 루프는 제외되어 대상에서 뺌). 보이는 면적이 0이면 `.m-off`를 붙여 멈춥니다.
- **[검토] 스크롤 중**: `window`의 `scroll`(passive)이 오면 `html.m-scrolling`을 붙이고, `scrollend`(없으면 마지막 scroll 뒤 200ms)에 지웁니다. 붙어 있는 동안 앰비언트는 `m-paused`와 같이 멈춥니다. 붙이고 지울 때 style 재계산 한 번씩만 듭니다.
  - 근거: 메인 스레드가 프레임을 그리는 동안(스크롤 등) 표지 앰비언트는 폰 프로필에서 프레임마다 1.2 ms를 더합니다. 그중 램프 흔들림이 약 0.55 ms입니다(2.1 보충 측정).
- **[검토] 무입력 30초**: 앰비언트 컨테이너가 보이는 동안 `pointerdown`·`keydown`·`wheel`·`touchstart`·`scroll`이 30초 없으면 그 컨테이너에 `m-idle`을 붙입니다(화면 밖 표시 `m-off`와 섞이지 않게 따로 둠). 다음 입력에서 지웁니다. 화면을 켜 둔 채 자리를 비운 폰과 노트북에서 GPU가 계속 도는 것을 막고, 오래 보고 있는 화면에서 주변 움직임이 끝없이 이어지지 않게 합니다.
- 멈춤 CSS는 P0-1의 5번 규칙입니다(`m-off`, `m-paused`, `m-scrolling`, `m-idle`).
- **플레이 화면**: 상시 반복 애니메이션이 0개입니다. 예외는 질문 대기 중의 `.pending` 타이핑 점, 아바타 링, 전송 버튼 스피너입니다.
- **JS 루프**: rAF 루프는 쓰지 않습니다. 앰비언트는 CSS 합성(transform·opacity)으로만 만듭니다. canvas는 쓰지 않습니다.

### 1.9 실행 플래그 (검증용)

| 플래그 | 효과 |
|---|---|
| `window.STS_MOTION = 'off'` | `motion.js`가 아무것도 하지 않습니다. A/B 기준선으로 씁니다. |
| `window.STS_MOTION = 'force'` | 자동화 환경에서도 P1-1(메뉴 리빌 숨김)과 P1-9(표지 인사)를 켭니다. |
| 기본 | `navigator.webdriver === true`이면 P1-1과 P1-9만 끕니다. `shots.js` 전체 페이지 스크린샷에서 화면 밖 섹션이 투명하게 찍히지 않게 하려는 것입니다. 나머지 모션은 모두 켭니다. |

Playwright에서는 `context.addInitScript(() => { window.STS_MOTION = 'force' })`로 줍니다.

### 1.10 [검토] 접근성 불변 조건

`motion.js`는 어떤 경우에도 아래를 지킵니다. 하나라도 어기면 그 모듈을 끕니다.

| # | 조건 | 이유 |
|---|---|---|
| A1 | `hidden`, `inert`, `aria-*`, `role`, `tabindex`, `textContent`를 바꾸지 않습니다. 예외는 1.7.1 스위치 자신의 `aria-pressed`·`aria-disabled`·`title`입니다 | 스크린 리더가 듣는 내용과 음악 모듈(4.6)의 장면 판정이 그대로여야 합니다 |
| A2 | 포커스를 옮기지 않습니다. 게임이 옮긴 포커스를 되돌리지도 않습니다 | 키보드 순서는 게임이 정합니다 |
| A3 | 숨김은 `opacity`로만 합니다. `display`, `visibility`, `content-visibility`를 쓰지 않습니다 | 접근성 트리와 찾기(Ctrl+F)에 내용이 남아야 합니다 |
| A4 | 넣는 장식 요소는 모두 `aria-hidden="true"`이고 포커스를 받지 않습니다 | 낭독에 잡음이 끼지 않게 |
| A5 | `#log-announce`, `#composer-status`, `#play-host-note` 같은 라이브 영역은 건드리지 않습니다. 이 영역에 애니메이션을 걸 때도 글은 첫 프레임부터 접근성 트리에 있습니다 | 답 낭독 시점(게임 기준 60ms 뒤)이 모션 때문에 늦어지지 않게 |
| A6 | 숫자는 세지 않고, 글은 한 글자씩 내보내지 않습니다(6절) | 스크린 리더가 중간값이나 쪼개진 글을 읽지 않게 |
| A7 | 크기·위치를 읽는 코드(`getBoundingClientRect`, `offset*`, `client*`, `scroll*` 읽기)는 MutationObserver 콜백 안에서 쓰지 않습니다. 보이는지 여부는 IntersectionObserver가 기억해 둔 값을 읽습니다. 예외는 사용자 클릭 처리기(P1-4 버튼 위치)와 첫 렌더 한 번(P1-1)입니다 | 게임이 DOM을 바꾼 직후 강제 layout을 만들면 폰에서 그 작업이 긴 작업이 됩니다 |

---

## 2. 현재 모션 감사 (2026-10-16, `index.html` 기준. 웹판도 같음)

### 2.1 측정

`tools/perf.js`의 Chromium CDP `Performance.getMetrics` 5초 창 결과입니다. 어두움 테마, 1440×900과 390×844에서 쟀습니다.

| 상황 | 5초간 layout 횟수 | 5초간 style 재계산 | layout ms | style ms | 메인 스레드 작업 ms |
|---|---|---|---|---|---|
| 메뉴, 표지가 보일 때 | 301 | 301 | 6.2 | 29.2 | 153.8 |
| 메뉴, 표지가 화면 밖일 때 | 301 | 301 | 6.8 | 29.4 | 144.8 |
| 메뉴, 애니메이션 정지 | 0 | 0 | 0 | 0 | 38.5 |
| 플레이 대기(시계 막대 전환 켬) | 301 | 301 | 18.2 | 10.4 | 173.9 |
| 플레이 대기(시계 막대 전환 끔) | 6 | 6 | 2.1 | 1.5 | 105.4 |

- **CLS(입력 직후 제외), 한 장을 질문 5개 + 힌트 1개 + 추리로 풀었을 때**

  | 화면 | CLS | 대부분 차지한 이동 | 크기 변형 모션(E1)을 끄면 |
  |---|---|---|---|
  | 데스크톱 | 0.057 | 장 해금 재렌더 0.054 | 0.057 |
  | 폰 | 0.720 | 디바이더 삽입으로 힌트 카드가 밀림 0.663, 답마다 0.009 | 0.711 |

  - 폰에서 크기 변형을 끄면 이동 항목이 28건에서 15건으로 줄어듭니다. 줄어든 13건은 16ms 간격의 0.0006–0.0009 이동, 곧 크기 변형이 만든 프레임별 이동입니다.
  - **모션 탓이 아닌 기준선**은 데스크톱 0.057, 폰 0.711입니다. 이것은 게임 레이아웃(대화 아래 도구 카드)에서 생기며 4.8절에 따로 적습니다.
- 50ms를 넘는 긴 작업은 0건입니다.

#### 2.1.1 [검토] 보충 측정과 측정 방법 바로잡기

위 표의 `perf.js`는 5초 창 동안 `requestAnimationFrame` 루프로 프레임을 셉니다. 이 루프가 메인 스레드에 매 프레임 렌더링을 시키므로, 합성으로 돌던 애니메이션도 프레임마다 style을 다시 계산하게 됩니다. 곧 **표의 "301"은 "메인 스레드가 프레임을 그리는 동안"(스크롤, 다른 모션, 입력 중)의 비용**입니다. 가만히 있을 때의 비용이 아닙니다. P0-1 시제품 측정(`proto-cover.js`)은 rAF 루프 없이 쟀으므로 두 숫자를 바로 비교하면 안 됩니다.

같은 조건으로 다시 쟀습니다(`motion-review/observer.js`, `busy.js`, `clock.js`).

| 상황 | rAF 루프 없음(가만히) | rAF 루프 있음(프레임 생성 중) |
|---|---|---|
| 표지, 지금 CSS(SVG 김), 1440·390 | layout 0, style 0, 작업 ≈ 3 ms/5초 | layout·style ≈ 270–301회/5초 |
| 표지, 폰 프로필(4배 감속), 지금 CSS | — | **1.90 ms/프레임**(layout·style 매 프레임) |
| 표지, 폰 프로필, P0-1 시제품 | layout 0, style 0 | **1.45 ms/프레임**(layout 0, style 매 프레임) |
| 표지, 폰 프로필, 모두 정지(바닥) | — | 0.26–0.31 ms/프레임 |
| 시제품에서 하나씩 멈춘 기여(폰 프로필) | — | 표지 단서 점 ≈ 0.09, 김 3줄 ≈ 0.29, **램프 흔들림 ≈ 0.55**, 빛 숨쉬기 ≈ 0.20 ms/프레임 |
| 플레이 대기, 시계 막대 전환 켬(폰 프로필) | **layout 302, style 302, 작업 513 ms/5초** | — |
| 플레이 대기, 시계 막대 전환 끔(폰 프로필) | layout 6, style 6, 작업 41 ms/5초 | — |

정리
- **D3(시계 막대)는 실제 결함이고 가장 큽니다.** width 전환은 합성할 수 없어서 rAF 없이도 매 프레임 layout이 일어납니다. 폰 프로필에서 메인 스레드의 약 10%를 40–80분 내내 씁니다. S3·P0-8이 성능 수정 1순위입니다.
- **D4(표지 김)는 "프레임이 그려지는 동안"에만 드는 비용입니다.** P0-1은 layout을 없애고 프레임당 비용을 24% 줄이지만, style 재계산은 남습니다. 그래서 스크롤 중 정지(1.8)를 더했습니다. 메뉴에서 메인 스레드가 프레임을 그리는 주된 경우가 스크롤이기 때문입니다.
- 5절의 V3·V4·V5는 이 두 조건을 나눠 재도록 고쳤습니다.

### 2.2 목록과 판정

| # | 선택자 | 키프레임 / 속성 | 시간 · 이징 | reduced | 판정 | 근거 |
|---|---|---|---|---|---|---|
| 1 | `.cover::before` | `lampBreathe` opacity .85↔1 | 6s ease-in-out ∞ alternate | 정지(1) | **유지**: 합성 레이어. 화면 밖·숨김에서 멈추게 추가(P0-1) | `d-lamp.png` |
| 2 | `.bowl .steam` ×3 | `steam` translateY 12→-18 + opacity, SVG 자식 + `filter: blur(2px)` | 5.5s ease-in-out ∞, 지연 0/-1.8/-3.6s | opacity .6 정지 | **제거 후 재구성**(P0-1): 프레임이 그려지는 동안 매 프레임 style과 layout이 일어나고 화면 밖에서도 돕니다(2.1.1) | 2.1 표, `d-steam.png` |
| 3 | `.typing i`(표지 단서, 대기) | `typing` opacity .35↔1, translateY -3px | 1.2s ∞, 0.15s 스태거 | opacity .6 정지 | **조정**: 1.4s, -2px. 표지 쪽은 화면 밖에서 멈춤(P1-8) | `d-ask1-zoom.png` |
| 4 | `.primary/.ghost/.line-btn/.reply/.send/.answer-btn/.hint-btn/.host-opt` | 배경·글자·그림자 200ms, `:active` scale .95–.98 120ms | ease-std | 없음 | **유지** | — |
| 5 | `.row`, `.row-chev`, `.icon-btn`, `.host-chip`, `.seg`, `.tab`, `.ch-tab` | 배경 200ms, 셰브론 translateX 2px | ease-std | 없음 | **유지**(P1-5, P2-3에서 선택 안착을 더함) | — |
| 6 | `.rules-more summary .ic`, `.w-chev` | rotate 180° / 90° | 200ms ease-std | 없음 | **유지** | — |
| 7 | `.dish-featured` | hover translateY(-2px), `.ft-cta .ic` translateX 4px | 320ms ease-out | 없음 | **조정**(P1-2) | `d-hover-dish.png` |
| 8 | `.opt-check`, `.host-keys input::after` | scale .6→1 / 0→1 | 280ms / 240ms spring | 없음 | **유지** | — |
| 9 | `.clock-bar span` | `width` 1s linear 전환 | 1s linear | 없음 | **제거**(S3): 플레이 내내 초당 60회 layout. 초당 변화가 0.3px 미만이라 전환은 보이지도 않습니다 | 2.1 표 |
| 10 | `.problem.turn .ch-head/.scene-card` | `panelIn` opacity + translateY 12 + blur 4px | 500ms ease-out, 카드 지연 60ms | 없음 | **조정**(S4, P0-7): 긴 글에 이동과 블러가 걸리고, 왼쪽 부드러운 스크롤과 겹칩니다 | `d-chclear.png` 0.375–0.875s |
| 11 | `.world[open] .world-body`, `.host-body` | `fadeUp` opacity + translateY 8 | 400ms ease-out | 없음 | **조정**(S5): 긴 글이므로 opacity 200ms만 | `d-world.png` |
| 12 | `.clue-dot i` / `.clue-dot.pop i` / `.clue-dot.pop::after` | 배경 400ms / `hexPop` scale .6→1.15→1 / `glowRing` 원형 box-shadow | 400 / 600 spring / 800 ease-out | 없음 | **교체**(P0-4): 링이 육각이 아닌 원이고 box-shadow 페인트입니다. 데스크톱에서는 미터가 화면 밖일 때 재생되어 아무도 못 봅니다 | `d-answerkey.png`, `p-answerkey.png` |
| 13 | `.hint-open` | `fadeUp` 400ms | ease-out | 없음 | **제거**(S2) 후 새 힌트만 펼침(P0-5): 힌트를 열 때마다 이미 열린 힌트가 다시 페이드업(D2) | `d-hint2.png` 0.250s |
| 14 | `.confirm` | `fadeUp` 300ms | ease-out | 없음 | **조정**(P1-10): 220ms, 6px | `d-confirm.png` |
| 15 | `.pending .msg-out .bubble, .fresh .msg-out .bubble` | `sendIn` translateY 12 + scale .96 | 280ms ease-out, 기준점 오른쪽 아래 | 없음 | **조정**(S1, P0-2): AI 답이 오면 질문 말풍선이 한 번 더 나타납니다(D1) | `d-ask1-zoom.png` 1.750s, `d-answer-key-zoom.png` 0.750s |
| 16 | `.pending .msg-in` / `.pending .avatar::after` | `fadeIn` 200ms 지연 120 / `thinkRing` opacity .4↔.9 | 1.6s ∞ | 없음 | **유지** | `d-thinking.png` |
| 17 | `.fresh .stamp` / 아이콘 / `.fill` / `.entry-note` / `.entry-hit` | `badgePop` .6→1.06→1 / `draw` 30→0 / fadeIn / fadeIn / `tagIn` -8px | 480 spring / 360 지연 200 / 300 지연 300 / 200 지연 280 / 240 지연 360 | 없음 | **조정**(P0-3): 배지 420, 아이콘 320 지연 160, 메모 200 지연 240, 태그 240 지연 320 | `d-answerkey.png` |
| 18 | JS `morphFromTyping()` | WAAPI `width/height` 68×44 → 최종 | 240ms ease-std | 건너뜀 | **제거**(E1) 후 clip-path 변형(P0-3): 매 프레임 layout. 폰에서 프레임별 이동 13건(D5). 말풍선이 빈 채로 커집니다 | `d-answer-key-zoom.png` 0.875–1.0s, 2.1 CLS |
| 19 | `.entry-chapter.fresh` + `.dv-num`, `.dv-label/h3/.dv-sub`, `.dv-body/.dv-next` | `unfold` clip-path / `numRise` 40px / `fadeUp` / `fadeUp` | 700 ease-out / 900 지연 100 / 500 지연 250 / 500 지연 400 | 없음 | **조정**(S5, P0-6): `.dv-body`(긴 정답 글)에 8px 이동이 있습니다(R2 위반). 플레어 추가 | `d-chclear.png`, `p-chclear.png` |
| 20 | `.goal .roll.go b` | `rollUp` translateY 100% | 300ms ease-out | 없음 | **교체**(P0-4): AI 모드에서는 `renderComposer()`가 같은 틱에 두 번 불려 `.go`가 첫 페인트 전에 사라지므로 보이지 않습니다(D8) | `d-goal-zoom.png` 0.625→0.750s |
| 21 | `.spinner` | `spin` | 800ms linear ∞ | 없음 | **유지**(대기 중 버튼 상태) | — |
| 22 | `.reveal`, `.reveal-card`, `.medal`, `.medal::after`, `.rv-stars span` | fadeIn / `sheetIn` 48px / `medalIn` scale .3 + rotate -20° / `ringOut` / `starOn` | 320 / 640 / 900 지연 240 spring / 1400 지연 500 / 400 spring 지연 700·820·940 | 링 숨김 | **조정**(P1-6): 시트 32px·560ms, 메달 상승 추가, 다시 열 때는 짧게 | `d-reveal-in.png` |
| 23 | 스크롤 | 로그 `scrollIntoView` smooth, 장 해금 때 `#col-left.scrollTo(0)` smooth, 폰 "새 장면 보기" smooth | — | auto | 로그는 **유지**. 왼쪽 패널의 긴 스크롤은 **가림**(P0-7) | `d-chclear.png` |
| 24 | 메뉴 스크롤 | 없음(정적) | — | — | **추가**(P1-1) | `d-menu-scroll.png` |
| 25 | 메뉴 → 플레이 | 없음(하드 컷) | — | — | **추가**(P1-3) | `d-open.png` |
| 26 | 테마 전환 | 일부 컨트롤만 200–400ms 전환, 나머지 즉시 | — | 즉시 | **교체**(P1-4): 전송 버튼이 0.08–0.24s 동안 흰 바탕의 크림색이 되어 거의 사라집니다(D7) | `d-theme-zoom.png` |
| 27 | 끝 바 `.ended` | 없음(즉시) | — | — | **추가**(P1-7) | `d-ended.png` |
| 28 | 웹 `.toast`, `body.loading-play` | 없음(즉시 나타남, opacity .6 스냅) | — | — | **추가**(P2-1, P2-8) | 코드 |
| 29 | 전역 reduced 규칙 | animation·transition 모두 none, 김 .6, 점 .6, 메달 링 0 | — | — | **유지** | — |

### 2.3 결함 요약

| ID | 결함 | 고치는 곳 |
|---|---|---|
| D1 | AI 답이 오면 질문 말풍선이 다시 등장합니다 | S1 + P0-2 |
| D2 | 힌트를 열면 이미 열린 힌트가 모두 다시 페이드업합니다 | S2 + P0-5 |
| D3 | 시계 막대 width 전환 때문에 플레이 내내 초당 60회 layout이 일어납니다 | S3 |
| D4 | 표지 김이 SVG 자식 애니메이션이라 메인 스레드가 프레임을 그릴 때(스크롤 등)마다 style과 layout이 일어나고, 화면 밖에서도 멈추지 않습니다. **[검토]** 가만히 있을 때는 비용이 거의 없습니다(2.1.1) | P0-1 + 1.8 스크롤 중 정지 |
| D5 | 답 말풍선 크기 변형이 width/height 애니메이션입니다. 폰에서 프레임별 layout shift가 나고, 빈 말풍선이 커집니다 | E1 + P0-3 |
| D6 | 장 해금 때 왼쪽 긴 글이 흐려진 채 스크롤되어, 오른쪽 히어로와 겹칩니다 | S4 + P0-7 |
| D7 | 테마 전환 때 일부 요소만 따로 전환되어 얼룩집니다 | P1-4 |
| D8 | AI 모드에서 단서 목표 숫자 굴림이 보이지 않습니다 | P0-4 |
| D9 | `.problem.turn`과 `.fresh`가 남아 있어서, `#play-view`가 숨었다가 다시 보이면 CSS 입장 모션이 다시 재생될 수 있습니다 | 코드 기준. P0-7에서 `motion.js`가 끝난 뒤 `turn`을 지우고, 입장 모션을 `m-*` 클래스로 옮깁니다 |

---

## 3. 모션 목록

**항목 형식**
- 각 항목은 목적, 트리거(DOM 훅), 대상, 키프레임, 시간·이징, 지연·스태거, reduced, 비용, 방해 금지 조건을 적습니다.
- CSS는 모두 `motion.js`가 주입하는 스타일입니다. 선택자 앞에는 항상 `.m-on`(html 클래스)을 붙입니다. 아래 예시에서는 짧게 쓰려고 `.m-on`을 생략한 곳도 있지만, 구현에서는 반드시 붙입니다.

**비용 등급**

| 등급 | 뜻 |
|---|---|
| C0 | 합성만(transform·opacity, HTML 요소). 프레임당 메인 스레드 작업 0 |
| C1 | 작은 면적 페인트(≤ 120×120px 또는 ≤ 480×160px, ≤ 640ms) |
| C2 | 히어로 페인트(≤ 680×1200px clip-path, 640ms, 동시에 1개) |
| CX | 프레임마다 layout. **금지** |

### P0 — 반드시

#### P0-1 살아 있는 표지 (램프 숨쉬기 · 줄 흔들림 · 김)

| 항목 | 값 |
|---|---|
| 목적 | 첫 화면이 "불 켜진 밤의 카운터"로 살아 있게 합니다. D4를 고칩니다. |
| 트리거 | 상시. `.cover`가 보이고, 탭이 보이고, **[검토]** 스크롤 중이 아니고, 무입력 30초 전이고, 1.7.1 스위치가 꺼져 있을 때만 돕니다(1.8). |
| 대상 | `.cover::before`(빛), `.cover .lamp`(펜던트 SVG 전체), `.counter-top`에 주입하는 `.m-steam`(김 3줄), `.cover-cue .typing i` |
| 비용 | C0. **이 절의 CSS를 그대로 넣은 시제품으로 쟀습니다**(`motion-audit/tools/proto-cover.js`, `motion-audit/proto/`). 가만히 있을 때 1440·390 모두 5초간 layout 0, style 1, 작업 3.3–3.7ms. 화면 밖에서는 반복 애니메이션 8개가 모두 `paused`, 작업 0.4–0.5ms였습니다. 김의 위치는 기존 SVG 김과 같습니다(`proto/desk-row.png`, `proto/phone-row.png`). **[검토]** 앞 판의 "지금 154ms" 비교는 rAF 루프가 있는 측정과 없는 측정을 맞댄 것이라 지웠습니다(2.1.1). 같은 조건에서는 메인 스레드가 프레임을 그리는 동안 폰 프로필 1.90 → 1.45 ms/프레임(layout 매 프레임 → 0)입니다. 스크롤 중 정지로 이 비용이 실제로 드는 시간을 줄입니다. |
| 방해 금지 | 진폭이 작습니다. 램프 하단은 ±3.3px, 원뿔 끝은 ±4.6px만 움직입니다. 김은 그릇 위 52px 안에만 있습니다. 본문 글 뒤에는 없습니다(X3). 표지는 읽는 화면이 아니고, 루프는 1.7.1 스위치로 멈출 수 있습니다(WCAG 2.2.2). |

1. **빛 숨쉬기**: 기존 `lampBreathe`(6s, opacity .85↔1)를 그대로 둡니다. 멈춤 규칙만 더합니다.
2. **줄 흔들림**: SVG 요소 자체(HTML 레벨, 합성 가능)를 회전합니다. 회전 중심은 줄의 윗끝입니다. 줄은 viewBox y=-400이고 SVG 높이 128px의 비율 0.8이므로 SVG 위 320px입니다.
   ```css
   .m-on .cover .lamp { transform-origin: 50% -320px; will-change: transform;
     animation: m-sway 9s var(--m-sine) infinite alternate; }
   @keyframes m-sway { from { transform: rotate(-.5deg); } to { transform: rotate(.5deg); } }
   ```
3. **김**: 기존 SVG 경로를 숨기고, HTML 합성 레이어 3개로 다시 만듭니다. `motion.js`가 `.counter-top` 안 끝에 아래 마크업을 한 번 넣습니다.
   ```html
   <span class="m-steam" aria-hidden="true">
     <i class="m-wisp m-amb w1"><svg viewBox="0 0 14 44"><path d="M7 42c-6-8 6-13 0-21s5-12 0-19"/></svg></i>
     <i class="m-wisp m-amb w2">(같은 svg)</i>
     <i class="m-wisp m-amb w3">(같은 svg)</i>
   </span>
   ```
   ```css
   .m-on .bowl .steam { display: none; }
   .m-steam { position: absolute; left: 50%; bottom: 58px; width: 160px; height: 52px; margin-left: -80px; pointer-events: none; }
   @media (max-width: 599px) { .m-steam { bottom: 46px; width: 128px; height: 42px; margin-left: -64px; } }
   .m-wisp { position: absolute; bottom: 0; width: 14px; height: 44px; opacity: 0; will-change: transform, opacity;
     animation: m-wisp 6.6s var(--m-sine) infinite; }
   .m-wisp svg { display: block; width: 100%; height: 100%; overflow: visible; fill: none;
     stroke: var(--faint); stroke-width: 3; stroke-linecap: round; filter: blur(1.5px); } /* 정적 filter: 레이어 안에서 한 번 래스터 */
   .m-wisp.w1 { left: calc(37.5% - 7px); }
   .m-wisp.w2 { left: calc(50% - 7px); animation-duration: 7.4s; animation-delay: -2.4s; }
   .m-wisp.w3 { left: calc(62.5% - 7px); animation-duration: 6s; animation-delay: -4.2s; }
   @keyframes m-wisp {
     0%   { opacity: 0;   transform: translate3d(0, 10px, 0) scale(.9, .8); }
     30%  { opacity: .85; transform: translate3d(1.5px, -4px, 0) scale(1, 1); }
     65%  { opacity: .4;  transform: translate3d(-2px, -16px, 0) scale(1.05, 1.08); }
     100% { opacity: 0;   transform: translate3d(1px, -28px, 0) scale(1.1, 1.15); }
   }
   ```
   김 줄기의 x 위치(37.5% / 50% / 62.5%)와 바닥(그릇 바닥에서 58px, 폰 46px)은 기존 경로(viewBox 160×104의 x 60/80/100, y 46)와 같습니다. 주기를 서로 다르게 해서(6.6 / 7.4 / 6s) 세 줄이 맞춰 움직이지 않게 합니다.
4. **표지 단서 점**: `.cover-cue .typing i`에 `m-amb`를 붙입니다. 템포는 P1-8을 따릅니다.
5. **멈춤**: `.cover`에 IO를 겁니다. 보이는 면적이 0이면 `.cover.m-off`를 붙이고 아래 CSS로 멈춥니다.
   ```css
   .m-on .cover.m-off .m-amb, .m-on .cover.m-off .lamp, .m-on .cover.m-off::before,
   .m-on.m-paused .m-amb, .m-on.m-paused .cover .lamp, .m-on.m-paused .cover::before,
   .m-on.m-scrolling .m-amb, .m-on.m-scrolling .cover .lamp, .m-on.m-scrolling .cover::before,
   .m-on .cover.m-idle .m-amb, .m-on .cover.m-idle .lamp, .m-on .cover.m-idle::before { animation-play-state: paused !important; }
   ```
   **[검토]** `m-scrolling`(스크롤 중)과 `m-idle`(무입력 30초)은 1.8을 따릅니다. P2-5 ①의 `.ft-art::before`에도 같은 세 조건을 겁니다.
6. **reduced**: 전역 규칙으로 모두 정지합니다. 김은 정지 프레임으로 둡니다.
   ```css
   @media (prefers-reduced-motion: reduce) { .m-on .m-wisp { opacity: .6; } }
   ```

#### P0-2 질문 보냄 (입력창에서 들려 올라가는 말풍선)

| 항목 | 값 |
|---|---|
| 목적 | 내 질문이 입력창에서 대화로 "건너갔다"는 연속감을 줍니다. D1을 고칩니다. |
| 트리거 | `#log`에 `li.entry.pending`가 추가될 때(AI). 친구 진행은 `li.entry.fresh.by-host`. |
| 대상 | `.pending .msg-out .bubble`, `.fresh.by-host .msg-out .bubble` |
| 키프레임 | `m-lift`: opacity 0 → 1, translateY(12px) scale(.96) → none, 기준점 `100% 100%`. **[검토]** 24px → 12px(R3). 대화가 같은 순간 부드럽게 스크롤되므로 큰 이동이 겹치면 말풍선이 흔들려 보입니다. 12px로도 "입력창에서 올라옴"은 읽힙니다 |
| 시간 | 300ms `--m-out`, 지연 0. 진행자 대기 말풍선(`.pending .msg-in`)은 기존대로 200ms, 지연 120 |
| reduced | 없음(즉시) |
| 비용 | C0 |
| 방해 금지 | 이 말풍선은 **보낼 때 한 번만** 들어옵니다. 답이 와서 `.fresh`가 붙어도 다시 재생하지 않습니다(S1). |

```css
.m-on #log .pending .msg-out .bubble,
.m-on #log .fresh.by-host .msg-out .bubble { animation: m-lift 300ms var(--m-out) both; transform-origin: 100% 100%; }
.m-on #log .fresh:not(.by-host) .msg-out .bubble { animation: none; } /* S1이 들어가기 전 페이지 방어 */
@keyframes m-lift { from { opacity: 0; transform: translateY(12px) scale(.96); } }
```

#### P0-3 답 도착 (타이핑 말풍선 → 답 말풍선, 배지 안착)

| 항목 | 값 |
|---|---|
| 목적 | 기다림이 답으로 바뀌는 순간을 한 덩어리로 보여 줍니다. D5를 고칩니다. |
| 트리거 | `#log` 변경 묶음에서 `li.pending`이 제거되고 `li.entry.fresh`(장 디바이더 아님)가 생기면 그 li의 `.reply-bubble`에 `m-morph`를 붙입니다. 친구 진행(`.by-host`)은 변형하지 않고 `m-pop`만 씁니다. |
| 비용 | 말풍선 clip-path는 C1(≤ 480×160, 240ms). 나머지는 C0 |
| 방해 금지 | 말풍선은 **첫 프레임부터 최종 크기로 배치**됩니다. 글이 다시 흐르지 않고, 아래 요소가 밀리지 않습니다. 메모(긴 글이 아님)는 opacity만 씁니다. |

| 시각 | 요소 | 움직임 |
|---|---|---|
| 0 | `.reply-bubble.m-morph` | clip-path `inset(0 calc(100% - 68px) calc(100% - 44px) 0 round 20px 20px 20px 6px)` → `inset(0 0 0 0 round 20px 20px 20px 6px)`, 240ms `--m-std`. 68×44는 타이핑 말풍선 크기이고, 왼쪽 위가 같은 자리입니다 |
| 0 | `.stamp` | `m-badge` opacity 0 → 1, scale .6 → 1.06(60%) → 1, 420ms `--m-spring` |
| 160 | `.stamp .ic svg path, circle` | `m-draw` stroke-dashoffset 30 → 0, 320ms `--m-out`(`stroke-dasharray:30`) |
| 160 | `.stamp .ic svg .fill` | opacity 0 → 1, 240ms |
| 60 | `.entry-note` | `m-fade` opacity 200ms. **[2차]** 240 → 60ms |
| 60 | `.entry-hit` | `m-tag` opacity + translateX(-6px), 240ms(P0-4로 이어짐). **[2차]** 320 → 60ms |
| 120 | 친구 진행 `.fresh.by-host .reply-bubble` | `m-pop` opacity + scale .96, 기준점 `0 0`, 240ms |

```css
.m-on #log .fresh .reply-bubble.m-morph { animation: m-morph 240ms var(--m-std) backwards; } /* [검토] 끝나면 clip 없음(1.3) */
.m-on #log .fresh.by-host .reply-bubble { animation: m-pop 240ms 120ms var(--m-out) both; transform-origin: 0 0; }
.m-on #log .fresh .stamp { animation: m-badge 420ms var(--m-spring) both; }
.m-on #log .fresh .stamp .ic svg path, .m-on #log .fresh .stamp .ic svg circle { stroke-dasharray: 30; animation: m-draw 320ms 160ms var(--m-out) both; }
.m-on #log .fresh .stamp .ic svg .fill { animation: m-fade 240ms 160ms both; }
.m-on #log .fresh .entry-note { animation: m-fade 200ms 60ms var(--m-out) both; } /* [2차] 240 → 60ms */
@keyframes m-morph { from { clip-path: inset(0 calc(100% - 68px) calc(100% - 44px) 0 round 20px 20px 20px 6px); }
                     to   { clip-path: inset(0 0 0 0 round 20px 20px 20px 6px); } }
```

- E1(`morphFromTyping` 삭제)이 들어가기 전에도 안전해야 합니다. 그래서 `motion.js`는 `.reply-bubble`에 걸린 WAAPI 애니메이션 가운데 키프레임에 `width`나 `height`가 있는 것을 `cancel()`합니다. MutationObserver 콜백은 첫 페인트 전에 돌므로 잔상이 남지 않습니다.
- reduced에서는 `.reply-bubble`에 WAAPI로 opacity 0 → 1, 160ms만 겁니다.
- **[2차] 말풍선 안 줄의 시각.** 변형 clip은 240ms `--m-std`라 둘째 줄이 약 100ms에 다 드러납니다. 처음 사양(메모 240ms, 태그 320ms)으로는 다 열린 말풍선에 빈 줄이 약 250ms 남아(빈 상자) FS-05 "빈 말풍선이 커지는 프레임 0"을 어겼습니다. 메모와 태그를 60ms에 시작해, 줄이 다 드러나는 순간 그 줄 내용은 불투명도 0.3 이상입니다(V18).
- **[검토] 판정: 승인.** 답의 핵심인 배지 단어("예", "아니오")는 약 250ms에 불투명도 1이 되고, 메모는 **[2차]** 260ms에 다 보입니다. 스크린 리더는 게임의 `#log-announce`(60ms)로 먼저 듣습니다. 친구 진행에서 진행자가 답 버튼을 누르는 손과 말풍선이 겹치지 않습니다.

#### P0-4 핵심 단서 발견 (육각 칸에 램프 빛이 차오름, 링, 숫자 틱)

| 항목 | 값 |
|---|---|
| 목적 | 게임에서 가장 중요한 진전 신호입니다. 지금은 데스크톱에서 미터가 대개 화면 밖이고, 목표 숫자 굴림은 보이지 않습니다(D8). |
| 트리거 | ① 답 li 안 `.entry-hit`(`.fresh` 안). ② `#goal`의 숫자가 같은 장에서 커짐. ③ `#clue-dots`의 `.clue-dot.on` 수가 같은 장에서 커짐. 장 키는 `#p-title` 텍스트 + `#clue-title` 텍스트입니다. |
| 비용 | 모두 C0(의사 요소 transform·opacity). 칸 덮개는 육각 clip 안의 scaleY입니다. |
| 방해 금지 | 글은 움직이지 않습니다(`#clue-note`는 정지). 미터가 보이지 않으면 보일 때까지 미룹니다. 장이 바뀐 직후의 첫 렌더는 애니메이션하지 않습니다. |

**① 답 안의 태그**: 시선이 가장 먼저 가는 곳입니다.

```css
.m-on #log .fresh .entry-hit { animation: m-tag 240ms 60ms var(--m-out) both; }            /* [2차] 320 → 60ms, position 없음 */
.m-on #log .fresh .entry-hit::before { animation: m-hex-fill 480ms 120ms var(--m-spring) both; }
.m-on #log .fresh .entry-hit::after { content: ''; order: -1; flex: none; width: 12px; height: 11px; margin-right: -18px; /* [2차] 흐름 안: 육각 바로 아래 겹침 */
  clip-path: var(--m-hex); background: var(--lamp-bright); opacity: 0; pointer-events: none;
  animation: m-hex-ring 640ms 240ms var(--m-out) forwards; }                                /* [2차] both → forwards */
@keyframes m-hex-fill { 0% { opacity: 0; transform: scale(.4); } 60% { opacity: 1; transform: scale(1.25); } 100% { opacity: 1; transform: none; } }
@keyframes m-hex-ring { from { opacity: .55; transform: scale(1); } to { opacity: 0; transform: scale(2.4); } }
```

- **[2차] 링은 `forwards`로 겁니다.** 링 키프레임은 보이는 상태(opacity .55·1)에서 시작하는데 지연이 있어, `both`면 지연 동안 첫 키프레임이 그대로 보입니다(링이 순간보다 먼저 정지 상태로 보임). 기본 opacity가 0이므로 `forwards`면 지연 동안 보이지 않습니다. ①②③과 P1-5의 링 모두 같습니다(V18: 지연 −1 ms에 opacity 0).
- **[2차] `.entry-hit`에 `position: relative`를 주지 않습니다.** 그것만으로 Chrome 접근성 트리에서 무시되던 태그 `<p>`가 `paragraph` 노드가 됐습니다(읽는 글은 같음). 링은 흐름 안의 플렉스 항목(`order: -1`, 음수 여백)으로 육각 아래에 겹칩니다. 태그 크기는 그대로(80.9×18.0)입니다.

**② 입력창 목표**(`#goal`, 600px 이상에서만 보임)

- `motion.js`가 `#goal`의 childList를 관찰합니다. 같은 장에서 숫자(`.roll b`)가 이전 값보다 크면 `#goal`(바뀌지 않는 컨테이너)에 `m-up`을 1,200ms 동안 붙입니다.
- 게임의 `.roll.go`에 기대지 않습니다(D8).

```css
.m-on #goal { position: relative; }
.m-on #goal.m-up::before { animation: m-hex-pop 480ms 480ms var(--m-spring); } /* [2차] 채움(opacity 0에서 시작, both) → 숨기지 않는 맥박 */
.m-on #goal.m-up::after { content: ''; position: absolute; left: 0; top: 50%; width: 12px; height: 11px; margin-top: -5.5px;
  clip-path: var(--m-hex); background: var(--lamp-bright); opacity: 0; pointer-events: none;
  animation: m-hex-ring 640ms 600ms var(--m-out) forwards; }                 /* [2차] both → forwards */
.m-on #goal.m-up .roll b { animation: m-roll 300ms var(--m-out) both; }      /* [2차] 지연 480 → 0(구현은 커진 b에 붙인 m-r, 7.6.4-6) */
.m-on .goal .roll.go b { animation: none; } /* 기존 rollUp은 m-up이 대신합니다 */
@keyframes m-roll { from { transform: translateY(60%); } } /* [2차] 투명에서 시작하지 않음(.roll의 overflow 안에서 올라옴) */
@keyframes m-hex-pop { 60% { transform: scale(1.25); } }
```

- **[2차] 숫자와 아이콘을 숨기지 않습니다.** 처음 사양은 굴림과 육각 채움에 480ms 지연과 `both`를 줘서, 핵심 단서를 찾을 때마다 입력창 옆 목표가 약 0.5초 동안 "1장 단서 　/ 3"(숫자 없음, 육각 대신 흐린 육각)으로 보였습니다. 정보를 가리고 오류처럼 보입니다(R5). 숫자는 바뀌는 순간(0ms)부터 보이며 300ms 동안 반 줄 아래에서 올라와 자리 잡고, 아이콘은 480ms에 한 번 부풀었다 돌아옵니다(V17: 둘 다 모든 시각 opacity 1). 지연만 없애고 투명에서 시작하는 굴림을 두면 25 fps에서 숫자가 빈 프레임이 하나 남아, 굴림 키프레임에서 opacity를 뺐습니다.

**③ 왼쪽 미터**(`#clue-dots`)

1. 기존 `.pop` 애니메이션을 끕니다.
   ```css
   .m-on .clue-dot.pop i, .m-on .clue-dot.pop::after { animation: none; }
   ```
2. `motion.js`는 장 키마다 `seen`(사용자가 본 칸 수)을 기억합니다. 새 렌더에서 켜진 칸 수 `lit`이 `seen`보다 크면 아래처럼 합니다.
   - `#clue-dots`가 보이면, 곧 뷰포트와 스크롤 컨테이너(데스크톱 `#col-left`) 안에 높이의 50% 이상 들어와 있으면, `seen`부터 `lit-1`번째 칸에 `m-lit`을 붙이고 `--m-d`를 `480ms + k×90ms`로 줍니다.
   - 보이지 않으면 IO로 기다렸다가, 처음 보일 때 `--m-d: k×90ms`로 재생합니다. 더 늘어나면 합쳐서 한 번에 재생합니다.
   - 재생한 뒤 `seen = lit`입니다. 장 키가 바뀌면 `seen = lit`으로 초기화하고 재생하지 않습니다.
   - **[검토] 보이는지 판정**: `#clue-dots`에 IO(threshold 0.5) 하나를 계속 걸어 두고, MutationObserver 콜백은 IO가 기억한 값만 읽습니다(A7). 콜백 안에서 `getBoundingClientRect`를 부르지 않습니다.
   - **[검토] 기다리는 칸은 미리 덮어 둡니다.** 기다리는 동안 새 칸은 이미 켜진 채로 그려지므로, 나중에 보일 때 `m-lit`을 붙이면 "켜짐 → 꺼짐 → 다시 켜짐"으로 깜빡이고 순간 진행이 뒤로 간 것처럼 보입니다. 그래서 기다릴 칸에는 **같은 마이크로태스크에서** `m-wait`(정지 덮개)를 붙이고, 보일 때 `m-wait`를 `m-lit`으로 같은 콜백에서 바꿉니다. 게임은 답마다 `#clue-dots`를 통째로 다시 그리므로, 기다리는 동안에는 다시 그려질 때마다 `m-wait`를 다시 붙입니다.
   - 스크린 리더는 영향이 없습니다. `#clue-dots`의 `aria-label`("N장 핵심 단서 4개 중 2개 확인")은 게임이 바로 바꿉니다.
3. 칸 모션은 덮개가 위로 걷히며 국물이 차오르듯 아래부터 빛이 차고, 이어서 칸이 한 번 부풀고 육각 링이 퍼집니다.
   ```css
   .m-on .clue-dot.m-lit i::before { content: ''; position: absolute; inset: 0; background: var(--fill);
     transform-origin: 50% 0; animation: m-drain 420ms var(--m-d, 0ms) var(--m-out) both; }   /* i의 육각 clip 안: 수평선으로 차오름 */
   .m-on .clue-dot.m-lit i { animation: m-bump 320ms calc(var(--m-d, 0ms) + 300ms) var(--m-spring) both; }
   .m-on .clue-dot.m-lit::after { content: ''; position: absolute; inset: -2px; border-radius: 0; box-shadow: none;
     clip-path: var(--m-hex); background: radial-gradient(closest-side, transparent 58%, rgba(240,154,62,.65) 72%, transparent 100%);
     opacity: 0; pointer-events: none; animation: m-hex-ring-soft 640ms calc(var(--m-d, 0ms) + 300ms) var(--m-out) forwards; } /* [2차] both → forwards */
   .m-on .clue-dot.m-wait i::before { content: ''; position: absolute; inset: 0; background: var(--fill); } /* [검토] 보일 때까지 정지 덮개 */
   @keyframes m-drain { from { transform: scaleY(1); } to { transform: scaleY(0); } }
   @keyframes m-bump { 50% { transform: scale(1.1); } }
   @keyframes m-hex-ring-soft { from { opacity: 1; transform: scale(.9); } to { opacity: 0; transform: scale(1.5); } }
   ```
4. **숫자 틱**: `#clue-count` 텍스트가 같은 장에서 커지면 `m-tick`을 겁니다. **[2차]** 흐려지지 않는 한 번의 뜀: 40%에서 translateY(-3px), 320ms `--m-out`, 지연 `--m-d`, 채움 없음. 처음 사양(opacity .3에서 시작, `both`)은 지연 480ms 동안 폰의 유일한 카운터 "1 / 3"을 30%로 흐리게 두었습니다.
5. 끝나면 `m-lit`과 `m-tick`을 지웁니다(animationend).
6. **reduced**: 아무것도 붙이지 않습니다. 칸은 바로 켜져 있습니다. 덮개가 남아 칸이 꺼져 보이는 일이 없도록, reduced에서는 **절대 `m-lit`·`m-wait`를 붙이지 않습니다.** 실행 중 reduced(또는 1.7.1 스위치)로 바뀌면 남은 `m-wait`를 바로 지웁니다.
7. **[검토] 판정: 조건부 승인.** 게임에서 가장 중요한 진전 신호이고, "단서 카운터 찾기"를 돕습니다. 폰(<600px)에서는 컴포저의 `#goal`이 숨어 있어 왼쪽 미터가 유일한 카운터이므로, "마지막으로 본 뒤 새로 생긴 칸"을 보일 때 한 번 알려 주는 미룸 재생은 쓸모가 있습니다. 조건은 위의 미리 덮기와 IO 기억값 사용입니다. 칸 모션은 34×30px 안이고, 1초 안에 끝나며, 글은 움직이지 않습니다.

#### P0-5 힌트 열기 (종이가 펼쳐짐, 새 힌트만)

| 항목 | 값 |
|---|---|
| 목적 | 누른 버튼이 그대로 쪽지가 되어 아래로 펼쳐집니다. D2를 고칩니다. |
| 트리거 | `#hint-list` childList 변경. 장 키(`#p-title` + `#hint-title`)가 같고 `.hint-open` 수가 늘었으면, 가장 마지막 `.hint-open`에 `m-new`를 붙입니다. 웹판은 API 응답 뒤에 삽입되어도 같은 규칙입니다. |
| 비용 | C1(≤ 600×200, 320ms) |
| 방해 금지 | 이미 열린 힌트는 1px도, 1%도 바뀌지 않습니다(R1). 힌트 글은 opacity만 씁니다. |

| 시각 | 요소 | 움직임 |
|---|---|---|
| 0 | `.hint-open.m-new` | `m-paper` clip-path `inset(0 0 calc(100% - 48px) 0 round 20px 20px 20px 6px)` → `inset(0 round 20px 20px 20px 6px)`, 320ms `--m-out`. 48px는 버튼 높이입니다 |
| 0 | `.hint-open.m-new .hint-no .ic` | `m-key` rotate(-35deg) scale(.8) → none, 360ms `--m-spring`(열쇠가 돌아감) |
| 60 | `.hint-open.m-new p` | `m-fade` 200ms. **[2차]** 120 → 60ms: 종이가 거의 다 펼쳐졌는데 글이 없는 순간을 없앰 |

```css
.m-on .hint-open { animation: none; } /* S2가 들어가기 전 페이지 방어 */
.m-on .hint-open.m-new { animation: m-paper 320ms var(--m-out) backwards; } /* [검토] 끝나면 clip 없음(1.3) */
.m-on .hint-open.m-new .hint-no .ic { animation: m-key 360ms var(--m-spring) both; }
.m-on .hint-open.m-new p { animation: m-fade 200ms 60ms var(--m-out) both; } /* [2차] 120 → 60ms */
@keyframes m-paper { from { clip-path: inset(0 0 calc(100% - 48px) 0 round 20px 20px 20px 6px); } to { clip-path: inset(0 0 0 0 round 20px 20px 20px 6px); } }
@keyframes m-key { from { transform: rotate(-35deg) scale(.8); } }
```

reduced에서는 새 힌트에만 WAAPI로 opacity 0 → 1, 160ms를 겁니다.

**[검토] 판정: 승인.** 이미 연 힌트를 다시 움직이는 D2가 사라지고, 새 힌트 글은 **[2차]** 60ms부터 opacity만 씁니다. 펼침은 위에서 아래(읽는 방향)라 글이 드러나는 순서와 읽는 순서가 같습니다.

#### P0-6 장 해금 (밤 디바이더 펼침 + 램프 플레어 한 번)

| 항목 | 값 |
|---|---|
| 목적 | 한 그릇에서 가장 큰 보상의 순간입니다. 하나의 히어로로 정리합니다. |
| 트리거 | `#log`에 `li.entry-chapter.fresh`가 생길 때. 추리 성공, 마지막 단서, 장 넘기기 모두 같습니다. |
| 비용 | 펼침은 C2(1개, 640ms). 숫자·플레어·글은 C0 |
| 방해 금지 | 정답 글(`.dv-body`)은 opacity만 씁니다(R2). 그 순간 `#reveal`이 열려 있으면(마지막 장) `#convo`에 `m-quiet`를 1,500ms 붙여 모두 생략합니다. `#log` 밖에 붙이는 이유는 4.6절입니다. |

| 시각 | 요소 | 움직임 | 시간 · 이징 |
|---|---|---|---|
| 0 | 추리 말풍선 배지 | P0-3 그대로 | 420 spring |
| 120 | `.entry-chapter.fresh` | `m-unfold` clip-path `inset(0 0 100% 0 round 28px)` → `inset(0 round 28px)` | 640 `--m-emph` |
| 220 | `.dv-num` | `m-num` opacity 0 → 1, translateY(40px) → 0 | 720 `--m-out` |
| 300 | `.dv-top::after`(주입) | `m-flare` 램프 빛 opacity 0 → .9(35%) → 0, scale .96 → 1.04 | 1,000 `--m-out` |
| 260 | `.dv-label`, `h3`, `.dv-sub`, `.dv-go-top` | `m-fade-up` opacity + translateY(8px), 40ms 스태거 | 320 `--m-out` |
| 420 | `.dv-body` | `m-fade` opacity만 | 240 `--m-out` |
| 480 | `.dv-next` | `m-fade-up` | 320 `--m-out` |

```css
.m-on #log .entry-chapter.fresh { animation: m-unfold 640ms 120ms var(--m-emph) both; }
.m-on #log .entry-chapter.fresh .dv-num { animation: m-num 720ms 220ms var(--m-out) both; }
.m-on #log .entry-chapter .dv-top::after { content: ''; position: absolute; z-index: -1; top: -40%; right: -20%; width: 70%; height: 140%;
  background: radial-gradient(closest-side, rgba(255,180,98,.55), transparent); opacity: 0; pointer-events: none; }
.m-on #log .entry-chapter.fresh .dv-top::after { animation: m-flare 1000ms 300ms var(--m-out) both; }
.m-on #log .entry-chapter.fresh .dv-label { animation: m-fade-up 320ms 260ms var(--m-out) both; }
.m-on #log .entry-chapter.fresh h3 { animation: m-fade-up 320ms 300ms var(--m-out) both; }
.m-on #log .entry-chapter.fresh .dv-sub, .m-on #log .entry-chapter.fresh .dv-go-top { animation: m-fade-up 320ms 340ms var(--m-out) both; }
.m-on #log .entry-chapter.fresh .dv-body { animation: m-fade 240ms 420ms var(--m-out) both; }
.m-on #log .entry-chapter.fresh .dv-next { animation: m-fade-up 320ms 480ms var(--m-out) both; }
.m-on #convo.m-quiet #log .fresh, .m-on #convo.m-quiet #log .fresh *, .m-on #convo.m-quiet #log .fresh *::after { animation: none !important; }
@keyframes m-unfold { from { clip-path: inset(0 0 100% 0 round 28px); } to { clip-path: inset(0 0 0 0 round 28px); } }
@keyframes m-num { from { opacity: 0; transform: translateY(40px); } }
@keyframes m-flare { 0% { opacity: 0; transform: scale(.96); } 35% { opacity: .9; } 100% { opacity: 0; transform: scale(1.04); } }
```

- 플레어는 `.dv-top` 오른쪽 위(외곽선 숫자 쪽)에만 있습니다. `.dv-top`의 z-index -1이므로 쌓임 맥락은 `.entry-chapter`(isolate)이고, 디바이더 clip 밖으로 나가지 않습니다. 정답 글(`.dv-body`) 뒤에는 오지 않습니다.
- 이어지는 순간
  - 왼쪽 패널: P0-7이 640ms 뒤에 들어옵니다.
  - 새로 열린 장 탭: P1-5 빛 링이 760ms에 시작합니다.
  - 상태 줄 "N장이 열렸어요": P2-9가 640ms에 시작합니다.
- reduced: `.entry-chapter.fresh`에 WAAPI로 opacity 0 → 1, 160ms를 겁니다. 펼친 상태로 바로 보입니다(REVIEW §5.2-13).
- **[검토] 판정: 조건부 승인.**
  - 보상의 순간이고, 정답 글(`.dv-body`)은 420ms부터 opacity만 쓰며 660ms에 다 보입니다. 플레어는 숫자 쪽(오른쪽 위)이 가장 밝고 제목 쪽은 가장자리라, 가장 밝은 순간에도 제목 글자 대비는 큰 글자 기준(3:1)을 넘습니다. 한 번(1,000ms)만 오르내리므로 깜빡임 기준과 무관합니다.
  - **조건: 폰 성능 관문.** 폰에서 디바이더는 약 650×1,260px이고, clip-path 애니메이션은 브라우저에 따라 합성되지 않고 매 프레임 다시 칠할 수 있습니다. 검토 측정(폰 프로필, 지금 게임의 `unfold` 그대로)에서 장 해금 1.4초 동안 33ms를 넘는 프레임이 3개, 최대 133ms였습니다(대부분 게임 재렌더). V12로 `STS_MOTION='off'` 대비 증가분을 재고, 넘으면 1,024px 미만에서는 `m-unfold` 대신 `m-fade` 240ms를 씁니다(숫자 상승·플레어·글 순서는 그대로).

#### P0-7 장면 넘김 (왼쪽 패널: 스크롤은 가리고, 새 장면은 조용히)

| 항목 | 값 |
|---|---|
| 목적 | 새 장의 장면이 "새 쪽"으로 들어옵니다. 긴 글이 흐려진 채 흘러가는 모습(D6)은 보이지 않게 합니다. |
| 트리거 | ⓐ 장 해금(P0-6과 같은 `#log` 배치). ⓑ `.dv-go` 클릭(캡처 단계, 게임 처리보다 먼저). |
| 대상 | 데스크톱(≥1024): `#problem`, `#world`, `.toolbox`. 폰: ⓑ일 때 `#problem`만(ⓐ에서는 왼쪽 내용이 위에 있어 보이지 않으므로 생략). **[2차]** `#problem` 안의 장 탭(`#ch-tabs`)과 `#world`는 숨기지 않습니다. 둘 다 장이 바뀌어도 그대로인 글이라, 숨겼다 다시 페이드하면 R1을 어깁니다. 그래서 보류는 `#problem`의 장 탭 밖 자식들(`.ch-head`, `.scene-card`, `.ch-question`, `.ch-truth`)과 데스크톱 `.toolbox`에 겁니다. |
| 비용 | C0 |
| 방해 금지 | 숨김은 최대 700ms입니다(데스크톱·폰 모두). 사용자가 휠·터치·키·포인터를 쓰면 바로 엽니다. 장면 글은 opacity 240ms만 씁니다. 숨긴 동안은 눌리지 않습니다(1.5-4). |

1. **보류**: 트리거 즉시 대상에 `m-hold`(`opacity:0 !important; pointer-events:none !important`)를 붙입니다.
   - 게임의 재렌더와 같은 마이크로태스크라서, 새 장면이 한 프레임도 먼저 보이지 않습니다.
2. **끝 조건**: 다음 중 먼저 오는 것입니다.
   - 스크롤러(데스크톱 `#col-left`, 폰 `window`)의 `scrollend`
   - 타임아웃(데스크톱 520ms, 폰 **[검토]** 900 → 700ms. R5의 상한 700ms와 맞춤. 폰 긴 스크롤은 E2로 즉시 이동이 되므로 700ms면 충분합니다)
   - 사용자 입력: **[검토]** 트리거 **뒤에** `document`에 캡처·passive·once로 거는 `pointerdown`, `keydown`, `wheel`, `touchstart`. `keyup`은 보지 않습니다(Space로 누른 버튼의 keyup이 곧바로 보류를 풀지 않게).
3. **공개 시각**: ⓐ는 `max(끝 조건, 트리거 + 640ms)`입니다(히어로가 먼저). ⓑ는 끝 조건 즉시입니다.
   - **[2차] ⓑ는 실제로 스크롤할 때만 보류합니다.** 데스크톱에서 `#col-left.scrollTop < 2`이거나, 폰에서 `#problem`이 이미 스크롤 목표(`scroll-padding-top` + `scroll-margin-top`) 자리에 있으면, 흐를 글이 없으므로 숨기지 않고 P2-6 장면 바꿈으로만 처리합니다(장면이 바뀌면 160ms 크로스페이드, 같으면 아무것도 없음). 처음 사양대로면 이미 2장을 읽는 중에 "2장 장면으로"를 누를 때 같은 글이 약 0.9초 깜빡였습니다(R1·R5). 사용자 클릭 처리기 안이라 위치를 읽어도 됩니다(A7 예외).
4. **공개**: `m-hold`를 지우고 `#problem`과 데스크톱 `.toolbox`에 `m-turn-in`을 700ms 동안 붙입니다. 끝나면 `#problem`의 게임 클래스 `turn`도 지웁니다(D9). **[2차]** 공개 애니메이션에는 지연이 없습니다. 보류 640ms 뒤에 지연까지 더하면 질문·도구가 760–800ms 숨어 R5 상한(700ms)을 넘었습니다. 순서는 제목의 8px 떠오름과 카드 윗선 빛 한 줄이 맡습니다.

```css
.m-on .m-hold { opacity: 0 !important; pointer-events: none !important; }
.m-on .problem.turn .ch-head, .m-on .problem.turn .scene-card { animation: none; } /* 기존 panelIn 대신 */
.m-on #problem.m-turn-in .ch-head { animation: m-fade-up 280ms var(--m-out) both; }
.m-on #problem.m-turn-in :is(.scene-card, .ch-question, .ch-truth), .m-on .toolbox.m-turn-in { animation: m-fade 240ms var(--m-out) both; } /* [2차] 지연 없음, 장 탭·#world 없음 */
.m-on #problem.m-turn-in .scene-card { position: relative; } /* [2차] 공개하는 동안만: 쓸기선의 기준 상자(상시 relative는 접근성 트리에 빈 generic을 더함) */
.m-on #problem.m-turn-in .scene-card::before { content: ''; position: absolute; left: 24px; right: 24px; top: 0; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--lamp-bright) 30%, var(--lamp-bright) 70%, transparent);
  transform-origin: 0 50%; opacity: 0; pointer-events: none;
  animation: m-sweep 560ms 120ms var(--m-out) both; }  /* 카드 윗선을 지나는 램프 빛 한 줄 */
@keyframes m-sweep { 0% { opacity: 1; transform: scaleX(0); } 70% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0; transform: scaleX(1); } }
```

`.scene-card::before`는 카드 윗선(패딩 32px 위쪽 가장자리)에 있고, 글 뒤에는 오지 않습니다(R4). reduced에서는 보류와 공개를 하지 않고 즉시 바뀝니다. 게임이 reduced에서 `behavior:'auto'`로 스크롤하므로 흐르는 글도 없습니다.

**[검토] 판정: 조건부 승인.** 흐려진 긴 글이 흘러가는 D6을 없애는 데 필요합니다. 조건은 위의 세 가지(700ms 통일, 숨긴 동안 눌리지 않음, 입력 리스너 지정)와 E2입니다.
- 키보드로 "N장 장면으로"를 누르면 게임이 `#ch-title`로 포커스를 옮깁니다. 이때 포커스 링이 최대 700ms 동안 보이지 않을 수 있습니다. 다음 키 입력에서 바로 공개되고, 스크린 리더는 opacity와 무관하게 제목을 읽으므로 받아들입니다(A2: 포커스는 건드리지 않음).
- 데스크톱 장 해금(ⓐ)에서 `.toolbox`(단서 미터, 힌트)도 640ms 숨는데, 이 순간 미터는 새 장 기준으로 0부터 다시 그려지므로 잃는 정보가 없습니다.

#### P0-8 시계 막대

S3에서 `.clock-bar span`의 `transition: width 1s linear`를 지웁니다. 막대는 초마다 0.3px 미만으로 늘어나므로 눈에 보이는 차이는 없습니다. 플레이 대기 중 5초간 layout은 301회에서 6회로 줄어듭니다(2.1 표).

방어 규칙으로 `motion.js`도 아래를 주입합니다.

```css
.m-on .clock-bar span { transition: none; }
```

**[검토] 판정: 승인, 성능 1순위.** 폰 프로필에서 지금 막대 전환은 플레이 대기 5초에 layout 302회, 작업 513ms(약 10%)를 씁니다. rAF 관찰 효과가 아닌 실제 비용이고(2.1.1), 40–80분 내내 배터리를 씁니다.

#### P0-9 기반 (모든 항목에 공통)

- `html.m-on`이 모든 주입 CSS의 스위치입니다. `html.m-reduce`, `html.m-paused`, **[검토]** `html.m-scrolling`도 씁니다(1.7, 1.7.1, 1.8). 1.10 접근성 불변 조건을 모든 모듈에 적용합니다.
- `motion.js`가 정의하는 키프레임 이름은 모두 `m-` 접두사를 붙입니다. 공통 키프레임은 다음과 같습니다.
  ```css
  @keyframes m-fade { from { opacity: 0; } }
  @keyframes m-fade-up { from { opacity: 0; transform: translateY(8px); } }
  @keyframes m-pop { from { opacity: 0; transform: scale(.96); } }
  @keyframes m-badge { 0% { opacity: 0; transform: scale(.6); } 60% { opacity: 1; transform: scale(1.06); } 100% { opacity: 1; transform: none; } }
  @keyframes m-draw { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
  @keyframes m-tag { from { opacity: 0; transform: translateX(-6px); } }
  @keyframes m-tick { 40% { transform: translateY(-3px); } } /* [2차] 흐려지지 않는 뜀 */
  ```
- 입장 클래스 수명: `m-*` 클래스는 해당 요소의 마지막 animationend(또는 지정 시간 + 100ms)에 지웁니다. 남은 클래스가 표시 전환 때 모션을 다시 재생하면 안 됩니다. **예외는 `#log` 안입니다.** 여기서는 붙이기만 하고 지우지 않습니다. 게임이 다음 렌더에서 노드를 통째로 바꾸고, `#play-view`가 다시 보일 때는 늘 `renderPlay()`가 새 노드를 그리므로 다시 재생될 일이 없습니다. 음악 모듈의 250ms 판정도 흔들지 않습니다(4.6).

### P1 — 해야 함

#### P1-1 메뉴 섹션 리빌 (한 번, 짧게, 내용은 숨기지 않음)

| 항목 | 값 |
|---|---|
| 목적 | 메뉴를 내려갈 때 카운터 위에 하나씩 놓이는 느낌을 줍니다. 사용방법 대본은 실제 대화처럼 차례로 뜹니다. |
| 대상 묶음 | 아래 표 참고 |
| 숨김 조건 | 다섯 가지를 모두 만족할 때만 `m-pre`를 붙입니다. ① reduced 아님. ② `navigator.webdriver` 아님(또는 `STS_MOTION='force'`). ③ IntersectionObserver 있음. ④ 메뉴 **첫 렌더** 직후(`#menu-cols`에 자식이 처음 생긴 다음 rAF, 늦어도 1,500ms). ⑤ 그 요소의 `getBoundingClientRect().top > innerHeight`(처음부터 화면 밖). 화면 안이나 위에 있는 요소는 절대 숨기지 않습니다. 재렌더로 새로 생긴 요소도 숨기지 않습니다. |
| 트리거 | IO `rootMargin: 0px 0px -8% 0px`, threshold 0. 한 콜백에 함께 들어온 요소는 DOM 순서대로 스태거합니다. |
| 즉시 공개 | 다음 경우에는 모두 바로 보입니다(전환 없음): `focusin`이 숨긴 요소 안에서 일어날 때(키보드), `beforeprint`, `#menu-view`가 숨겨질 때, reduced(또는 1.7.1 스위치)로 바뀔 때. **[검토]** 더해서: 숨긴 요소가 있는 섹션 안 `pointerdown`(그 섹션 전부), 페이지 맨 아래 도달(`scrollY + innerHeight ≥ scrollHeight − 2`, 아래 8% 띠에 걸린 요소가 끝내 안 보이는 일 방지). |
| [검토] 눌림 | `m-pre`는 `pointer-events: none`입니다. 아래 8% 띠 안의 보이지 않는 메뉴·카드를 실수로 눌러 그릇이 열리는 일을 막습니다(1.5-4). |
| 비용 | C0. 공개 후 `m-pre`, `m-in`과 IO 관찰을 해제합니다. |
| 방해 금지 | 숨김은 opacity라 접근성 트리와 찾기(Ctrl+F)에 그대로 남습니다. 찾기나 앵커 이동이 스크롤하면 IO가 공개합니다. 공개는 360ms 안에 끝납니다(묶음은 800ms). 다시 올라갔다 내려와도 재생하지 않습니다. |

| 묶음 | 선택자 | 종류 | 스태거 |
|---|---|---|---|
| 사용방법 | `#sec-howto .howto-head` | `m-head` | — |
| | `#sec-howto .script > .msg-me`, **[2차]** `#sec-howto .script .say > .avatar`, `#sec-howto .script .say-stack > li` | `m-bub-me` / `m-bub-host` / `m-bub-host` | 90ms, 최대 6개. **[2차]** 진행자 아바타도 숨겼다가 첫 말풍선 한 박자 앞에 들어옵니다(빈 자리 옆에 아바타만 150–200ms 있던 것) |
| 오늘의 추천 | `#sec-today .today-say`, `#featured > *`, `#today-after` | `m-bub-host` / `m-card` / `m-head` | 90ms |
| 전체 메뉴 | `#sec-menu .sec-head`, `#menu-cols > *` | `m-head` / `m-card` | **[검토]** 70 → 40ms, 320ms. 그릇을 고르려고 훑어보는 목록이라 묶음이 520ms 안에 끝나게 합니다 |
| 진행자 | `#sec-host .sec-head`, `#menu-host .host-opt`, `#sec-host .host-say`, `#sec-host .host-end` | `m-head` / `m-card` / `m-bub-host` / `m-head` | 70ms |

```css
.m-on .m-pre { opacity: 0; pointer-events: none; } /* [검토] 보이지 않는 것은 눌리지 않음 */
.m-on .m-pre.m-head { transform: translateY(12px); }
.m-on .m-pre.m-card { transform: translateY(12px); } /* [검토] 16 → 12px(R3) */
.m-on #menu-cols > .m-in { transition-duration: 320ms !important; }
.m-on .m-bub-host { transform-origin: 0 100%; } .m-on .m-bub-me { transform-origin: 100% 100%; }
.m-on .m-pre.m-bub-host, .m-on .m-pre.m-bub-me { transform: translateY(10px) scale(.98); }
.m-on .m-in { transition: opacity 360ms var(--m-out) var(--m-delay, 0ms), transform 360ms var(--m-out) var(--m-delay, 0ms) !important; }
.m-on .m-in.m-bub-host, .m-on .m-in.m-bub-me { transition-duration: 280ms !important; }
.m-on #menu-view :is(.m-pre, .m-in):focus-within { opacity: 1 !important; transform: none !important; transition: none !important; } /* [2차] 포커스는 첫 프레임부터 보임 */
```

**[2차] 키보드 포커스.** Tab으로 화면 밖 요소에 닿으면 브라우저가 스크롤해 IO가 공개를 시작하는데, 공개는 스태거 지연(최대 5단계)과 320–360ms 전환이라 포커스가 투명한 카드·행에 머물렀습니다(Tab 30 ms 간격에서 연속 9–11곳이 opacity 0). 제외한 P2-2와 같은 이유(포커스는 첫 프레임부터 온전히 보여야 함)로, 포커스를 품은 리빌 요소는 전환 없이 바로 보입니다. 마우스 동작은 그대로입니다(`m-pre`는 계속 `pointer-events: none`).

**공개 순서**
1. `--m-delay`를 설정합니다.
2. `m-in`을 붙입니다.
3. 다음 rAF에 `m-pre`를 지웁니다.
4. opacity의 `transitionend`(또는 1,000ms)가 되면 `m-in`, `m-bub-*`, `m-head`, `m-card`, `--m-delay`를 지웁니다. 그러면 요소 자신의 transition(예: `.dish-featured` hover)이 돌아옵니다.

**[검토] 판정: 조건부 승인.** 세션에 한 번, 화면 밖 요소만, 내용은 접근성 트리와 찾기에 그대로 남습니다(A3). 사용방법 대본은 실제 대화처럼 뜨는 것이 내용(진행자와의 대화)과 맞습니다. 조건은 눌림 차단, 섹션 안 `pointerdown`과 페이지 끝 공개, 메뉴 목록 스태거 단축, 카드 이동 12px입니다. 스크린 확대기 사용자는 브라우저 뷰포트가 그대로라 IO가 보통처럼 공개합니다.

#### P1-2 오늘의 추천 카드 깊이 (hover · press)

| 항목 | 값 |
|---|---|
| 목적 | 진행자가 건네는 그릇이 손에 잡히는 느낌을 줍니다. |
| 트리거 | `@media (hover: hover) and (pointer: fine)`의 `:hover`·`:focus-visible`, 모든 기기의 `:active` |
| 비용 | C0. 그림자 층은 opacity만 바뀌고, 아트 레이어는 transform입니다. |
| 방해 금지 | 카드 글은 카드와 함께 3px만 움직입니다(사용자 입력 중). 기울기와 커서 추적은 쓰지 않습니다. |

```css
.m-on #featured { position: relative; isolation: isolate; }
.m-on #featured::before { content: ''; position: absolute; left: 24px; right: 24px; top: 24px; bottom: 0; z-index: -1; border-radius: 28px;
  box-shadow: 0 40px 80px -28px rgba(0,0,0,.55); opacity: 0; transition: opacity 320ms var(--m-out); pointer-events: none; }
.m-on .dish-featured .ft-art svg { transition: transform 480ms var(--m-out); }
.m-on .dish-featured .ft-art::before { transition: transform 480ms var(--m-out); } /* 쉴 때 모습은 승인 시안 그대로 */
@media (hover: hover) and (pointer: fine) {
  .m-on .dish-featured:hover, .m-on .dish-featured:focus-visible { transform: translateY(-3px); }
  .m-on #featured:has(.dish-featured:hover, .dish-featured:focus-visible)::before { opacity: 1; }
  .m-on .dish-featured:hover .ft-art svg, .m-on .dish-featured:focus-visible .ft-art svg { transform: translateY(-4px); } /* 카드 안 깊이: 아트가 4px 더 떠오름 */
  .m-on .dish-featured:hover .ft-art::before, .m-on .dish-featured:focus-visible .ft-art::before { transform: scale(1.04); }
}
.m-on .dish-featured:active { transform: translateY(-1px) scale(.985); transition-duration: 120ms; }
```

reduced에서는 전역 규칙으로 전환이 없습니다. 상태는 즉시 바뀝니다(그림자 층과 아트 위치만).

**[검토] 판정: 승인.** 사용자 입력에 대한 반응이고, 기울기·커서 추적이 없으며, 큰 카드의 scale(.985)은 1.6절 범위 안입니다.

#### P1-3 메뉴 ⇄ 플레이 진입 ("카운터에 앉기")

| 항목 | 값 |
|---|---|
| 목적 | 하드 컷(`d-open.png`)을 "자리에 앉으면 위에서 바가 내려오고, 손앞에 카운터(입력 독)가 밀려오는" 진입으로 바꿉니다. |
| 방식 | **진입 전용(enter-only) 애니메이션.** View Transitions API는 쓰지 않습니다. 이유: VT는 DOM 변경을 비동기 콜백으로 미뤄야 합니다. 그런데 두 화면의 `openPuzzle()`은 `showView()` 바로 뒤 같은 틱에서 `window.scrollTo`, `#convo.scrollTop = scrollHeight`, 포커스를 맞춥니다. 변경을 미루면 숨겨진 `#play-view`에서 scrollTop 설정이 무시되어 대화가 맨 아래로 가지 않습니다. 웹판은 API 응답 뒤에 화면을 바꾸므로 클릭 시점에 VT를 시작할 수도 없습니다. 게임 로직을 바꾸지 않고는 VT를 걸 수 없으므로 진입 애니메이션으로 대신합니다. 같은 이유로 대체 경로(폴백)가 따로 필요 없습니다. |
| 트리거 | `#play-view`, `#menu-view`의 `hidden` 속성 MutationObserver. 숨김이 풀린 쪽에 `m-enter`를 450ms 동안 붙입니다. |
| 비용 | C0 |
| 방해 금지 | 장면이 있는 그리드는 opacity 240ms만 씁니다(R2). 스크롤과 포커스는 게임이 정한 그대로입니다. |

| 시각 | 요소 | 움직임 |
|---|---|---|
| 0 | `#play-view.m-enter .topbar` | `m-drop` opacity + translateY(-8px), 280ms `--m-out` |
| 0 | `#play-view.m-enter .play-grid` | `m-fade` 240ms. **[2차]** 그 그릇에 처음 들어올 때만. 메뉴에 갔다가 같은 그릇으로 돌아오면(`#p-title` 같음) `#play-view`에 `m-same`을 붙여 그리드는 페이드하지 않습니다. 읽던 장면 글을 다시 투명에서 시작하지 않게(R1) |
| 60 | `#play-view.m-enter #composer`, `#play-view.m-enter #ended-bar` | `m-rise` opacity + translateY(12px), 320ms `--m-out`. **[검토]** 24 → 12px(R3: 탭 글자와 입력창을 담은 독) |
| 0 | `#menu-view.m-enter .topnav` | `m-drop` 280ms |
| 0 | `#menu-view.m-enter > :not(.topnav)` | `m-fade` 240ms |

```css
@keyframes m-drop { from { opacity: 0; transform: translateY(-8px); } }
@keyframes m-rise { from { opacity: 0; transform: translateY(12px); } }
```

reduced에서는 없습니다(즉시).

**[검토] 판정: 조건부 승인(이동 12px).** 하드 컷보다 "어디로 왔는지"가 잘 읽히고, 450ms 안에 끝나며, 스크롤과 포커스는 게임 그대로입니다. 장면 글은 opacity 240ms만 씁니다.

#### P1-4 테마 전환 ("램프 빛이 번짐", **[2차]** 320ms)

| 항목 | 값 |
|---|---|
| 목적 | 오후의 카운터 ⇄ 자정의 카운터가 한 번에 고르게 바뀌게 합니다(D7). 누른 스위치에서 빛이 번져 나갑니다. |
| 트리거 | `document`의 캡처 단계 `click`에서 `e.target.closest('.theme-btn')`. **`.theme-btn`만 봅니다.** `music.js`의 스피커 토글은 건드리지 않습니다. |
| 방식(VT 있음, reduced 아님) | 1. 원래 click을 **[검토]** `stopPropagation()`만 합니다(`stopImmediatePropagation()`과 `preventDefault()`는 쓰지 않음). `document` 캡처 단계의 다른 리스너, 특히 `music.js`의 오디오 잠금 해제 리스너는 넣는 순서와 상관없이 이 click을 그대로 받습니다. 테마 버튼에는 기본 동작이 없어 `preventDefault()`가 필요 없습니다. 2. 버튼 중심 `--m-tx`, `--m-ty`와 반지름 `--m-tr`(가장 먼 모서리까지의 거리)을 html에 둡니다. 3. html에 `m-swap`, `m-theme-vt`를 붙입니다. 4. `document.startViewTransition(() => { replaying = true; btn.click(); replaying = false; })`로 게임 처리기를 그대로 실행합니다. 5. `finished`에서 두 클래스를 지웁니다. 재생 중 `replaying`이면 캡처 처리기는 아무것도 하지 않습니다. |
| 방식(VT 없음 또는 reduced) | html에 `m-swap`만 붙이고 클릭을 그대로 흘려보냅니다. 2 rAF 뒤에 지웁니다. 모든 요소가 같은 프레임에 즉시 바뀝니다. |
| 비용 | 320ms 동안 루트 스냅샷 clip-path(C2 상당). **[검토]** VT 중 `pointerdown`·`keydown`이 오면 `transition.skipTransition()`으로 바로 끝내므로 입력이 막히지 않습니다. **[2차]** 그 누름이 `<html>`(VT 덮개)에 맞았으면 이어지는 click을 포인터 아래 요소로 다시 보냅니다(1.5-4). 뒤따른 전환이 이미 시작됐으면 앞 전환의 `finished`는 클래스를 지우지 않습니다. |
| 방해 금지 | 400ms 이하. 글 위치는 그대로입니다. 키보드(Enter·Space)도 click 이벤트라 같은 경로를 탑니다. 포커스는 버튼에 그대로 있습니다. |
| [검토] 폰 관문 | 폰 프로필 측정에서 VT 원은 총 424–445ms, 프레임 p95 33–50ms, 최대 50–67ms였습니다(즉시 바꿈은 한 프레임 56ms). 400ms 목표를 넘고 원이 끊겨 보입니다. 구현 뒤 V11-p를 통과하지 못하면 `(pointer: coarse)`에서는 VT 없이 `m-swap` 즉시 바꿈만 씁니다. |

```css
.m-swap *, .m-swap *::before, .m-swap *::after { transition: none !important; }  /* 일부만 따로 전환되는 얼룩 제거 */
html.m-theme-vt::view-transition-old(root), html.m-theme-vt::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
html.m-theme-vt::view-transition-new(root) { animation: m-lamp-in 320ms var(--m-std) both; } /* [2차] 360 → 320ms */
@keyframes m-lamp-in { from { clip-path: circle(0 at var(--m-tx) var(--m-ty)); } to { clip-path: circle(var(--m-tr) at var(--m-tx) var(--m-ty)); } }
```

- 다른 요소에는 `view-transition-name`을 주지 않습니다(의도하지 않은 형태 변형 방지).
- 게임의 `MutationObserver(syncThemeButtons)`와 `localStorage` 저장은 원래 처리기 안에서 그대로 일어납니다.
- **[검토] 판정: 조건부 승인.** 밝기가 크게 바뀌는 변화는 원래 한 번 있는 것이고, 원으로 번져도 한 번의 전환이라 깜빡임(초당 3회) 기준과 무관합니다. 사용자가 누른 직후의 드문 동작이고 읽는 중이 아닙니다. 조건은 `stopPropagation()`, 입력 시 `skipTransition()`, 폰 관문입니다. 스피커 버튼(`.music-btn`)은 이 경로를 타지 않습니다.

#### P1-5 장 탭 (선택 안착 · 새 장 열림 빛 링)

| 항목 | 값 |
|---|---|
| 목적 | 어느 장을 보고 있는지, 방금 어느 장이 열렸는지 알려 줍니다. |
| 트리거 | `#ch-tabs` childList. `motion.js`가 그릇(`#p-title`)마다 탭별 `disabled`와 `aria-pressed` 상태를 기억합니다. |
| 대상 | ① 눌림이 바뀐 새 탭: `m-press`. ② `disabled`에서 풀린 탭: `m-unlock`. 장 해금 히어로가 있으면 760ms 지연, 없으면 0. |
| 비용 | C0(탭 36–40px) |
| 방해 금지 | 탭 글은 짧은 UI라서 scale .94 → 1(200ms)만 허용합니다. 같은 그릇을 다시 열 때의 첫 렌더는 기준값만 기록하고 재생하지 않습니다. |

```css
.m-on .ch-tab { position: relative; }
.m-on .ch-tab.m-press { animation: m-settle 200ms var(--m-std) both; }
.m-on .ch-tab.m-unlock::after { content: ''; position: absolute; inset: -3px; border-radius: inherit; box-shadow: 0 0 0 2px var(--lamp-bright);
  opacity: 0; pointer-events: none; animation: m-ring 720ms var(--m-d, 0ms) var(--m-out) forwards; } /* [2차] both → forwards: 760ms 지연 동안 정지 링이 먼저 보이지 않게 */
@keyframes m-settle { from { transform: scale(.94); } }
@keyframes m-ring { from { opacity: 1; transform: scale(.96); } to { opacity: 0; transform: scale(1.1); } }
```

**[검토] 판정: 승인.** "지금 어느 장을 보는지, 방금 어느 장이 열렸는지"를 알려 주는 정보 모션입니다. 탭 글자는 scale .94에서 200ms 안에 안착하고(R3 예외: 기호형 요소), 링은 한 번입니다.

#### P1-6 리빌 (시트 · 메달 상승 · 별 · 스탯 · 램프 플레어)

| 항목 | 값 |
|---|---|
| 목적 | 한 그릇을 비운 마지막 인사입니다. 처음 열 때만 의식을 하고, "정답 다시 보기"에서는 짧게 엽니다. |
| 트리거 | `#reveal`의 `hidden` 해제. 캡처 단계에서 `#reopen-btn` 클릭을 보면, 다음 한 번의 열림에 `#reveal.m-again`을 붙입니다. |
| 비용 | 시트·메달·별·스탯은 C0. 스크림 `backdrop-filter`는 정적이고 opacity만 바뀝니다. |
| 방해 금지 | 진상 본문은 시트와 함께만 움직입니다(X1). 본문 글 자체는 애니메이션하지 않습니다. 스탯과 계산 각주는 1,040ms 안에 다 보입니다. 별은 지금과 같은 시간(마지막 별 1,340ms)이라 `shots.js` 리빌 스크린샷 시점과의 관계는 지금과 같습니다. |

| 시각 | 요소 | 움직임 | 시간 · 이징 |
|---|---|---|---|
| 0 | `.reveal` | 기존 fadeIn 유지 | 320 |
| 0 | `.reveal-card` | `m-sheet` opacity + translateY(32px) | 560 `--m-emph` |
| 240 | `.medal` | `m-medal` opacity 0, translateY(16px) scale(.3) rotate(-20deg) → none(상승) | 900 `--m-spring` |
| 300 | `.rv-hero::after`(주입) | `m-flare-top` 히어로 위 가운데 램프 빛 0 → 1 → 0 | 1,200 `--m-out` |
| 500 | `.medal::after` | 기존 `ringOut` 유지 | 1,400 |
| 700 / 820 / 940 | `.rv-stars span` | 기존 `starOn` 유지 | 400 spring |
| 560 + 40k | `.rv-stat`(5칸) | `m-fade-up` | 240 `--m-out` |
| 800 | `.rv-foot` | `m-fade` | 240 |

```css
.m-on .reveal:not([hidden]) .reveal-card { animation: m-sheet 560ms var(--m-emph) both; }
.m-on .reveal:not([hidden]) .medal { animation: m-medal 900ms 240ms var(--m-spring) both; }
.m-on .rv-hero::after { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0;
  background: radial-gradient(45% 55% at 50% 0%, rgba(255,180,98,.38), transparent 70%); }
.m-on .reveal:not([hidden]) .rv-hero::after { animation: m-flare-top 1200ms 300ms var(--m-out) both; }
.m-on .reveal:not([hidden]) .rv-stat { animation: m-fade-up 240ms var(--m-out) both; }
.m-on .reveal:not([hidden]) .rv-stat:nth-child(1) { animation-delay: 560ms; }  /* 2: 600, 3: 640, 4: 680, 5: 720 */
.m-on .reveal:not([hidden]) .rv-foot { animation: m-fade 240ms 800ms both; }
.m-on .reveal.m-again .medal, .m-on .reveal.m-again .medal::after, .m-on .reveal.m-again .rv-hero::after,
.m-on .reveal.m-again .rv-stars span, .m-on .reveal.m-again .rv-stat, .m-on .reveal.m-again .rv-foot { animation: none !important; }
.m-on .reveal.m-again .reveal-card { animation-duration: 320ms; }
@keyframes m-sheet { from { opacity: 0; transform: translateY(32px); } }
@keyframes m-medal { from { opacity: 0; transform: translateY(16px) scale(.3) rotate(-20deg); } }
@keyframes m-flare-top { 0% { opacity: 0; } 35% { opacity: 1; } 100% { opacity: 0; } }
```

- 숫자 세기(count-up)는 쓰지 않습니다. 숫자가 읽기 전에 바뀌고, 스크린 리더가 중간값을 읽기 때문입니다.
- reduced: `.reveal-card`에 WAAPI로 opacity 0 → 1, 160ms를 겁니다. 나머지는 즉시입니다.
- **[검토] 판정: 승인.** 한 그릇의 마지막 의식이고, 진상 본문은 시트와 함께만 움직이며(X1), 스탯은 720ms에 다 들어옵니다. 메달의 scale .3·회전은 R3 기호형 예외(112px, 2자)입니다. 포커스는 게임이 `#rv-title`로 옮기고, 시트 이동(32px) 동안 링도 함께 움직일 뿐 가려지지 않습니다. 다시 열 때 짧게 여는 `m-again`은 같은 의식을 반복하지 않게 해서 좋습니다. 리빌이 열린 뒤의 반복 루프(P2-5 ③)는 제외했습니다.

#### P1-7 끝 바

| 항목 | 값 |
|---|---|
| 트리거 | `#ended-bar`의 `hidden` 해제. 그때 `#reveal`이 열려 있으면 `m-hold`(opacity 0)를 붙이고, `#reveal`이 닫힐 때 공개합니다. |
| 움직임 | `#ended-bar.m-in`은 opacity + translateY(12px), 280ms `--m-out`(**[검토]** 16 → 12px, R3). 안의 메달 미니(`#ended-bar.m-in p::before`)는 `m-badge` 420ms, 지연 120ms, `--m-spring`. |
| reduced | 없음 |
| 비용 | C0 |
| [검토] 판정 | 조건부 승인(12px). 리빌을 닫은 뒤에만 올라오므로 두 히어로가 겹치지 않습니다. 끝 바가 `m-hold`로 숨은 동안은 눌리지 않고(1.5-4), 리빌의 바깥 화면은 그동안 `inert`라 원래 눌리지 않습니다. |

```css
.m-on #ended-bar.m-in { animation: m-rise-sm 280ms var(--m-out) both; }
.m-on #ended-bar.m-in p::before { animation: m-badge 420ms 120ms var(--m-spring) both; }
@keyframes m-rise-sm { from { opacity: 0; transform: translateY(12px); } }
```

#### P1-8 진행자 생각 중

- 대상은 `.typing i`입니다(대기 말풍선과 표지 단서 모두).
- 키프레임 `m-typing`: 0·60·100%에서 opacity .35, transform none. 30%에서 opacity 1, translateY(-2px).
- 1.4s `--m-sine` 반복, 스태거 0.18s입니다.
- `li.pending`이 10초를 넘기면 `m-long`을 붙여 2.4s로 늦춥니다("아직 생각 중"의 느긋함).
- 아바타 링(`thinkRing` 1.6s)과 전송 스피너는 그대로 둡니다.
- 비용 C0. reduced에서는 정지(.6)입니다.
- **[검토] 판정: 승인.** 기다림을 알리는 상태 표시이고 답이 오면 멈추므로, 플레이 화면에서 허용하는 유일한 반복입니다(WCAG 2.2.2의 "기다림 표시"에 해당). 글 "진행자가 생각 중"이 함께 있어 점만으로 상태를 전하지 않습니다. 10초 뒤 느려지는 `m-long`은 재촉하는 느낌을 줄입니다.

#### P1-9 표지 첫 인사 (세션당 한 번)

| 항목 | 값 |
|---|---|
| 조건 | 다음을 모두 만족할 때만 합니다. 세션 첫 방문(`sessionStorage['sts:intro']` 없음). reduced 아님. `webdriver` 아님(또는 force). `scrollY < 10`. `#menu-view` 보임. **아직 첫 콘텐츠 페인트 전**(`performance.getEntriesByName('first-contentful-paint').length === 0`). 이미 그려졌다면 하지 않습니다. 보였던 것을 다시 숨기는 깜빡임을 막기 위해서입니다. |
| 방해 금지 | 600ms 안에 끝납니다. 버튼은 처음부터 눌립니다. |

| 시각 | 요소 | 움직임 |
|---|---|---|
| 0 | `.cover::after`(주입, z-index -1: 빛 위·글 아래) | `--ground` 덮개 opacity .9 → 0, 900ms `--m-out`("불이 데워짐") |
| 0 / 40 / 80 | `.cover-eyebrow`, `.cover-title`, `.cover-promise` | `m-fade-up` 400ms |
| 160 | `.cover-chat .say` | `m-bub` opacity + translateY(10px) scale(.98), 기준점 `0 100%`, 280ms |
| 260 / 320 | `#cover-replies .reply` | `m-bub`, 기준점 `100% 100%`, 280ms |
| 380 | `.reply-note` | `m-fade` 240ms |

html에 `m-intro`를 1,000ms 동안 붙였다가 지웁니다.

**[검토] 판정: 조건부 승인.** 세션 첫 화면 1초 안의 인사이고, 첫 페인트 전일 때만 하므로 "보였다가 숨는" 깜빡임이 없습니다. 조건 두 가지를 더합니다.
- `sessionStorage`를 읽거나 쓰다 예외가 나면(아티팩트 iframe, 사생활 보호 창) 메모리 플래그로 대신해 **페이지당 한 번**만 합니다.
- 주소에 해시(`#sec-menu` 등)가 있으면 하지 않습니다. 다른 섹션으로 바로 가려는 방문입니다.
- **[2차] 세션 첫 방문은 Navigation API로 먼저 봅니다.** `navigation.currentEntry.index > 0`(이 탭의 같은 출처 기록에 앞 항목이 있음)이면 이미 본 세션입니다. `sessionStorage`는 이 페이지에서 모션만 쓰는데, 첫 읽기가 저장 영역을 불러오는 동기 IPC라 init의 대부분(데스크톱 1.6–12 ms)을 차지했습니다. Navigation API가 없는 브라우저에서만 `sessionStorage`를 읽습니다. 데스크톱 init 중앙값 약 5 → 2.4 ms.

#### P1-10 확인창 · 세계관 문서 · 진행자 노트

- `.confirm`(넘기기·포기): 220ms `--m-out`, 이동 6px.
- `.world[open] .world-body`, `.host-body`: `m-fade` 200ms(긴 글: opacity만). S5와 같은 값입니다.
- reduced: 없음.

```css
.m-on .confirm { animation: m-fade-up-sm 220ms var(--m-out) both; }
.m-on .world[open] .world-body, .m-on .host-body { animation: m-fade 200ms var(--m-out) both; }
@keyframes m-fade-up-sm { from { opacity: 0; transform: translateY(6px); } }
```

**[검토] 판정: 승인.** 긴 글(세계관, 진행자 노트)은 opacity만, 확인창은 6px입니다. 확인창은 게임이 "계속 풀기"로 포커스를 옮기는데, 220ms 페이드 동안에도 버튼은 눌립니다. 포커스 링은 상자와 함께 220ms에 걸쳐 나타나는데, 확인창 자체가 방금 연 것이고 짧아서 받아들입니다(포커스 링만 따로 늦추는 P2-2는 제외).

### P2 — 있으면 좋음

| ID | 이름 | 트리거 · 대상 | 움직임 | 시간 | reduced · 비용 | [검토] 판정 |
|---|---|---|---|---|---|---|
| P2-1 | 토스트(웹) | `#toast` `hidden` 토글 | `transition: opacity 240ms, transform 240ms, display 240ms allow-discrete`. 닫힘 상태와 `@starting-style`은 `opacity:0; transform: translate(-50%, 12px)`. 원래 `translateX(-50%)`를 유지합니다 | 들어옴·나감 240 | 즉시 · C0 | **승인**. 오류 안내라 들어올 때 글은 첫 프레임부터 접근성 트리에 있고(A5), 240ms 안에 다 보입니다 |
| P2-2 | ~~포커스 링 안착~~ | ~~`:is(button, a, summary):focus-visible`~~ | ~~`outline-offset` 5 → 2px, `outline-color` transparent → 링 색~~ | ~~160~~ | — | **제외**. 키보드 사용자에게 포커스 링은 첫 프레임부터 온전히 보여야 합니다. Tab을 빠르게 누를 때 링이 매번 투명에서 시작하면 포커스 위치를 놓칩니다(WCAG 2.4.7·2.4.13 취지). 색을 빼고 offset만 움직이는 안은 거의 보이지 않아 얻는 것이 없습니다 |
| P2-3 | 질문/추리 탭·진행자 세그먼트 | `#tab-ask`, `#tab-guess`, `.seg`의 `aria-pressed`가 `true`로 바뀜 | `m-settle` scale .94 → 1 | 200 `--m-std` | 없음 · C0 | **승인**. 누른 컨트롤의 안착이고, 무엇을 보낼지(질문/추리) 확인해 줍니다 |
| P2-4 | 리빌 마지막 인사 | `#rv-scroll` 안 IO. `.rv-bye`가 **시트를 열 때 화면 밖이었다면**, 처음 보일 때 | 타이핑 점 말풍선 **[검토]** 600 → 480ms → 인사 말풍선 `m-bub` 280ms. **[2차]** 기다리는 동안 숨기는 규칙은 `.rv-bye.m-wait > .bubble:not(.m-dots)`입니다(점 말풍선도 `.bubble`이라 처음에는 점까지 숨어 480ms 동안 아바타만 보였음). 점은 인사 말풍선이 떠오르기 시작한 뒤 120ms 동안 opacity로 걷히고 사라집니다(둘 다 보이지 않는 프레임 0). `position: relative`도 기다리고 들어오는 동안만 겁니다 | 480 + 280 | 없음 · C0 | **조건부 승인 / 일부 제외**. 진행자가 마지막 말을 건네는 짧은 연출이라 남깁니다(한 줄 인사, 정보 없음). 열 때 이미 보이면 하지 않습니다. **제외: `.rv-section` 처음 보일 때 페이드**. 리빌은 장별 진상을 몰아 읽는 곳인데, 스크롤로 들어오는 긴 글(LONG)을 투명에서 시작하면 화면 아래쪽 글이 늦게 나타나 R5(숨김 0)를 어깁니다 |
| P2-5 | 가장자리 앰비언트 | ① `.ft-art::before` 빛 숨쉬기 opacity .75 ↔ 1, 7s `--m-sine` 반복. ~~② 표지 램프 원뿔 안 먼지 5개~~ ~~③ 리빌 메달 `.medal::before` 후광 반복~~ | — | — | 정지 · C0 | ① **조건부 승인**: 화면 밖·탭 숨김·스크롤 중·무입력 30초에 멈추고(1.8), 1.7.1 스위치로 멈춥니다. 카드 글 뒤가 아닌 아트 뒤 번짐입니다. ② **제외**: 표지에는 이미 루프 4개(빛, 흔들림, 김, 단서 점)가 있습니다. 따로 떠다니는 점은 주변 시야를 가장 강하게 끄는 움직임인데, 하필 눈썹 글자와 제목 바로 위에 놓이고, 뜻을 더하지 않으며, 폰에서 레이어 5개를 더합니다. ③ **제외**: 리빌은 스탯과 진상을 읽는 대화상자입니다. 스탯 바로 위에서 5초마다 맥박 치는 후광은 읽는 동안 끝없이 시선을 끕니다. 입장 의식(P1-6)만으로 충분합니다 |
| P2-6 | 장 탭 클릭 크로스페이드 | `#ch-scene` childList가 장 해금 없이 바뀜(탭 클릭) | `.ch-head`, `.scene-card`, `.ch-truth`에 `m-fade` | 160 | 없음 · C0 | **승인**. 다른 장을 다시 읽으러 간 순간, 글이 바뀌었다는 것만 opacity 160ms로 알립니다(R2) |
| P2-7 | ~~전송 화살표 튕김~~ | ~~`#composer` `submit`(캡처)~~ | ~~`.send .ic svg` translateY(-6px) → 0~~ | — | — | **제외**. 보이지 않습니다. AI 진행에서는 게임의 submit 처리기가 같은 태스크에서 `renderComposer()`로 화살표를 스피너로 바꾸고, 친구 진행에서는 전송 버튼이 숨어 있습니다(`#ai-actions[hidden]`). 보내는 순간의 피드백은 P0-2 말풍선과 스피너가 이미 맡습니다 |
| P2-8 | 로딩 흐림(웹) | `body.loading-play` | `body { transition: opacity 160ms var(--m-std); } body.loading-play { transition-delay: 120ms; }`. 빠른 응답(<120ms)에서는 깜빡이지 않습니다 | 160 | 즉시 · 페이지 합성 160ms | **승인**. 지금의 .6 스냅보다 부드럽고, 빠른 응답에서 깜빡임을 없앱니다 |
| P2-9 | 상태 줄 · 기준 시간 초과 | `#composer-status` 텍스트 변경 / `#clock`에 `over`가 처음 붙음 | `m-fade` **[검토]** 160ms, 지연 0(장 해금 때 640ms 지연 삭제). `.warn`이면 모션 없음 / 색 전환 600ms 한 번(깜빡임 없음) | 160 / 600 | 없음 · C0 / C1 | **조건부 승인**. 상태 줄은 입력창 바로 아래의 안내라 640ms 숨기면 R5를 어깁니다. "질문을 먼저 적어 주세요" 같은 경고는 첫 프레임부터 보입니다 |
| P2-10 | 순간 이벤트 | `motion.js`가 `document.dispatchEvent(new CustomEvent('sts:moment', { detail: { type } }))`를 보냅니다. `type`은 `'answer'`, `'clue'`, `'chapter'`, `'reveal'`, `'theme'` | — | — | `music.js`가 효과음을 맞출 때 씁니다(선택). 듣는 쪽이 없어도 문제없습니다 | **승인**. 화면 변화 없음 |

---

## 4. 구조

### 4.1 파일과 넣는 방법

음악 팀의 방식(`web/docs/MUSIC.md` 7.1)과 똑같이 맞춥니다.

- **원본**: `web/public/motion.js`. 의존성 없음, ES2019, `'use strict'` 즉시 실행 함수 하나입니다.
- **웹**: `web/public/index.html`의 `</body>` 바로 앞, `music.js` 태그 다음에 넣습니다.
  ```html
  <script src="music.js" defer></script>
  <script src="motion.js" defer></script>
  ```
  - `defer`이므로 파싱이 끝난 뒤, `DOMContentLoaded` 전에 문서 순서대로 실행됩니다.
  - 모든 훅은 관찰자라 이 시점이면 충분합니다. 표지 첫 인사(P1-9)는 첫 페인트 여부를 스스로 확인합니다.
- **아티팩트**: `index.html`의 맨 끝, `<!-- sts-music:end -->` 다음에 같은 꼴로 인라인합니다.
  ```html
  <!-- sts-motion:begin --><script id="sts-motion">
  /* web/public/motion.js 그대로 */
  </script><!-- sts-motion:end -->
  ```
  - 동기화 도구는 `web/tools/sync-motion.js`입니다. `sync-music.js`와 같은 구조로 표시 사이를 원본으로 덮어씁니다. 표시가 없으면 맨 끝에 더합니다.
  - 아티팩트 안의 `motion.js`가 원본과 바이트 단위로 같은지 테스트로 확인합니다(V9).
  - 주문 문서에는 `<!-- motion:start -->` 표시가 적혀 있었습니다. 하지만 실제 음악 쪽 표시가 `sts-music:begin/end`이므로 그 짝에 맞춥니다.

### 4.2 모듈 구성

```
(() => {
  if (window.STSMotion || window.STS_MOTION === 'off') return;   // 한 번만, 끌 수 있게
  const root = document.documentElement;
  // 1. CSS 주입: <style id="sts-motion-css">를 document.head 끝에 한 번(아티팩트의 <script id="sts-motion">와 겹치지 않게)
  // 2. root.classList.add('m-on'); reduced 감시(m-reduce), visibilitychange(m-paused)
  // 3. 모듈마다 try/catch로 독립 실행: 하나가 실패해도 게임과 다른 모듈은 그대로
  //    pref(1.7.1) · ambient(P0-1, P2-5 ①, 1.8 스크롤·무입력) · reveal(P1-1) · intro(P1-9) · view(P1-3) · theme(P1-4)
  //    log(P0-2, P0-3, P0-6) · clues(P0-4) · hints(P0-5) · turn(P0-7) · tabs(P1-5) · sheet(P1-6) · ended(P1-7) · web(P2-1, P2-8)
  // 4. window.STSMotion = { version: '1.0.0', reduced: () => bool, off: () => void }   // STSMusic과 같은 꼴
})();
```

| 모듈 | 관찰 대상(옵션) | 하는 일 |
|---|---|---|
| pref **[검토]** | `#sec-footer .foot-reset`, `localStorage['sea-turtle-soup:motion']` | 스위치 주입(1.7.1), `m-reduce` 켜고 끄기 |
| ambient | IO `.cover`, `#featured`(**[검토]** `.rv-hero` 뺌), `window` `scroll`·`scrollend`, 입력 이벤트(passive) | `.m-steam` 주입, 화면 밖이면 `m-off`, 스크롤 중 `html.m-scrolling`, 무입력 30초 `m-idle` |
| reveal | MO `#menu-cols`(childList, 첫 렌더까지), IO 대상 묶음 | 1회 `m-pre`, 공개 후 해제 |
| view | MO `#menu-view`, `#play-view`(attributes: hidden) | `m-enter` 450ms |
| theme | 캡처 `click` `.theme-btn` | VT 또는 `m-swap` |
| log | MO `#log`(childList) | pending 감지, `m-morph`, 폭·높이 WAAPI 취소, 장 해금 감지 → turn·tabs 예약, `#convo`에 `m-quiet`. **`#log` 안에서는 새로 들어온 노드에 같은 마이크로태스크에서 클래스를 붙이기만 하고 지우지 않습니다**(다음 렌더에서 게임이 노드를 통째로 바꿈). 음악 모듈이 `#log`의 class 변경을 250ms 조용함 기준으로 듣기 때문입니다(4.6) |
| clues | MO `#clue-dots`, `#goal`, `#clue-count`(childList, characterData, subtree) | 장 키 기억, `m-lit`, `m-up`, `m-tick`, 화면 밖이면 IO로 미룸 |
| hints | MO `#hint-list`(childList) | 새 힌트에 `m-new` |
| turn | 장 해금 신호, 캡처 `click` `.dv-go` | `m-hold` → `m-turn-in`, 끝나면 `turn` 제거 |
| tabs | MO `#ch-tabs`(childList) | 그릇별 상태 기억, `m-press`, `m-unlock` |
| sheet | MO `#reveal`(attributes: hidden), 캡처 `click` `#reopen-btn` | `m-again` |
| ended | MO `#ended-bar`, `#reveal`(attributes: hidden) | `m-hold` → `m-in` |

**규칙**
- MutationObserver 콜백은 묶음당 한 번만 처리합니다. 레코드를 하나씩 순회하지 않고 `:scope > .fresh`처럼 최종 DOM을 조회합니다.
- 콜백 하나는 2ms 이하여야 합니다(`performance.mark`·`measure`, 이름 `sts-motion:<모듈>`).
- 초기화는 8ms 이하입니다(`sts-motion:init`).
- 게임 함수를 감싸거나 덮어쓰지 않습니다. `Element.prototype` 같은 전역도 바꾸지 않습니다. 캡처 단계 리스너만 씁니다.
- 테마에서 이벤트를 멈추는 것(**[검토]** `stopPropagation`만, `stopImmediatePropagation`은 쓰지 않음)은 같은 click을 VT 안에서 다시 보내기 위한 것뿐입니다. `document`에 걸린 다른 캡처 리스너(음악 모듈)는 순서와 상관없이 원래 click을 받습니다.
- **[검토]** MutationObserver 콜백에서 크기·위치를 읽지 않습니다(1.10 A7). 보이는지 여부는 IO 콜백이 기억해 둔 값을 씁니다.
- **[검토]** 입력·스크롤 리스너는 모두 `passive: true`입니다. 스크롤 처리기는 클래스 토글만 하고 layout을 읽지 않습니다.
- 장 키는 DOM 텍스트(`#p-title`, `#clue-title`, `#hint-title`)로 만듭니다. 게임 상태에 접근하지 않습니다.

### 4.3 이름과 전역

| 종류 | 이름 |
|---|---|
| 클래스 | `m-` 접두사(`m-on`, `m-reduce`, `m-paused`, `m-off`, `m-pre`, `m-in`, `m-enter`, `m-hold`, `m-turn-in`, `m-morph`, `m-lit`, `m-up`, `m-tick`, `m-new`, `m-press`, `m-unlock`, `m-again`, `m-quiet`, `m-long`, `m-swap`, `m-theme-vt`, `m-intro`, **[검토]** `m-scrolling`, `m-idle`, `m-wait`, `m-pref`, **[구현]** `m-xfade`, `m-r`, `m-dots`, `m-wisp`, `m-steam`, **[2차]** `m-same`). 김 줄기의 `w1`–`w3`는 **[2차]** `.m-wisp.w1`처럼 `m-wisp`와 함께만 씁니다 |
| 키프레임 | `m-` 접두사 |
| CSS 변수 | `--m-` 접두사 |
| 주입 요소 | `.m-steam`, `.m-wisp`(장식, `aria-hidden`). **[검토]** `button.text-btn.m-pref`(1.7.1 스위치, 푸터. 유일하게 접근성 트리에 들어가는 주입 요소) |
| 저장 키 **[검토]** | `sea-turtle-soup:motion`(`'reduce'` 또는 없음) |
| 전역 | `window.STSMotion`만. 읽는 플래그는 `window.STS_MOTION` |
| 스타일 요소 | `#sts-motion-css`(아티팩트의 인라인 스크립트는 `#sts-motion`) |
| 이벤트 | `sts:moment` |

### 4.4 공유 수정 (두 화면에 똑같이, 꼭 필요한 것만)

이 수정들은 `motion.js`가 없어도 페이지가 바르게 동작하게 하는 결함 수정입니다. `motion.js`는 같은 내용을 방어용으로 한 번 더 덮어씁니다.

| ID | 위치(아티팩트 줄 / 웹 같은 선택자) | 바꾸기 전 | 바꾼 뒤 | 이유 |
|---|---|---|---|---|
| S1 | `.pending .msg-out .bubble, .fresh .msg-out .bubble { animation: sendIn … }`(825행) | 두 선택자 | `.pending .msg-out .bubble { animation: sendIn .28s var(--ease-out) both; transform-origin: 100% 100%; }`. 826행 `.fresh.by-host …`는 그대로 | D1 |
| S2 | `.hint-open { …; animation: fadeUp .4s var(--ease-out) both; }`(728행) | animation 있음 | `animation` 선언 삭제 | D2 |
| S3 | `.clock-bar span { …; transition: width 1s linear; }`(587행) | 전환 있음 | `transition` 선언 삭제 | D3 |
| S4 | `.problem.turn .ch-head, .problem.turn .scene-card { animation: panelIn .5s … }`, `@keyframes panelIn { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } }`(643–645행) | 이동·블러 500ms | `animation: panelIn .24s var(--ease-out) both;`, `@keyframes panelIn { from { opacity: 0; } }`, 카드 지연 줄 삭제 | D6, R2 |
| S5 | `.world[open] .world-body`(672행), `.host-body`(749행), `.entry-chapter.fresh .dv-body, .entry-chapter.fresh .dv-next`(882행) | `fadeUp` 400–500ms | `.world-body`·`.host-body`: `animation: fadeIn .2s var(--ease-out) both;`. 882행을 둘로 나눔: `.entry-chapter.fresh .dv-body { animation: fadeIn .24s .4s var(--ease-out) both; }`, `.entry-chapter.fresh .dv-next { animation: fadeUp .5s .4s var(--ease-out) both; }` | R2 |
| E1 | JS `morphFromTyping(li)` 함수와 `renderLog()` 안의 호출 한 줄 | WAAPI width/height | 함수와 호출 삭제(표현용 코드, 게임 규칙 아님) | D5. 변형은 `motion.js`의 clip-path가 맡습니다 |
| E2 **[검토]** | JS `turnPage(fromButton)` | 데스크톱 `#col-left.scrollTo({ top: 0, behavior })`, 폰 `prob.scrollIntoView({ block: 'start', behavior })` | 이동 거리(데스크톱 `#col-left.scrollTop`, 폰 `Math.abs(prob.getBoundingClientRect().top)`)가 `1.5 × innerHeight`를 넘으면 `behavior: 'auto'` | 폰 "새 장면 보기"는 정답 글 2–3화면을 거슬러 올라가는 부드러운 스크롤입니다. 화면 전체의 글이 빠르게 흐르는 것은 전정 자극이 크고(1.6), 그동안 읽을 수 있는 것도 없습니다. 도착 뒤의 P0-7 페이드가 "새 쪽" 느낌을 맡습니다. 4.8의 권고를 공유 수정으로 올렸습니다 |
| E3 **[검토]** | JS `const reduceMotion = () => …`(아티팩트 3771행) | `matchMedia('(prefers-reduced-motion: reduce)')`만 봄 | `… \|\| document.documentElement.classList.contains('m-reduce')` | 1.7.1 스위치를 켠 사람에게도 게임의 부드러운 스크롤이 멈추게. `motion.js`가 없으면 클래스가 없으므로 동작은 지금과 같습니다 |
| E4 **[2차]** | JS `scrollToEntry(el)`(아티팩트 4666행, 웹 2570행) | `behavior: reduce ? 'auto' : 'smooth'` | `const far = Math.abs(el.getBoundingClientRect().top) > 1.5 * window.innerHeight;`, `behavior: reduce \|\| far ? 'auto' : 'smooth'` | E2와 같은 규칙. 폰에서 장면 맨 위에서 첫 질문을 보내면 대기 말풍선까지 1,494px(1.77화면)의 장면 글이 약 670ms 동안 흘렀습니다. 대화를 보며 묻고 답할 때(가까운 거리)는 그대로 부드럽습니다 |

이 밖의 게임 HTML, CSS, JS는 바꾸지 않습니다.

### 4.5 크기 예산

| 항목 | 상한 |
|---|---|
| `motion.js` 원본(주석 포함) | ~~22 KB~~ **[2차]** 40 KB(40,960 B) |
| 그 안의 주입 CSS | ~~10 KB~~ **[2차]** 15 KB(15,360 B) |
| gzip | ~~7 KB~~ **[2차]** 14 KB(14,336 B) |

**[2차]** 처음 예산은 이 사양이 그대로 넣으라고 한 CSS(`.m-on`을 붙이면 약 13 KB)와 [검토]로 더해진 기능(스위치, 스크롤 중·무입력 정지, 미리 덮기, 입력 리스너, 접근성 조건)을 담을 수 없었습니다(7.6.4-1). 식별자까지 줄이는 압축기로도 28.7 KB / gzip 10.0 KB입니다. 실제 비용 목표(init, 콜백, V3, CLS)는 크기와 따로 재며 모두 넘습니다. 사람이 고칠 수 있는 원본(주석 포함)을 유지하고 예산을 위처럼 고칩니다. 오너 확인이 필요한 변경입니다(7.7).
| 이미지·폰트·외부 요청 | 0 |
| 아티팩트 증가분 | 22 KB 이하(현재 561 KB) |

### 4.6 `music.js`와 공존 (`web/docs/MUSIC.md` 기준)

- **스피커 버튼** `.icon-btn.music-btn`은 각 `.theme-btn` 바로 **앞**에 들어옵니다(MUSIC 6.3).
  - 테마 캡처 리스너는 `closest('.theme-btn')`에만 반응하므로 스피커 버튼 클릭은 그대로 지나갑니다.
  - **[검토]** 테마 버튼 클릭도 음악 모듈의 `document` 캡처 리스너(오디오 잠금 해제, MUSIC 6.2)에 그대로 닿습니다. 모션은 `stopPropagation()`만 쓰므로 같은 노드(`document`)의 다른 리스너는 멈추지 않습니다. VT 안에서 다시 보내는 `btn.click()`은 신뢰되지 않은 이벤트라 음악 쪽에는 사용자 동작으로 잡히지 않고, 원래 click이 이미 잠금 해제를 했습니다.
  - **[검토]** 1.7.1 스위치는 메뉴 푸터에 있어 상단 바의 스피커·테마 버튼 줄을 넓히지 않습니다. 소리 끄기(스피커)와 움직임 줄이기(스위치)는 서로 독립입니다.
  - `.m-swap`의 전환 차단은 스피커 버튼에도 360ms 걸리지만, 그 버튼에는 전환이 없어 차이가 없습니다.
  - `motion.js`는 `.music-btn`을 선택하거나 꾸미거나 움직이지 않습니다.
- **음악 모듈의 DOM 관찰**(MUSIC 6.2)
  - 음악 모듈은 `#menu-view`, `#play-view`, `#reveal`, `#rv-seal`의 `hidden`, `#log`의 childList·subtree·class, `<html>`의 `data-theme`을 듣습니다. 마지막 변경 뒤 250ms가 조용해지면 장면을 판정합니다.
  - 그래서 `motion.js`는 이렇게 합니다.
    - `#log` 안에서는 게임이 노드를 넣은 같은 마이크로태스크에서 클래스를 붙이기만 하고, 나중에 지우지 않습니다.
    - 장 해금 생략 표시(`m-quiet`)는 `#log` 밖 `#convo`에 붙입니다.
    - `hidden`과 `data-theme`은 절대 바꾸지 않습니다.
  - 테마 전환에서 View Transition 안의 `btn.click()` 재생은 게임 처리기가 `data-theme`을 바꾸는 것이라, 음악 쪽은 평소와 같은 변경을 봅니다.
- **장 해결 큐**: 음악 쪽 큐(MUSIC 6.2)와 장 해금 모션(P0-6)은 각자 같은 DOM 신호(`.entry-chapter` 증가)로 시작합니다. 둘은 서로 부르지 않습니다. `sts:moment` 이벤트(P2-10)는 음악 팀이 원할 때만 쓰는 선택 사항입니다.
- **reduced motion**: 음악은 이 설정을 따르지 않습니다(MUSIC 6.7). 모션은 1.7절을 따릅니다. 서로 영향이 없습니다.
- **탭 숨김**: 둘 다 `visibilitychange`를 따로 듣습니다. 모션은 앰비언트를 멈추고, 음악은 페이드아웃 뒤 suspend합니다.
- **넣는 순서**: 게임 → `music.js` → `motion.js`. 순서가 바뀌어도 동작해야 합니다. 전역은 `window.STSMusic`과 `window.STSMotion`으로 겹치지 않습니다.

### 4.7 구현 순서

각 단계 끝에 5절의 해당 검증을 돌립니다.

1. **S1–S5, E1–E3을 적용합니다.** 두 화면을 같은 diff로 고칩니다. 이것만으로 D1, D2, D3, D5, D6(일부)이 사라집니다. **[검토]** S3(시계 막대)를 가장 먼저 넣습니다(폰 성능 1순위, 2.1.1).
2. **P0-9 기반**을 만듭니다: 주입, 플래그, reduced, 멈춤.
3. **P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P0-6 → P0-7**을 차례로 만듭니다.
4. **P1-3, P1-4, P1-5, P1-6, P1-7, P1-8, P1-10 → P1-1, P1-2, P1-9**를 만듭니다.
5. **P2**를 만듭니다. 5절 예산을 넘으면 넣지 않습니다. **[검토]** 제외한 P2-2, P2-4의 본문 페이드, P2-5 ②③, P2-7은 만들지 않습니다.

**[검토]** 2단계(P0-9 기반)에 1.7.1 스위치, 1.8 스크롤 중·무입력 정지, 1.10 불변 조건을 함께 넣습니다. 앰비언트(P0-1)보다 먼저 있어야 합니다.

### 4.8 모션 범위 밖 (기록만)

폰에서 장이 풀릴 때 CLS 0.663이 생깁니다. 대화 기록 아래에 있는 힌트·진행자·막힘 카드가 디바이더 삽입으로 한 번에 밀리기 때문입니다. 답마다 생기는 0.009도 원인이 같습니다(답 말풍선이 커지며 아래 도구 카드를 밉니다). 데스크톱 장 해금 재렌더 0.054도 마찬가지입니다.

이것들은 레이아웃 순서에서 생기며 모션으로는 고칠 수 없습니다. 이 사양의 목표는 "모션이 더하는 CLS 0"입니다. 기준선을 낮추려면 게임 쪽에서 따로 다뤄야 합니다(예: 폰에서 대화 아래 도구 카드를 접는 것). 장 넘김의 폰 "새 장면 보기"는 화면 몇 장 거리를 부드럽게 스크롤합니다. ~~이것도 게임 스크롤이라 이 사양에서는 바꾸지 않습니다. 거리가 1.5화면을 넘으면 `behavior:'auto'`로 바꾸는 것을 게임 쪽 후속 과제로 권합니다.~~ **[검토]** 전정 안전 문제라 공유 수정 E2로 올렸습니다(4.4).

---

## 5. 성능 · 검증 목표

`STS_MOTION='off'`(기준선)와 기본(모션 켬)으로 같은 시나리오를 돌려 비교합니다. 도구는 이번 감사의 `tools/perf.js`와 `tools/rec.js`를 넓혀 쓰거나, 같은 방법으로 새로 씁니다.

**[검토] 두 프로필과 측정 규칙**
- **데스크톱**: 1440×900, DPR 2(또는 1), CPU 감속 없음.
- **폰(중급기 기준)**: 390×844, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, CDP `Emulation.setCPUThrottlingRate({ rate: 4 })`. 중급 안드로이드 폰의 메인 스레드는 데스크톱보다 대략 4배 느리고 화면 밀도는 2.6–3입니다. 데스크톱 1배만으로 재면 폰에서 프레임을 놓치는 모션도 통과합니다. **비용 기준(V2–V5, V12)은 폰 프로필에서 통과해야 합니다.**
- **rAF 관찰 효과**: rAF 루프는 메인 스레드에 프레임을 강제하므로 측정값을 바꿉니다(2.1.1). "가만히 있을 때" 비용은 rAF 루프 **없이** 재고, "프레임을 그리는 동안"(스크롤·입력 중) 비용은 rAF 루프를 **일부러** 돌려 정지 바닥과 비교합니다. 두 값을 섞어 비교하지 않습니다.
- 각 창은 3번 재서 중앙값을 씁니다.

### 5.1 통과 기준

| ID | 지표 | 방법 | 기준 |
|---|---|---|---|
| V1 | 모션이 더하는 CLS | `PerformanceObserver('layout-shift')`, `hadRecentInput=false`, 한 장 전체(질문 5 + 단서 2 + 힌트 2 + 추리 성공), 1440×900·390×844 | 켬 − 끔 = 0.000(±0.0005). 20ms 이하 간격으로 이어지는 이동 묶음 0건 |
| V2 | 긴 작업 | `PerformanceObserver('longtask')`(가능하면 `long-animation-frame`도), V1 시나리오 + 메뉴 스크롤 + 리빌. **[검토] 폰 프로필에서** | 끔과 같은 수. `sts-motion:*` measure 최대 2ms, init 16ms 이하(**[검토]** 폰 프로필 기준. 데스크톱 1배로 환산하면 0.5ms·4ms) **[2차]** 긴 작업 수는 켬 − 끔(3회 중앙값)이 같은 모드 안의 실행 간 폭(최소 1) 이내이고, 모션 몫(긴 작업 안에서 돈 `sts-motion:*` 콜백 시간) 때문에 50 ms를 넘은 긴 작업은 3회 합 1개 이하, 긴 작업 시간 중 모션 몫은 2% 이하. 콜백 p95 ≤ 2 ms는 표본 20개 이상인 모듈마다와 모든 콜백을 모아서, 최대는 모듈마다 첫 호출을 빼고 실행마다 최대의 3회 중앙값 ≤ 4 ms(첫 호출은 V8 컴파일, 드문 최대는 JIT 단계 올림·GC·VM 정지가 겹친 것으로 모션 논리와 무관. 7.7) |
| V3 | 표지 앰비언트 비용 | **[검토]** 두 조건. ⓐ 가만히: rAF 루프 없이 CDP `Performance.getMetrics` 5초. ⓑ 프레임 생성 중: rAF 루프 3초, 같은 창에서 모든 애니메이션 `paused` 바닥과 비교. 폰 프로필 | ⓐ `LayoutCount` 0, `RecalcStyleCount` ≤ 2. ⓑ `LayoutCount` 켬 − 바닥 = 0, `TaskDuration` 켬 − 바닥 ≤ **1.2 ms/프레임**(시제품 1.19, 지금 1.64). JS rAF 루프 0개 |
| V3s **[검토]** | 스크롤 중 정지 | 표지가 보이는 상태에서 `mouse.wheel`로 2초 스크롤(폰 프로필은 `touchscreen` 스와이프) | 스크롤 중 앰비언트 `playState === 'paused'` 100%, 멈춘 뒤 300ms 안에 `running`. 스크롤 창 `TaskDuration` 켬 − 끔 ≤ 0.3 ms/프레임 **[2차]** "멈춘 뒤"는 마지막 `scroll` 이벤트(화면이 실제로 멈춘 때)부터 잽니다. 손가락을 뗀 뒤부터 폴링으로 재면 관성 스크롤과 4배 감속 폴링 지연(합 200–370 ms)이 섞입니다 |
| V4 | 화면 밖·숨김·무입력 멈춤 | 표지를 화면 밖으로 스크롤 / `document.hidden`을 흉내(`Emulation.setFocusEmulationEnabled` 또는 탭 전환) / **[검토]** 입력 없이 31초 | 앰비언트 애니메이션 `playState === 'paused'` 100%, 5초 창 `LayoutCount` 0. **[검토]** 31초 뒤 `m-idle`, 다음 `pointerdown`에 `running` |
| V5 | 플레이 대기 비용 | 플레이 화면, 질문 없이 5초, rAF 루프 없이, **[검토]** 폰 프로필 | `LayoutCount` ≤ 10(지금 302), `TaskDuration` ≤ 60ms/5초(지금 513). 무한 반복 애니메이션 0(`getAnimations().filter(a => a.effect.getTiming().iterations === Infinity)`) **[2차]** 폰 작업 시간은 켬·끔 3번씩 중앙값으로 켬 − 끔 ≤ 5 ms, 켬 ≤ 100 ms(S3 전 513 ms의 회귀 감시). 측정 VM에서는 게임 혼자(끔)도 51–67 ms라 60 ms 절대 기준이 모션과 상관없이 흔들렸습니다 |
| V6 | 읽기 글 보호 | V1 시나리오 동안 50ms마다 `getAnimations()` 표본. 대상이 1.2절 LONG이거나 렌더된 LONG을 포함하는 애니메이션 | 키프레임 속성이 `opacity`만이고 240ms 이하(지연 제외). X1·X2 예외는 각 선택자·값 범위 안. 같은 글(텍스트 해시) 요소당 재생 1회 |
| V7 | 이미 연 힌트 정지 | 힌트 1 열고 1초 뒤 힌트 2 열기. 힌트 1 상자를 `page.screenshot({ clip })`으로 50ms 간격 10장 | 10장이 바이트 단위로 같음 |
| V8 | reduced | `reducedMotion: 'reduce'` 컨텍스트로 V1 시나리오 + 테마 + 리빌. **[검토]** 같은 시나리오를 reduced가 아닌 컨텍스트에서 1.7.1 스위치를 켜고 한 번 더 | 키프레임에 `transform`·`translate`·`scale`·`rotate`·`clipPath`가 있는 애니메이션 0. 남는 애니메이션은 opacity, 160ms 이하, 4곳(답·힌트·디바이더·리빌 카드). 무한 반복 0. View Transition 0. `m-pre`·`m-hold`·`m-wait`·`m-lit` 0. **[검토]** 스위치 경로에서는 게임 CSS 애니메이션(`badgePop`, `unfold`, `sheetIn` 등)과 전환도 0, `#col-left`·창 스크롤은 즉시(E3) |
| V9 | 크기 · 동일성 | `wc -c`, `gzip -c \| wc -c`, 아티팩트 표시 구간과 원본 비교 | 4.5절 예산 이하. 바이트 동일 **[2차]** 예산은 40 / 15 / 14 KB |
| V10 | 기존 검증 | `design-kit/smoke.js`, `shots.js`, `web` `npm test` | `SMOKE: ALL PASS`, `no console errors, no overflow`, 테스트 통과. REVIEW §5.2 수용 기준 1–21(특히 13: reduced에서 배지 완성, 디바이더 펼침) 회귀 없음 |
| V11 | 테마 전환 | 두 방향 × 메뉴·플레이, 25fps 녹화 | 400ms 안에 끝남. 중간 프레임에서 전송 버튼 등 주 컨트롤의 대비가 3:1 아래로 떨어지는 프레임 0(색이 따로 전환되지 않음) **[2차]** 테마 클릭 120–150ms 뒤의 클릭이 대상에 닿음(스피커 토글, 두 번째 테마 클릭은 원래 테마로, 「시작하기」는 그릇을 엶) |
| V11-p **[검토]** | 테마 전환, 폰 | 폰 프로필, 메뉴·플레이 각 3회, VT 시작부터 `finished`까지 rAF 간격 | 총 ≤ 450ms, 33ms 넘는 프레임 ≤ 2개. 못 넘으면 `(pointer: coarse)`에서 VT를 끄고 `m-swap`만(P1-4). VT 중 `pointerdown`을 보내면 50ms 안에 끝남(`skipTransition`) |
| V12 **[검토]** | 히어로 프레임 | 폰 프로필. 답 도착(P0-3), 단서(P0-4), 힌트(P0-5), 장 해금(P0-6·P0-7), 화면 진입(P1-3), 리빌(P1-6) 각각 트리거부터 1.4초 rAF 간격, 켬과 `off` 각 3회 | 켬 − 끔: 33ms 넘는 프레임 증가 ≤ 1, p95 증가 ≤ 4ms. P0-6이 못 넘으면 1,024px 미만에서 펼침을 페이드로 바꿈 **[2차]** 화면 진입(P1-3)은 시나리오에서 실행당 창이 하나뿐이라, 표지에서 오늘의 추천을 여는 진입 창을 켬·끔 8개씩 더해 셉니다 p95는 창마다 내서 창들의 중앙값으로 비교합니다(모은 간격의 p95는 4배 감속에서 16.7 ms 단위라, 33 ms 넘는 프레임 수가 같아도 5% 경계에서 한 프레임씩 뒤집힘) |
| V13 **[검토]** | 레이어 | 표지가 보일 때와 플레이 중, 렌더된 요소(`el.getClientRects().length > 0`) 가운데 `getComputedStyle(el).willChange !== 'auto'`인 요소 수 | 표지 ≤ 4(램프 1 + 김 3), 플레이 0. 끝난 모션이 `will-change`를 남기지 않음 |
| V14 **[검토]** | 움직임 줄이기 스위치 | 메뉴 푸터에서 Tab으로 스위치에 닿아 Space로 켬, 새로 고침 | `aria-pressed="true"`, `html.m-reduce`, 표지 무한 애니메이션 모두 정지, 새로 고침 뒤에도 유지(`sea-turtle-soup:motion`). 저장소가 막혀도(throw) 오류 없이 이 페이지에서만 동작. OS reduce일 때 `aria-disabled="true"` |
| V15 **[검토]** | 보이지 않는 것은 눌리지 않음 | P1-1 숨김 중 아래 8% 띠의 메뉴 행 좌표를 `mouse.click`, P0-7 보류 중 힌트 버튼 좌표를 클릭 | 그릇이 열리지 않고 힌트가 쓰이지 않음. 대신 해당 요소가 공개됨 |
| V16 **[검토]** | 접근성 불변 | V1 시나리오 동안 `MutationObserver`로 `motion.js` 쪽 변경 기록(모듈 함수에서 `performance.mark` 사이) + `document.activeElement` 표본 | `hidden`·`inert`·`aria-*`·`role`·`tabindex`·글자 변경 0(스위치 자신 제외), `motion.js`가 옮긴 포커스 0, 넣은 장식 요소 모두 `aria-hidden="true"` **[2차]** 메뉴를 Tab 60ms 간격으로 지날 때 조상 포함 opacity가 0.99 아래인 포커스 0. 접근성 트리(역할별 노드 수)는 켬과 끔이 스위치 버튼 하나만 다름 |
| V17 **[2차]** | 보이던 글·카운터를 숨기지 않음 | 데스크톱: 핵심 단서 답에서 애니메이션을 멈추고 시각을 옮겨 `#goal` 숫자·아이콘 불투명도, 이미 그 장면이고 `#col-left.scrollTop` 0일 때 "N장 장면으로"를 누르고 1초 동안 rAF마다 `#problem` 자식 불투명도. 폰: 미터가 보일 때 `#clue-count` | 목표 숫자·아이콘 늘 1. "N장 장면으로" ≥ 0.9. `#clue-count` 늘 1 |
| V18 **[2차]** | 표시 순서 | 답이 도착한 그 마이크로태스크에 애니메이션을 멈추고 10ms씩 옮김. 메모·태그가 있는 답, 단서 답, 장을 여는 답 | 말풍선 clip에서 다 드러난 줄의 내용 불투명도 ≥ 0.3(빈 상자 0). 링(`.entry-hit::after`, `#goal::after`, `.clue-dot::after`, `.ch-tab::after`)은 지연 −1ms에 opacity 0. 마지막 인사의 타이핑 점은 480ms(DOM 변경 시각으로 잼) 동안 있고 기다리는 동안 rAF마다 opacity 1, 점에서 인사 말풍선으로 넘어갈 때 둘 다 0.3 아래인 프레임 0 |
| V19 **[2차]** | 긴 스크롤(E2·E4) | 폰, 장면 맨 위에서 첫 질문을 보내고 2초 동안 rAF마다 `scrollY` | 거리가 1.5 × `innerHeight`를 넘으면 중간 값이 있는 프레임 ≤ 1(한 번에 이동) |

### 5.2 프레임 띠 검토 목록 (리뷰어)

**녹화 방법**
- 녹화: Playwright `recordVideo`, `STS_MOTION='force'`. 순간마다 화면 왼쪽 위 16px 색 마커를 바꿉니다(`tools/rec.js` 방식).
- 시각 찾기: `tools/marks.py`
- 띠 자르기: `tools/strip.sh <영상> <시작> <길이> <out.png> <폭> <열> 8 [crop]`
- 같은 순간을 기준선(`off`)과 나란히 놓고 봅니다.

| # | 순간 | 화면 | 볼 것(통과 조건) |
|---|---|---|---|
| FS-01 | 표지 6초(fps 4, 램프·그릇 crop) | 1440 어두움, 390 밝음 | 램프가 9초 주기로 ±0.5° 흔들림(하단 3px 이내). 김 세 줄이 따로 오르고 사라짐. 줄 끝이 화면 위에서 끊겨 보이지 않음. **[검토]** 스크롤하는 동안 김·램프가 멈춰 있고, 멈춘 뒤 다시 돎. 원뿔 안에 떠다니는 점 없음(P2-5 ② 제외) |
| FS-02 | 메뉴 스크롤(3초) | 1440 밝음 | 섹션이 처음 들어올 때만 떠오름. 대본 말풍선이 90ms 간격. 멈춘 뒤 움직이는 글 0. 다시 올라갔다 내려와도 재생 없음 |
| FS-03 | 오늘의 추천 hover → 떠남 → press | 1440 어두움 | 카드 -3px, 아트 -4px 더, 그림자 깊어짐. 누름 .985. 기울기 없음 |
| FS-04 | 메뉴 → 플레이 → 메뉴 | 1440·390 | 바가 내려오고, 그리드가 페이드되고, 독이 올라옴. 450ms 뒤 정지. 대화가 맨 아래에 있음 |
| FS-05 | 보통 질문 | 1440 어두움(대화 crop) | 질문이 한 번만 떠오름(답이 와도 다시 안 남). 타이핑 → 답: 같은 왼쪽 위에서 말풍선이 열림. 빈 말풍선이 커지는 프레임 0 |
| FS-06 | 단서 질문(#1) | 1440·390 | 배지(0) → 태그 육각 채움·링(360–1,120) → 목표 육각·숫자 굴림(480–). 폰은 미터 칸이 아래에서 차오름. 데스크톱 미터는 스크롤해 보일 때 재생됨 |
| FS-07 | 힌트 1 → 힌트 2 | 1440(왼쪽 crop) | 새 힌트만 버튼 높이에서 아래로 펼쳐짐. 힌트 1은 완전히 정지(V7) |
| FS-08 | 세계관 열기 | 1440 | 글이 이동 없이 200ms 페이드 |
| FS-09 | 추리 → 장 해금 | 1440 어두움 | 배지 → 디바이더 펼침(120–760) → 숫자 상승 → 오른쪽 위 플레어 1회 → 제목·정답. 왼쪽은 흐르는 글이 한 프레임도 보이지 않고, 640ms 뒤 새 장면이 페이드되며 카드 윗선에 빛 한 줄이 지나감 |
| FS-10 | 장 해금 → "새 장면 보기" | 390 밝음 | 페이지 스크롤 중 디바이더 펼침. 버튼 뒤 스크롤하는 동안 `#problem` 숨김, 도착 후 페이드 |
| FS-11 | 장 탭 클릭, 새 장 열림 | 1440 | 누른 탭 .94 → 1 안착. 열린 탭에 빛 링 1회(760ms) |
| FS-12 | 테마 두 방향 × 메뉴·플레이(fps 25) | 1440·390 | 스위치에서 원이 번져 **[2차]** 320ms 안에 끝남. 일부만 따로 바뀌는 프레임 0(V11) |
| FS-13 | 넘기기 확인창 | 1440 | 220ms, 6px |
| FS-14 | 리빌 처음 / "정답 다시 보기" | 1440·390 | 시트 32px. 메달 상승·회전. 플레어. 별 3. 스탯 5칸 40ms 간격, 각주까지 1,040ms 안에 완성. 다시 열 때는 시트만 320ms |
| FS-15 | 리빌 닫기 → 끝 바 | 1440·390 | 리빌을 닫은 뒤에 끝 바가 올라오고 메달 미니가 튐 |
| FS-16 | reduced 전체(FS-01–15) | 1440 | 움직임 0. 크로스페이드는 4곳만, 160ms 이하. 김 .6 정지, 램프 정지 |
| FS-17 | 토스트(웹) | 390 | 12px 아래에서 들어오고, 5초 뒤 나감. 가로 가운데 유지 |
| FS-18 **[검토]** | 「화면 움직임 줄이기」 켬 → FS-01·05·09·14 | 1440 | FS-16과 같은 결과(OS 설정 없이). 폰 "새 장면 보기"는 즉시 이동 |
| FS-19 **[검토]** | 폰 "새 장면 보기"(정답 글 2화면 이상) | 390 밝음 | 페이지가 여러 화면을 흘러가는 프레임 0(E2 즉시 이동). 도착 뒤 `#problem` 페이드, 카드 윗선 빛 한 줄 |
| FS-20 **[검토]** | 리빌을 열고 진상까지 스크롤 | 390 | 화면에 들어오는 진상 글이 투명에서 시작하는 프레임 0(P2-4 본문 페이드 제외). 메달 둘레에 반복 맥박 없음(P2-5 ③ 제외) |

---

## 6. 하지 않는 것 (이유)

- **스크롤 패럴랙스, 스크롤 연동 애니메이션, 카드 3D 틸트, 커서를 따라가는 램프 빛**: 어지럼 위험이 있고, 읽는 중에 글 주변이 움직입니다.
- **진행자 답의 타자기 효과**: 답을 읽는 것을 늦춥니다. 접근성 낭독도 쪼개집니다.
- **숫자 세기**(스탯, 단서 수): 읽기 전에 값이 바뀝니다.
- **오답("아직")의 흔들기**: 꾸짖는 느낌을 줍니다. 배지 안착만으로 충분합니다.
- **완식 색종이, 입자 폭발**: 「밤의 카운터」의 조용한 톤과 맞지 않습니다. 빛 플레어 한 번과 별 세 개로 끝냅니다.
- **플레이 화면의 상시 앰비언트**(김, 먼지, 빛 루프): 40–80분 동안 주변 시야를 건드립니다. 플레이는 사건이 있을 때만 움직입니다.
- **화면 전체 블러 전환, filter 애니메이션**: 비싸고, 글이 흐려집니다.
- **canvas 파티클**: CSS 합성으로 같은 효과를 0에 가까운 비용으로 낼 수 있습니다.
- **[검토] 포커스 링 애니메이션**(P2-2): 링은 첫 프레임부터 온전히 보여야 합니다.
- **[검토] 표지 원뿔 안 먼지 입자**(P2-5 ②), **리빌 메달 후광 반복**(P2-5 ③): 뜻 없는 주변 움직임이 제목과 스탯 바로 옆에서 끝없이 이어집니다.
- **[검토] 스크롤로 들어오는 긴 글의 페이드**(P2-4 본문): 읽으려고 내린 글이 늦게 나타납니다(R5).
- **[검토] 보이지 않는 곳의 모션**(P2-7 전송 화살표): 같은 태스크에서 스피너로 바뀌어 아무도 못 봅니다. 비용만 남습니다.
- **메뉴 ⇄ 플레이 View Transition**: 게임 로직을 바꾸지 않고는 걸 수 없습니다(P1-3).

---

## 7. 검토 결과 (접근성·UX, 2026-10-16)

### 7.1 기준

오너의 조건 "게임 진행을 방해하거나 내용을 파악하기 어렵게 하는 요소는 넣지 마"를 아래 여섯 가지로 나눠 항목마다 따졌습니다.

| 관점 | 묻는 것 |
|---|---|
| 읽기 | 긴 한국어 장면·정답 글이 움직이거나, 늦게 나타나거나, 뒤에서 무언가 움직이는가 |
| 입력·답하기 | 타이핑과 전송, 친구 진행의 답 버튼을 막거나 늦추는가. 보이지 않는 것이 눌리는가 |
| 대화 훑기 | 지난 질문과 답을 스크롤해 볼 때 다시 움직이는 것이 있는가 |
| 단서 카운터 찾기 | 진전 신호가 보이는 곳에서, 보일 때, 헷갈리지 않게 나오는가 |
| 접근성 | 전정(어지럼), 주의 분산(WCAG 2.2.2), 깜빡임(2.3.1), 스크린 리더, 키보드 포커스(2.4.7), reduced motion(2.3.3) |
| 성능 | 중급 폰(CPU 4배 감속, DPR 3)에서 프레임을 놓치거나 배터리를 쓰는가 |

### 7.2 판정 한눈에

| 판정 | 항목 |
|---|---|
| **승인** | P0-3 답 도착, P0-5 힌트, P0-8 시계 막대(성능 1순위), P0-9 기반, P1-2 추천 카드 깊이, P1-5 장 탭, P1-6 리빌, P1-8 생각 중, P1-10 확인창·세계관, P2-1 토스트, P2-3 탭 안착, P2-6 장 탭 크로스페이드, P2-8 로딩 흐림, P2-10 순간 이벤트, 공유 수정 S1–S5·E1 |
| **조건부 승인** | P0-1 표지(스위치·스크롤 중 정지·무입력 정지), P0-2 질문 보냄(24 → 12px), P0-4 단서(미리 덮기·IO 기억값), P0-6 장 해금(폰 성능 관문), P0-7 장면 넘김(700ms 통일·눌림 차단·입력 리스너·E2), P1-1 메뉴 리빌(눌림 차단·끝 공개·스태거 단축·12px), P1-3 화면 진입(12px), P1-4 테마(`stopPropagation`·`skipTransition`·폰 관문), P1-7 끝 바(12px), P1-9 표지 인사(저장소 대체·해시), P2-4 마지막 인사(480ms, 열 때 보이면 생략), P2-5 ① 추천 아트 숨쉬기(멈춤 규칙), P2-9 상태 줄(지연 삭제·경고는 즉시) |
| **제외** | P2-2 포커스 링 안착, P2-4의 `.rv-section` 처음 보일 때 페이드, P2-5 ② 표지 먼지 입자, P2-5 ③ 메달 후광 반복, P2-7 전송 화살표 튕김 |
| **새로 더함** | 1.7.1 「화면 움직임 줄이기」 스위치, 1.8 스크롤 중·무입력 30초 정지, 1.10 접근성 불변 조건 A1–A7, 공유 수정 E2(긴 스크롤 즉시 이동)·E3(`reduceMotion()`이 스위치도 봄), 검증 V3s·V11-p·V12–V16, FS-18–20 |

### 7.3 바꾼 것과 이유

1. **WCAG 2.2.2를 지키는 페이지 안 스위치(1.7.1).** 표지의 빛·흔들림·김·단서 점은 저절로 시작해 5초 넘게 이어지고 다른 내용과 함께 보입니다. A등급 기준은 이것을 멈출 수단을 페이지 안에 요구하고, OS 설정은 그 수단이 아닙니다. 상단 바는 음악 스피커와 테마 버튼으로 찼으므로 메뉴 푸터에 둡니다. 켜면 OS reduce와 같은 경로를 타고, 게임 CSS 모션과 게임 스크롤(E3)도 멈춥니다.
2. **스크롤 중·무입력 30초 정지(1.8).** 흐르는 화면 위의 독립 모션은 전정 부담을 키웁니다. 측정해 보니 메인 스레드가 프레임을 그리는 동안 표지 앰비언트는 폰에서 프레임마다 1.2ms를 더했고, 그중 램프 흔들림이 0.55ms로 가장 컸습니다. 메뉴에서 그런 프레임이 생기는 주된 때가 스크롤이라, 스크롤 중에 멈추면 비용과 어지럼이 함께 줄어듭니다. 흔들림 자체는 진폭이 작고 표지 분위기에 기여하므로 남겼습니다.
3. **보이지 않는 것은 눌리지 않음(1.5-4).** 장 넘김 보류(`m-hold`)와 메뉴 리빌 숨김(`m-pre`)은 opacity 0이라 그대로 두면 눌립니다. 힌트는 별점에 영향을 주고, 메뉴 행은 그릇을 엽니다. `pointer-events: none`과 "입력이 오면 즉시 공개"로 바꿨습니다.
4. **짧은 글 이동 12px로 통일(R3).** P0-2(24px), P1-1 카드(16px), P1-3 독(24px), P1-7 끝 바(16px)가 사양 스스로의 R3를 넘었습니다. 기호형 요소(배지·칸·탭·메달)의 scale 예외는 R3에 명시했습니다.
5. **단서 미터의 역행 깜빡임 제거(P0-4).** 미터가 화면 밖일 때 미뤘다가 재생하면, 기다리는 동안 이미 켜져 그려진 칸이 재생 순간 꺼졌다가 다시 켜집니다. 진전이 순간 뒤로 간 것처럼 보이므로, 같은 마이크로태스크에서 정지 덮개(`m-wait`)를 씌우고 게임이 다시 그릴 때마다 다시 씌웁니다. 보이는지는 IO 기억값으로 판단합니다(강제 layout 없음).
6. **테마 전환(P1-4).** `stopImmediatePropagation()`은 넣는 순서에 따라 음악 모듈의 오디오 잠금 해제 리스너를 막을 수 있어 `stopPropagation()`으로 바꿨습니다. VT 중 입력은 `skipTransition()`으로 받습니다. 폰 프로필에서 VT 원은 424–445ms에 p95 33–50ms로 끊겨, 관문(V11-p)을 못 넘으면 터치 기기에서는 즉시 바꿈만 씁니다.
7. **긴 스크롤 즉시 이동(E2).** 폰 "새 장면 보기"는 정답 글 2–3화면을 거슬러 부드럽게 스크롤합니다. 화면 전체가 흐르는 것은 이 사양이 금지한 큰 면적 이동과 같으므로, 4.8의 권고를 공유 수정으로 올렸습니다.
8. **상태 줄 지연 삭제(P2-9).** 입력창 바로 아래 안내를 640ms 숨기는 것은 R5(숨김 0) 위반입니다. 경고 문구는 모션 없이 즉시 보입니다.
9. **clip-path 끝 상태(1.3).** `m-morph`, `m-paper`는 `backwards`로 바꿔 끝난 뒤 clip이 남지 않게 했습니다.
10. **제외 다섯 가지**(6절에도 적음): 포커스 링을 투명에서 시작하는 P2-2, 리빌에서 읽으려고 내린 진상 글을 늦게 보이는 P2-4 본문 페이드, 표지 제목 위를 떠다니는 먼지 입자 P2-5 ②, 스탯 옆에서 끝없이 맥박 치는 메달 후광 P2-5 ③, 같은 태스크에서 스피너로 바뀌어 아무도 못 보는 P2-7.

### 7.4 성능 목표: 측정에서 찾은 것과 고친 기준

- **측정 방법의 오류.** 감사의 `perf.js`는 rAF 루프로 프레임을 세는데, 이 루프가 메인 스레드에 프레임을 강제합니다. 그래서 "표지 301/301"은 가만히 있을 때가 아니라 프레임을 그리는 동안의 값입니다. P0-1 시제품(루프 없음)과 지금 페이지(루프 있음)를 맞댄 "154ms → 3.5ms"는 같은 조건이 아닙니다. 같은 조건에서는 가만히 있을 때 둘 다 거의 0이고, 프레임을 그리는 동안 폰에서 1.90 → 1.45 ms/프레임입니다(2.1.1).
- **진짜 큰 비용은 시계 막대(D3)입니다.** rAF 없이도 폰 프로필에서 플레이 대기 5초에 layout 302회, 작업 513ms를 씁니다(끄면 41ms). 40–80분 내내 메인 스레드의 약 10%이므로 S3를 가장 먼저 넣습니다.
- **기준이 느슨했던 곳.** 모든 비용 기준이 데스크톱 CPU 1배였고, V3는 rAF 없이 재면 지금의 결함 있는 페이지도 통과했습니다. 이렇게 고쳤습니다.
  - 폰 프로필(390×844, DPR 3, CPU 4배)을 정의하고 V2–V5, V12를 그 프로필에서 통과하게 했습니다.
  - V2: 콜백 2ms·init 16ms를 폰 프로필 기준으로 둬 데스크톱 환산 4배 엄격해졌습니다.
  - V3: "가만히"와 "프레임 생성 중"을 나눠 재고, 후자는 정지 바닥 대비 1.2 ms/프레임 이하로 둡니다.
  - V5: 작업 시간 상한(60ms/5초)을 더했습니다.
  - 새 기준: V3s(스크롤 중 정지), V11-p(폰 테마), V12(히어로 프레임: 33ms 넘는 프레임 증가 ≤ 1, p95 증가 ≤ 4ms), V13(`will-change` 표지 ≤ 4, 플레이 0).
  - 이 검토의 폰 측정값은 헤드리스 Chromium의 소프트웨어 래스터 기준입니다. 실기기 GPU에서는 대개 더 낫지만, 메인 스레드 수치는 그대로 참고할 만합니다.

### 7.5 남은 위험 (구현 때 확인)

- **P0-6 펼침의 폰 비용.** 지금 게임의 `unfold`로 잰 장 해금 1.4초에 33ms를 넘는 프레임이 3개, 최대 133ms였습니다. 대부분 게임 재렌더로 보이지만 clip-path 몫을 따로 재지 못했습니다. V12에서 갈라 보고, 넘으면 1,024px 미만에서 페이드로 바꿉니다.
- **P0-7 키보드 포커스.** 키보드로 "N장 장면으로"를 누르면 게임이 옮긴 포커스(`#ch-title`)가 최대 700ms 투명한 영역 안에 있습니다. 다음 키 입력에서 바로 공개되므로 받아들였지만, 실제 사용에서 불편하면 키보드 활성화(`click.detail === 0`)일 때 보류를 건너뛰는 안을 씁니다.
- **스위치의 발견성.** 「화면 움직임 줄이기」는 푸터에만 있습니다. 플레이 화면에는 상시 루프가 없어 2.2.2와는 무관하지만, 플레이 중 어지럼을 느끼는 사람은 메뉴로 돌아가야 끌 수 있습니다. 출시 뒤 피드백을 봅니다.
- **음악과의 경합.** 이 검토는 MUSIC.md 6.2–6.3 사양을 기준으로 했습니다. 구현된 `music.js`가 `.theme-btn` 클릭을 다른 방식으로 듣는다면 P1-4의 다시 보내기 경로를 다시 확인합니다.

### 7.6 [구현] 구현 기록 (2026-10-17)

이 절은 구현 뒤에 더했습니다. 위 사양 본문은 고치지 않았고, 사양과 다르게 한 곳은 7.6.4에 이유와 함께 모았습니다. **[2차]** 1차 구현 검토를 반영하며 본문을 고친 곳은 **[2차]** 표시와 7.7에 있습니다. 아래 7.6.3의 수치는 1차 구현 시점입니다.

#### 7.6.1 만든 것

| 파일 | 내용 |
|---|---|
| `web/public/motion.js` | 모듈 원본. 의존성 없음, `'use strict'` 즉시 실행 함수 하나. CSS를 `#sts-motion-css`에 한 번 넣고(필요할 때만 켜는 `#sts-motion-reduce`, `#sts-motion-swap` 두 시트 포함), DOM은 관찰만 합니다. 415줄, 39,133 B, gzip 13,908 B(zlib 9) |
| `index.html`(아티팩트) | `<!-- music:end -->` 바로 뒤 `<!-- motion:start --><script id="sts-motion">…</script><!-- motion:end -->`에 원본과 같은 바이트로 인라인. 608,726 → 647,563 B(+38,837 B) |
| `web/public/index.html` | `</body>` 앞, `<script src="/music.js" defer>` 다음 줄에 `<script src="/motion.js" defer></script>` |
| `web/tools/sync-modules.js` | `npm run sync`: music.js와 motion.js를 한 번에 표시 사이에 덮어씀(몇 번을 돌려도 같음). `npm run sync:check`는 바이트 동일만 확인(다르면 exit 1). 모듈 하나만은 `node tools/sync-modules.js motion` |
| `web/tools/sync-music.js` | `npm run music:sync`는 그대로 동작. 공통 구현을 쓰는 얇은 감싸개로 바꿨고, 음악 테스트(U12)가 쓰는 `extract(text)`도 그대로입니다 |
| `web/tools/measure-motion.js` | `npm run motion:measure`. 5절 V1–V16을 재고 목표를 못 넘으면 exit 1. 결과 `web/motion-out/report.json`, 영상 `web/motion-out/video/`, 프레임 띠 `web/motion-out/strips/` |
| `web/test/motion.js` | `npm run test:motion`(`npm test`에 포함). A 정적(사본 동일, 스크립트 태그, 두 화면의 공유 수정), B 아티팩트(불러오기·오류 0, 플레이 CLS 켬 = 끔, OS reduce에서 transform·clip 0, 스위치, 음악 버튼·테마·오디오 잠금 해제), C 웹(wrangler dev, /motion.js, 토스트 P2-1) |
| `web/package.json`, `web/.gitignore` | 스크립트 `sync`, `sync:check`, `test:motion`, `motion:measure`. `motion-out/`, `test/.out-motion/` 무시 |

**넣은 항목**: P0-1–P0-9, P1-1–P1-10, P2-1, P2-3, P2-4(마지막 인사만), P2-5 ①, P2-6, P2-8, P2-9, P2-10, 1.7.1 스위치, 1.8 멈춤(탭 숨김·화면 밖·스크롤 중·무입력 30초), 1.10 A1–A7.
**만들지 않은 항목(제외)**: P2-2, P2-4의 `.rv-section` 페이드, P2-5 ②③, P2-7.

**`window.STSMotion`**: `version`, `reduced()`, `off()`(관찰자 해제, 숨긴 것 공개, 넣은 요소 제거, html 클래스 제거), `state()`(켬·reduced·OS·스위치·멈춤·스크롤 중·무입력, 표지 `m-off`/`m-idle`, `m-pre`·`m-hold`·`m-wait`·`m-lit` 수, 장 넘김 보류 중인지, VT 횟수, init ms, 모듈별 콜백 최대 ms, 순간별 횟수(`answer`·`clue`·`meter`·`chapter`·`turn`·`hint`·`reveal`·`theme`), 모듈 오류). 콜백마다 `performance.measure('sts-motion:<모듈>')`, 초기화는 `sts-motion:init`.

#### 7.6.2 공유 수정 (두 화면에 똑같이)

두 화면의 diff는 줄 번호만 다르고 내용이 같습니다(`test/motion.js` A가 두 파일 모두에서 확인).

| ID | 바꾼 곳 | 바꾼 뒤 |
|---|---|---|
| S1 | `.pending .msg-out .bubble, .fresh .msg-out .bubble { animation: sendIn … }` | `.fresh` 쪽을 빼고 `.pending .msg-out .bubble`만 |
| S2 | `.hint-open { … animation: fadeUp .4s … }` | `animation` 선언 삭제 |
| S3 | `.clock-bar span { … transition: width 1s linear; }` | `transition` 선언 삭제 |
| S4 | `.problem.turn` `panelIn` .5s + 카드 지연 줄 + 이동·블러 키프레임 | `animation: panelIn .24s var(--ease-out) both;`, 지연 줄 삭제, `@keyframes panelIn { from { opacity: 0; } }` |
| S5 | `.world[open] .world-body`, `.host-body`의 `fadeUp .4s`, 디바이더 `.dv-body, .dv-next` 한 줄 | 앞의 둘은 `fadeIn .2s`. 디바이더는 `.dv-body { animation: fadeIn .24s .4s … }`와 `.dv-next { animation: fadeUp .5s .4s … }` 두 줄로 |
| E1 | `morphFromTyping(li)` 함수와 `renderLog()` 안의 호출 | 둘 다 삭제 |
| E2 | `turnPage(fromButton)`의 스크롤 | 거리(데스크톱 `#col-left.scrollTop`, 폰 `Math.abs(prob.getBoundingClientRect().top)`)가 `1.5 × innerHeight`를 넘으면 `behavior: 'auto'` |
| E3 | `const reduceMotion = () => …` | `… \|\| document.documentElement.classList.contains('m-reduce')` |

이 밖의 게임 HTML·CSS·JS는 바꾸지 않았습니다.

#### 7.6.3 측정 (`npm run motion:measure`, 2026-10-17)

- 환경: 헤드리스 Chromium 141(소프트웨어 래스터), Playwright 1.56. 아티팩트판을 `file://`로 열고 가짜 AI 진행자(답 0.7초)를 씁니다. 오늘의 추천을 `photo-studio`(4장, 단서 3·3·4·4, 세계관 있음)로 고정해 켬·끔을 같은 그릇으로 비교합니다.
- 프로필: 데스크톱 1440×900(어두움), 폰 390×844, DPR 3, 터치, CPU 4배 감속(밝음). 켬(`STS_MOTION='force'`)과 끔(`'off'`)을 번갈아 3번씩 돌려 중앙값을 씁니다. 실행 시간은 16.5분입니다.
- 결과: **76개 중 72개 통과.** 실패는 V9 크기 셋(7.6.4-1)과 폰 V2 콜백 최대 하나(아래)입니다. 원자료는 `web/motion-out/report.json`입니다.

| ID | 무엇 | 데스크톱 | 폰 | 목표 | 판정 |
|---|---|---|---|---|---|
| V1 | 플레이 중 CLS, 켬 − 끔 | 0.0119 − 0.0540 = −0.042 | 0.3612 − 0.3612 = 0.000 | 0.000 ± 0.0005 | 통과. 데스크톱은 장 해금 재렌더의 이동(0.054)이 `m-hold`(투명) 아래에서 일어나 오히려 줄었습니다. 20 ms 간격 이동 묶음은 켬·끔 모두 0 |
| V2 | 긴 작업(시나리오, 중앙값) | 켬 1 / 끔 2 | 켬 21 / 끔 21 | 끔과 같은 수 | 통과. 50 ms 넘는 몫의 합은 데스크톱 26 / 15 ms, 폰 1,404 / 1,241 ms. 모션 몫을 빼면 50 ms 아래로 내려가는 긴 작업 0 |
| V2 | `sts-motion:*` 콜백 최대 | 0.5 ms | 3.0 ms(`log`, 36번 중 1번. p50 0.8, p95 1.8) | ≤ 2 ms | **폰 실패.** 따로 잰 폰 `log` 콜백 16번은 모두 1.5 ms 이하라, 시나리오의 3.0 ms는 GC 등이 겹친 한 번으로 봅니다 |
| V2 | `sts-motion:init` | 7.4 ms | 11.3 ms | 데스크톱 ≤ 8 ms(4.2), 폰 ≤ 16 ms | 통과 |
| V3 ⓐ | 표지 가만히 5초(rAF 없음) | layout 0, style 0, 작업 6.9 ms | layout 0, style 0, 작업 10.5 ms | layout 0, style ≤ 2 | 통과. JS rAF 호출 0 |
| V3 ⓑ | 표지 프레임 생성 중 3초, 켬 − 정지 바닥 | 0.41 − 0.34 = 0.06 ms/프레임, layout 0 | 1.47 − 0.94 = 0.53 ms/프레임, layout 0 | ≤ 1.2 ms/프레임 | 통과. rAF 간격 p50 16.7, p95 16.7(폰 16.8) ms |
| V3s | 스크롤 중 정지 | 정지 100%, 멈춘 뒤 73 ms에 다시 돎, 작업 켬 − 끔 −0.29 ms/프레임 | 정지 100%, 212 ms, −2.15 ms/프레임 | 100%, ≤ 300 ms, ≤ 0.3 | 통과(폰은 손가락 드래그) |
| V4 | 화면 밖·탭 숨김·무입력 31초 | 모두 paused, 5초 layout 0. 31초 뒤 `m-idle`, 다음 pointerdown에 running | 화면 밖·숨김 모두 paused | 100% paused | 통과 |
| V5 | 플레이 대기 5초(rAF 없음) | layout 5, 작업 16.8 ms | layout 5, 작업 50.3 ms | layout ≤ 10, 작업 ≤ 60 ms | 통과. 무한 반복 애니메이션 0(시계 막대 S3로 302 → 5) |
| V6 | 읽기 글 위 애니메이션 | 29개, 동시 최대 5 | 22개, 동시 최대 2 | opacity만 ≤ 240 ms(X1·X2 예외) | 통과. 위반 0, 이미 보이던 글 다시 재생 0 |
| V7 | 힌트 2를 여는 동안 힌트 1 상자 | 50 ms 간격 10장이 바이트 동일 | — | 같음 | 통과 |
| V8 | OS reduce / 페이지 안 스위치 | 둘 다 애니메이션 13개 모두 WAAPI opacity 160 ms, 네 곳(답·힌트·디바이더·리빌 카드) | — | transform·clip 0, 무한 0 | 통과. VT 0, `m-pre`·`m-hold`·`m-wait`·`m-lit` 0, 스위치 경로에서 장 해금 스크롤 즉시(E3) |
| V9 | 크기 | 39,133 B, CSS 13,559 B, gzip 13,908 B(zlib 9) | | 22,528 / 10,240 / 7,168 B | **실패**(7.6.4-1). 아티팩트 사본은 바이트 동일 |
| V10 | 기존 검증 | `npm test`(engine, e2e 47, budget 4, music 194, motion 45) 통과, `smoke.js` SMOKE: ALL PASS, 콘솔 오류 0 | | | 통과 |
| V11 | 테마 전환 | 보이는 원 368–387 ms(클릭부터 스냅숏 포함 442–463 ms), 따로 도는 색 전환 0, VT 중 pointerdown → 11 ms에 끝 | — | ≤ 400 ms | 통과 |
| V11-p | 폰 테마 | — | 같은 프로필을 마우스 포인터로 잰 VT 423–444 ms, 33 ms 넘는 프레임 최대 3 → 관문 못 넘음 → 터치 기기는 `m-swap`만(전환 0, 색 따로 전환 0) | ≤ 450 ms, ≤ 2개, 못 넘으면 coarse는 즉시 | 통과(사양 규칙대로 관문 적용) |
| V12 | 히어로 프레임(폰, 켬/끔 3회, 창마다 1.4초) | — | 진입 33 ms 넘는 프레임 2.67/2.33·p95 33.3/33.3, 답 0/0·16.8/16.7, 단서 0/0·16.8/16.8, 장 해금 2.5/2.67·16.8/16.8, 힌트 0.5/0.5·16.8/16.8, 리빌 3/3.17·33.3/33.4 | 증가 ≤ 1, p95 증가 ≤ 4 ms | 통과. 장 해금이 넘었으므로 P0-6의 폰 대체(페이드)는 쓰지 않고 펼침을 그대로 둡니다(7.5 첫 위험 해소) |
| V13 | `will-change` 요소 | 표지 4, 플레이 0 | 표지 4, 플레이 0 | 표지 ≤ 4, 플레이 0 | 통과 |
| V14 | 스위치 | Tab → Space로 켬, `aria-pressed`, `m-reduce`, 무한 애니메이션 0, 저장·새로 고침 유지, 저장소가 막혀도 동작, OS reduce면 `aria-disabled` | — | 모두 | 통과 |
| V15 | 보이지 않는 것은 눌리지 않음 | 메뉴 리빌 숨김 중 아래 8% 띠의 오늘의 추천 카드를 눌러도 열리지 않고 공개됨. 장 넘김 보류 중 힌트 버튼 자리를 눌러도 힌트 0, 보류 풀림 | — | | 통과 |
| V16 | 접근성 불변 | `hidden`·`inert`·`aria-*`·`role`·`tabindex`·글자 변경과 포커스 이동 0(스위치 자신 제외), 넣은 장식(`.m-steam`, `.m-dots`)은 모두 `aria-hidden` | — | 0 | 통과 |

- **스타일 비용**: 전체 스타일 재계산 + layout 한 번(폰 프로필)은 켬 10.7 ms / 끔 11.2 ms(플레이), 15.0 / 19.9 ms(메뉴)로 차이가 잡음 범위입니다(7.6.4-11).
- **영상과 프레임 띠**: `web/motion-out/video/desk-dark.webm`, `phone-light.webm`(순간마다 왼쪽 위 16 px 색 표시, `*.marks.json`에 영상 시각). 띠는 `web/motion-out/strips/`에 ffmpeg fps=8 타일로 29장입니다. 데스크톱 FS01 표지, FS02 메뉴 스크롤, FS04 진입·메뉴 복귀, FS05 질문, FS06 단서·미룬 미터, FS07 힌트 2, FS08 세계관, FS09 장 해금, FS11 장 탭, FS12 테마(메뉴·플레이), FS13 확인창, FS14 리빌·다시 보기, FS15 끝 바, FS20 마지막 인사. 폰 FS01, FS02, FS04, FS05, FS06(답·미터), FS07, FS09, FS10 새 장면 보기, FS14, FS15.

#### 7.6.4 사양과 다르게 한 것 (이유)

1. **크기 예산(4.5, V9)을 넘습니다.** `motion.js` 39,133 B(예산 22,528), 원본 안 CSS 13,559 B(예산 10,240), gzip 13,908 B(예산 7,168). 사양이 그대로 넣으라고 한 CSS 블록에 `.m-on`을 붙이기만 해도 약 13 KB이고, [검토]로 더해진 기능(스위치, 스크롤 중·무입력 정지, 미리 덮기, 입력 리스너, 접근성 조건)이 JS를 키웠습니다. 식별자까지 줄이는 압축기(esbuild minify)를 돌려도 28.7 KB / gzip 10.0 KB라 예산 안에 들어가지 않습니다. P2를 모두 빼도(약 3 KB) 마찬가지라 4.7-5의 "예산을 넘으면 P2를 넣지 않는다"를 적용해도 V9는 넘습니다. 그래서 검토가 승인한 P2는 넣고, 사람이 고칠 수 있는 원본(주석 포함)을 유지했습니다. 실제 비용 목표(init 폰 ≤ 16 ms, 콜백 ≤ 2 ms, V3 ≤ 1.2 ms/프레임, CLS 0)는 아래 측정처럼 넘습니다. **권고: 4.5 예산을 원본 40 KB, CSS 15 KB, gzip 14 KB로 고칩니다.** 아티팩트는 +38.8 KB(6.4%)입니다.
2. **인라인 표시 이름은 `<!-- motion:start -->`/`<!-- motion:end -->`입니다.** 4.1은 "음악 쪽 표시가 `sts-music:begin/end`이므로 그 짝에 맞춘다"고 했는데, 실제 음악 표시는 `<!-- music:start -->`/`<!-- music:end -->`입니다. 같은 이유(음악 짝에 맞춤)로 `motion:start/end`를 썼습니다. 원래 `sync-music.js`도 `<!-- motion:start -->`를 넣는 자리의 기준으로 이미 알고 있었습니다.
3. **동기화 도구는 `tools/sync-motion.js`가 아니라 `tools/sync-modules.js` 하나입니다.** 주문이 "한 명령으로 둘 다"였기 때문입니다. `sync-music.js`(music:sync)는 이것을 쓰는 감싸개로 남았습니다.
4. **`m-long`(P1-8)은 `li.pending`이 아니라 `#convo`에 붙입니다.** 10초 뒤에 `#log` 안의 클래스를 바꾸면 4.2·4.6의 "`#log` 안은 같은 마이크로태스크에 붙이기만" 규칙을 어기고 음악의 250 ms 판정을 다시 깨웁니다. CSS는 `#convo.m-long .pending .typing i`이고, 대기 말풍선이 사라지면 지웁니다.
5. **`m-quiet`(P0-6)는 1,500 ms 뒤가 아니라 그 디바이더가 다시 그려질 때 지웁니다.** `animation: none`이던 요소에서 클래스를 지우면 CSS 애니메이션이 그 순간 새로 시작해, 1.5초 뒤 리빌 뒤(스크림 블러 너머)에서 디바이더가 펼쳐집니다. "모두 생략"을 지키려면 그 노드가 남아 있는 동안 계속 붙여 둬야 합니다.
6. **목표 숫자 굴림(P0-4 ②)은 `#goal.m-up .roll b`가 아니라 커진 순간의 `b`에 붙인 `m-r`로 겁니다.** `renderComposer()`가 1.2초 안에 다시 불리면(탭 전환 등) 새 `b`에서 굴림이 다시 재생돼 R1을 어깁니다. 육각 채움·링(`#goal.m-up::before/::after`)은 사양 그대로입니다.
7. **왼쪽 미터(P0-4 ③)는 "켜진 칸 중 seen번째부터"가 아니라 "새로 켜진 칸"을 고릅니다.** 장 키마다 칸별 켜짐 배열을 기억해 비교합니다. 단서는 칸 순서대로 찾지 않으므로, 개수 순서로 고르면 방금 찾은 칸이 아닌 다른 칸이 차오릅니다(게임의 `.pop`도 같은 문제가 있습니다). 미리 덮기(`m-wait`)와 IO 기억값(threshold 0.5)은 사양 그대로입니다.
8. **메뉴 리빌(P1-1)의 ⑤ "처음부터 화면 밖" 판정은 `getBoundingClientRect().top > innerHeight` 대신 IntersectionObserver의 첫 보고에서 "교차하지 않고 `boundingClientRect.top > 0`"으로 합니다.** 첫 렌더(스크롤 0)에서는 같은 판정이고, layout을 강제하지 않습니다. `getBoundingClientRect()`·`innerHeight`를 쓰면 모바일 뷰포트에서 layout이 강제돼 이 콜백이 폰 프로필에서 141–221 ms가 됐고, `rootBounds`는 교차 출처 iframe(claude.ai 아티팩트)에서 `null`입니다. 첫 보고는 첫 프레임 뒤에 오지만 숨기는 것은 화면 밖 요소뿐이라 보였다가 사라지는 프레임이 없습니다.
9. **표지 첫 인사(P1-9)의 `scrollY < 10`은 "새로 연 페이지(`navigation.type === 'navigate'`)이고 해시 없음"으로 바꿨습니다.** init 안에서 `scrollY`를 읽으면 페이지의 첫 layout을 강제해 데스크톱 init이 13 ms가 됐습니다. 새로 연 페이지는 복원 스크롤이 없으므로 같은 조건입니다. `sessionStorage` 쓰기는 다음 태스크로 미뤘습니다.
10. **스크롤 중 정지(1.8)는 `scrollend` 뒤 120 ms 여유를 둡니다.** 스무스 스크롤이 없는 휠(헤드리스, 일부 리눅스 마우스)은 노치마다 `scroll` → `scrollend`가 한 프레임에 와서 노치 사이마다 앰비언트가 다시 돕니다. 120 ms 여유로 스크롤하는 동안 100% 멈추고, 멈춘 뒤 300 ms 안에 다시 돕니다(V3s).
11. **오른쪽 끝이 `*`인 규칙을 상시 시트에서 뺐습니다.** `html.m-reduce *`(1.7.1)와 `.m-swap *`(P1-4), VT 의사 요소 규칙은 각각 `#sts-motion-reduce`, `#sts-motion-swap` 시트에 두고 `disabled`로 켜고 끕니다. `#convo.m-quiet .fresh *`는 애니메이션이 걸리는 요소 목록으로 풀었고, 오른쪽 끝의 `:is()`와 `:not()`도 풀었습니다. 그대로 두면 모든 요소가 스타일 재계산마다 이 규칙에 맞춰지므로, 폰 프로필의 전체 재계산이 메뉴 12.3 → 17.6 ms(+43%), 플레이 9.2 → 12.0 ms로 늘었습니다. 고친 뒤에는 켬과 끔이 같습니다(메뉴 15.0 / 19.9 ms, 플레이 10.7 / 11.2 ms, 잡음 범위). 효과는 사양과 같습니다.
12. **E1 방어(`.reply-bubble`의 width·height WAAPI 취소)는 관찰자 콜백이 아니라 다음 rAF에서 합니다.** `getAnimations()`는 문서 전체의 스타일을 강제합니다. rAF도 첫 페인트 전이라 잔상은 없고, 그 프레임이 어차피 할 재계산이라 일이 늘지 않습니다.
13. **P1-4의 폰 관문(V11-p)을 넘지 못해, 터치 기기(`(pointer: coarse)`)에서는 View Transition 없이 `m-swap` 즉시 바꿈만 씁니다(사양이 정한 대로).** 같은 폰 프로필을 마우스 포인터로 잰 VT는 총 423–444 ms, 33 ms 넘는 프레임이 전환마다 1–3개였습니다. 관문(총 ≤ 450 ms, 33 ms 넘는 프레임 ≤ 2개)의 경계라 실행에 따라 넘거나(앞선 실행 412–445 ms, 1개) 못 넘어서(451–470 ms, 4개) 사양의 규칙대로 관문을 적용했습니다. 데스크톱과 마우스를 쓰는 태블릿은 램프 원 전환을 씁니다.
14. **P2-9의 기준 시간 초과 색 전환은 JS 없이 `.clock.over .clock-time { transition: color 600ms }`로 했습니다.** 전환은 값이 바뀔 때만 일어나므로 "처음 붙을 때 한 번"과 같고, 1초마다 바뀌는 `#clock`의 class를 관찰하지 않아도 됩니다.
15. **「화면 움직임 줄이기」 스위치에 눌림 상태가 보이는 작은 네모(`::before`)를 더했습니다.** `.text-btn` 글자는 그대로이고 상태는 `aria-pressed`로 전합니다. 다만 글자만 있는 토글은 보는 사람이 켜졌는지 알 수 없어(음악 버튼은 아이콘이 바뀜) 테두리 네모 → 채운 네모로 표시합니다.
16. **폰 "새 장면 보기"(P0-7 ⓑ)는 보류한 `#problem`에만 `m-turn-in`을 붙입니다.** 4번 "`#problem`, `#world`, `.toolbox`에 `m-turn-in`"을 폰에 그대로 하면, 보이던 `#world`가 투명에서 다시 들어와 R1을 어깁니다.
17. **P2-4 마지막 인사는 "정답 다시 보기"(`m-again`)에서는 하지 않습니다.** P1-6이 다시 열 때는 의식을 반복하지 않게 짧게 열기 때문입니다.
18. **`sts:moment`의 `clue`는 미터가 재생될 때가 아니라 핵심 단서를 찾은 답이 도착할 때 보냅니다.** 데스크톱에서는 미터가 대개 화면 밖이라 재생이 미뤄지는데, 효과음은 찾은 순간에 맞아야 합니다. 미터 재생은 `state().n.meter`로 셉니다.
19. **새 클래스 이름**(4.3 목록 밖): `m-xfade`(P2-6), `m-r`(위 6), `m-dots`(P2-4 타이핑 점 말풍선, `aria-hidden`). 모두 `m-` 접두사입니다.
20. **측정 방법에서 정한 것**: 폰 프로필은 아티팩트에 `<meta name="viewport" content="width=device-width, initial-scale=1">`를 넣고 잽니다. 아티팩트는 claude.ai의 iframe(기기 폭) 안에서 돌아 viewport meta가 없는데, 맨 위 문서로 모바일을 흉내 내면 980 px로 배치되고 0.4배로 줄어 폰을 재는 것이 아니게 되기 때문입니다(웹판은 meta가 있습니다). V6 표본기와 V7 스크린숏은 켬/끔 비교 실행(V1·V2·V12)과 따로 한 번 돌립니다. 표본기의 `getAnimations()`는 애니메이션이 많을수록 비싸 켬 쪽만 느리게 만들기 때문입니다. 그리고 V6의 X1에 기존 스크림 `.reveal` fadeIn(320 ms, P1-6 "유지")을 넣었고, 의사 요소(장식선·플레어·링·VT 스냅숏) 애니메이션은 글을 움직이지 않으므로 V6 대상에서 뺐습니다. 이미 보이던 글의 재생 여부는 "LONG 종류 + 글 해시"가 바로 앞 표본에서 화면 안에 보였는지(`checkVisibility({ opacityProperty: true })` + 뷰포트 안)로 봅니다. 같은 정답 글이 디바이더·왼쪽 정답·리빌에 함께 있고, 닫힌 `<details>`, `m-hold`, 화면 밖으로 스크롤된 글은 본 것으로 세지 않습니다. V11의 400 ms는 보이는 원(VT `ready` → 마지막 프레임)으로 재고, 클릭부터 스냅숏 준비까지 포함한 값도 함께 적습니다. 헤드리스 소프트웨어 래스터에서는 스냅숏 준비만 60–100 ms가 걸립니다. V12의 p95는 한 창이 아니라 같은 순간의 모든 창 간격을 모아 셉니다(4배 감속에서 프레임이 16.7 ms 단위라 창 하나의 p95는 한 프레임 차이로 16 ms씩 출렁임).

#### 7.6.5 남은 일

1차 구현 시점의 목록입니다. 2차에서 처리한 것은 7.7.5에 적었습니다.

- **V9 예산 고치기**(위 1): 원본 40 KB / CSS 15 KB / gzip 14 KB를 권합니다. 줄이려면 P2-4(약 1.4 KB)부터 뺍니다.
- **실기기 확인**: 측정은 헤드리스 Chromium(소프트웨어 래스터)입니다. 유리 바(`backdrop-filter`) 위아래의 진입 모션(P1-3)과 테마 원(P1-4)은 실제 중급 안드로이드와 iPhone Safari에서 한 번 보는 것이 좋습니다. Safari는 View Transition이 18.0부터라 그 아래는 `m-swap` 즉시 바꿈입니다.
- **터치 기기의 테마 원**: V11-p는 헤드리스 소프트웨어 래스터에서 관문 경계(423–470 ms)였습니다. 실기기에서 다시 재서 넘으면 `motion.js`의 `coarse` 조건 하나만 지우면 됩니다.
- **폰 콜백 최대(V2)**: 시나리오에서 `log` 콜백 한 번이 3.0 ms였습니다(p95 1.8 ms, 따로 잴 때 최대 1.5 ms). 다시 넘으면 장 해금 경로(`hold`)의 리스너·타이머 등록을 줄이는 것부터 봅니다.
- **측정 도구의 종료 코드**: V9 예산을 고치기 전까지 `npm run motion:measure`는 V9 때문에 exit 1입니다. 다른 목표만 보려면 출력의 `FAIL` 줄을 봅니다.
- **7.5의 남은 위험**: P0-7 키보드 포커스(보류 중 최대 700 ms)는 그대로입니다. 스위치의 발견성도 그대로입니다.
