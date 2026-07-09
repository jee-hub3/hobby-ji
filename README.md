# Claude Usage Widget

A small always-on-top desktop widget that shows your **Claude session (5h) and
weekly (7d) usage**, with a live countdown to each reset — so you always know
how much you have left before you hit a limit.

> **Unofficial, community-made tool.** Not affiliated with or endorsed by
> Anthropic. Uses the same OAuth token your local Claude Code CLI already has
> — no separate login, no data leaves your machine except the one official
> API call described in [PRIVACY.md](PRIVACY.md).

```
┌──────────────────────────────┐
│ ● Claude          14:32 갱신 │
│ 세션   ▓▓▓▓▓▓▓░░░  68%       │
│        2시간 14분 후 초기화   │
│ 주간   ▓▓▓▓░░░░░░  41%       │
│        금요일 오전 9:00 초기화│
└──────────────────────────────┘
```

## Features

- Session (5h) and weekly (7d) usage bars with reset countdowns
- Frameless, always-on-top, draggable — position is remembered
- Auto-refresh (default 90s), keeps showing last known data if a refresh fails
- 6 gradient presets + custom color picker, **independently for the session
  and weekly bars**
- 3 layouts (horizontal / vertical / compact), 3 sizes (S/M/L), adjustable
  opacity and dark/light background
- Tray icon (show/hide widget, open settings, quit), start-at-login option
- Threshold warnings (default 80% / 95%) as Windows notifications

## Install

1. Download the latest installer from [Releases](../../releases) —
   `Claude-Usage-Widget-Setup-*.exe` (installer) or the `*-portable.exe`
   (no install, just run it)
2. Windows SmartScreen will warn you because the exe isn't code-signed (this
   is a small open-source project, not malware) — click **More info → Run
   anyway**. You can verify what the code does by reading this repo.
3. You need **Claude Code CLI installed and logged in** on the same machine
   (`npm install -g @anthropic-ai/claude-code` then `claude login`) — the
   widget reads its existing session, it does not log in on its own.

## Usage

Right-click the widget (or the tray icon) to open **Settings**, or to hide
the widget / quit the app. All settings apply immediately — no save button.

## Run from source

```bash
git clone https://github.com/jee-hub3/hobby-ji.git
cd hobby-ji
npm install
npm start
```

Build installers yourself:

```bash
npm run build   # outputs dist/*.exe (NSIS installer + portable)
```

## How it works / security

See [docs/02-아키텍처.md](docs/02-아키텍처.md) for the full design, and
[PRIVACY.md](PRIVACY.md) for exactly what data is read and where it goes. In
short:

- Only [src/main/credentials.js](src/main/credentials.js) reads your token, only
  [src/main/api.js](src/main/api.js) makes network calls, and the only host contacted is
  `api.anthropic.com`.
- The token never reaches the renderer (UI) process — `contextIsolation` is
  on and `nodeIntegration` is off.
- This uses an **unofficial, undocumented API** (`/api/oauth/usage`) that
  Anthropic could change at any time without notice. If the widget stops
  working, that's likely why — check [docs/api-응답구조.md](docs/api-응답구조.md) and open an
  issue.

## License

[MIT](LICENSE)

---

# Claude Usage Widget (한국어)

Claude **세션(5시간)·주간(7일) 사용량**을 항상 화면 위에 띄워두는 작은 위젯입니다.
각 한도의 초기화까지 남은 시간을 실시간으로 보여줘서, 얼마나 더 쓸 수 있는지
한눈에 알 수 있습니다.

> **Anthropic과 무관한 커뮤니티 비공식 도구입니다.** 별도 로그인 없이, 이미
> PC에 설치된 Claude Code CLI의 OAuth 토큰을 그대로 사용합니다. 데이터가
> 어디로 가는지는 [PRIVACY.md](PRIVACY.md)에 전부 명시되어 있습니다 (공식 API 한 곳
> 외에는 아무 데도 가지 않습니다).

## 주요 기능

- 세션(5h)/주간(7d) 사용률 바 + 초기화 카운트다운
- 프레임리스·항상 위·드래그 이동 (위치 기억)
- 자동 갱신(기본 90초), 실패 시 마지막 데이터 유지
- 그라데이션 프리셋 6종 + 커스텀 색상 — **세션/주간 막대 색을 따로** 지정 가능
- 레이아웃 3종(가로/세로/컴팩트) × 크기 3종(S/M/L), 투명도·배경(다크/라이트) 조절
- 트레이 아이콘(숨기기/보이기, 설정, 종료), 부팅 시 자동 시작
- 임계값(기본 80%/95%) 도달 시 Windows 알림

## 설치

1. [Releases](../../releases)에서 최신 버전 다운로드 —
   `Claude-Usage-Widget-Setup-*.exe`(설치형) 또는 `*-portable.exe`(설치 없이 실행)
2. 코드 서명이 없어 Windows SmartScreen 경고가 뜹니다 — **추가 정보 → 실행**을
   눌러주세요 (개인 오픈소스 프로젝트의 흔한 한계입니다. 이 저장소에서 소스를
   직접 확인하실 수 있습니다).
3. 같은 PC에 **Claude Code CLI가 설치되어 로그인된 상태**여야 합니다
   (`npm install -g @anthropic-ai/claude-code` 후 `claude login`). 위젯은
   기존 로그인 세션을 읽기만 할 뿐, 자체 로그인 기능은 없습니다.

## 사용법

위젯(또는 트레이 아이콘)을 우클릭하면 **설정**을 열거나, 위젯을 숨기거나,
종료할 수 있습니다. 모든 설정은 저장 버튼 없이 즉시 반영됩니다.

## 소스로 직접 실행

```bash
git clone https://github.com/jee-hub3/hobby-ji.git
cd hobby-ji
npm install
npm start
```

직접 빌드:

```bash
npm run build   # dist/*.exe 생성 (NSIS 설치본 + portable)
```

## 동작 원리 / 보안

전체 설계는 [docs/02-아키텍처.md](docs/02-아키텍처.md), 어떤 데이터가 어디로 가는지는
[PRIVACY.md](PRIVACY.md)에 정리되어 있습니다. 요약하면:

- 토큰은 [src/main/credentials.js](src/main/credentials.js)에서만 읽고, 네트워크 호출은
  [src/main/api.js](src/main/api.js) 한 곳에서만 하며, 통신 대상은 `api.anthropic.com`
  뿐입니다.
- `contextIsolation` 활성화 + `nodeIntegration` 비활성화로, 화면을 그리는
  렌더러 프로세스는 토큰에 접근할 수 없습니다.
- **비공식·비문서화 API**(`/api/oauth/usage`)를 사용하므로 Anthropic이 예고
  없이 응답 구조를 바꿀 수 있습니다. 위젯이 갑자기 안 되면 이 때문일 가능성이
  높습니다 — [docs/api-응답구조.md](docs/api-응답구조.md)를 확인하고 이슈를 남겨주세요.

## 라이선스

[MIT](LICENSE)
