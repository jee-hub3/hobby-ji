# Privacy / 개인정보 처리 방침

## English

**What this app reads**: your existing Claude Code OAuth access token, from
`%USERPROFILE%\.claude\.credentials.json` (or `$CLAUDE_CONFIG_DIR\.credentials.json`
if that environment variable is set). This app does not perform its own login —
it reuses the session already created by the Claude Code CLI on your machine.

**Where the token goes**: nowhere except `api.anthropic.com`. The token is read
in the Electron main process ([src/main/credentials.js](src/main/credentials.js)) and used only to
call `GET https://api.anthropic.com/api/oauth/usage` ([src/main/api.js](src/main/api.js)). It is
never written to disk, never logged, and never sent to the renderer process
(the UI). `contextIsolation` is enabled and `nodeIntegration` is disabled, so
the widget window's web page has no access to Node APIs or the token.

**Network**: the app talks to exactly one host, `api.anthropic.com`. There is
no analytics, telemetry, crash reporting, or third-party network call of any
kind. You can verify this by reading [src/main/api.js](src/main/api.js) — it is the only file
that performs network requests.

**What's stored locally**: your customization settings (theme, layout,
polling interval, thresholds, window position) are saved as plain JSON via
`electron-store`, under `%APPDATA%\claude-usage-widget\config.json`. No usage
data or credentials are stored there.

**Auto-update of the token**: if the API returns `401 Unauthorized` (expired
token), the app runs `claude update` in the background — the same command you
would run yourself — to let the Claude Code CLI refresh its own token file. If
that fails, the widget shows a "please log in again" message; it never
attempts to log you in itself.

## 한국어

**이 앱이 읽는 것**: 이미 설치된 Claude Code CLI의 OAuth 액세스 토큰
(`%USERPROFILE%\.claude\.credentials.json`, `CLAUDE_CONFIG_DIR` 환경변수가
있으면 그 경로)입니다. 이 앱은 자체 로그인 기능이 없고, PC에 이미 있는
Claude Code 로그인 세션을 그대로 재사용합니다.

**토큰이 가는 곳**: `api.anthropic.com` 외에는 어디로도 가지 않습니다. 토큰은
Electron main 프로세스([src/main/credentials.js](src/main/credentials.js))에서만 읽혀 `GET
https://api.anthropic.com/api/oauth/usage` 호출([src/main/api.js](src/main/api.js))에만 쓰입니다.
디스크에 별도로 저장하거나 로그를 남기지 않으며, 화면을 그리는 렌더러
프로세스로도 절대 전달되지 않습니다. `contextIsolation`을 켜고
`nodeIntegration`을 꺼서, 위젯 창의 웹페이지는 Node API나 토큰에 접근할 수
없습니다.

**네트워크**: 이 앱은 정확히 `api.anthropic.com` 한 곳하고만 통신합니다.
분석/원격측정/크래시 리포트 등 어떤 형태의 제3자 네트워크 호출도 없습니다.
[src/main/api.js](src/main/api.js) 파일이 네트워크 요청을 수행하는 유일한 파일이므로 직접
확인하실 수 있습니다.

**로컬에 저장되는 것**: 테마·레이아웃·폴링 주기·임계값·창 위치 같은 커스터마이징
설정만 `electron-store`를 통해 평범한 JSON으로 `%APPDATA%\claude-usage-widget\config.json`에
저장됩니다. 사용량 데이터나 인증정보는 여기 저장되지 않습니다.

**토큰 자동 갱신**: API가 `401 Unauthorized`(토큰 만료)를 반환하면, 사용자가
직접 실행하는 것과 동일한 `claude update` 명령을 백그라운드에서 실행해 Claude
Code CLI 스스로 토큰 파일을 갱신하도록 합니다. 실패하면 "다시 로그인하세요"
메시지만 보여줄 뿐, 앱이 대신 로그인을 시도하지 않습니다.
