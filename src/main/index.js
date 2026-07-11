const { app, ipcMain, Menu, Notification, shell, dialog } = require("electron");
const { createWidgetWindow, createSettingsWindow, resizeWidget, recenterWidget } = require("./windows");
const { createTray } = require("./tray");
const Poller = require("./poller");
const settings = require("./settings");

let widgetWin;
let settingsWin = null;
let tray;
let poller;

// 자동시작은 "설치본"에서만 의미가 있다. portable exe는 매 실행마다 임시폴더에
// 압축 해제되므로(execPath가 계속 바뀜) 로그인 항목을 등록하면 다음 부팅 때 깨진다.
// dev(electron .)도 자동시작 대상이 아니다.
function canAutoStart() {
  return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE;
}

function applyAutoStart(enable) {
  if (canAutoStart()) {
    app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath });
  } else {
    // portable/dev: 임시 경로를 등록하지 않고, 남아있을 수 있는 항목은 해제
    app.setLoginItemSettings({ openAtLogin: false });
  }
}

const notifyLevel = { session: "normal", weekly: "normal" };
const LEVEL_RANK = { normal: 0, warn: 1, danger: 2 };

function levelFor(percent, warnAt, dangerAt) {
  if (percent >= dangerAt) return "danger";
  if (percent >= warnAt) return "warn";
  return "normal";
}

function maybeNotify(kind, label, block) {
  if (!block) return;
  const behavior = settings.getAll().behavior;
  const level = levelFor(block.utilizationPercent, behavior.warnAt, behavior.dangerAt);
  const prev = notifyLevel[kind];

  if (level !== prev) {
    if (behavior.notifications && LEVEL_RANK[level] > LEVEL_RANK[prev] && level !== "normal") {
      new Notification({
        title: `${label} 사용량 ${level === "danger" ? "위험" : "경고"}`,
        body: `${block.utilizationPercent}% 사용 중`,
      }).show();
    }
    notifyLevel[kind] = level;
  }
}

function broadcastSettings(updated) {
  for (const win of [widgetWin, settingsWin]) {
    if (win && !win.isDestroyed()) win.webContents.send("settings:update", updated);
  }
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = createSettingsWindow();
  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}

function toggleWidgetVisibility() {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  if (widgetWin.isVisible()) widgetWin.hide();
  else widgetWin.show();
}

function recenterAndShow() {
  recenterWidget(widgetWin);
}

// 단일 인스턴스 잠금 — 중복 실행 방지. 이미 켜져 있으면 두 번째 실행은
// 기존 위젯을 화면 중앙으로 소환하고 종료한다("안 보임" 시 재실행으로 복구).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}
app.on("second-instance", () => recenterAndShow());

if (gotSingleInstanceLock)
app.whenReady().then(() => {
  widgetWin = createWidgetWindow();

  let initialSettings = settings.getAll();

  // 첫 실행(설치본에서만) — 자동 시작 여부를 한 번 물어본다.
  if (canAutoStart() && !initialSettings.autoStartPrompted) {
    const res = dialog.showMessageBoxSync({
      type: "question",
      buttons: ["예, 자동 시작", "아니요"],
      defaultId: 0,
      cancelId: 1,
      title: "Claude Usage Widget",
      message: "Windows 시작 시 위젯을 자동으로 실행할까요?",
      detail: "항상 화면에 사용량을 띄워두려면 자동 시작을 권장합니다.\n나중에 설정 > 동작에서 바꿀 수 있어요.",
    });
    settings.update({ behavior: { autoStart: res === 0 }, autoStartPrompted: true });
    initialSettings = settings.getAll();
  }

  applyAutoStart(initialSettings.behavior.autoStart);

  poller = new Poller(initialSettings.behavior.pollIntervalSec * 1000);
  poller.on("update", (payload) => {
    if (payload.data) {
      maybeNotify("session", "세션", payload.data.session);
      maybeNotify("weekly", "주간", payload.data.weekly);
    }
    if (widgetWin && !widgetWin.isDestroyed()) widgetWin.webContents.send("usage:update", payload);
  });

  widgetWin.webContents.once("did-finish-load", () => poller.start());

  tray = createTray({
    isWidgetVisible: () => widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible(),
    onToggleWidget: toggleWidgetVisibility,
    onRecenter: recenterAndShow,
    onOpenSettings: openSettingsWindow,
    onQuit: () => app.quit(),
  });
});

ipcMain.on("widget:context-menu", () => {
  const visible = widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible();
  const menu = Menu.buildFromTemplate([
    { label: "설정...", click: openSettingsWindow },
    { label: visible ? "위젯 숨기기" : "위젯 보이기", click: toggleWidgetVisibility },
    { label: "위젯 위치 초기화", click: recenterAndShow },
    { type: "separator" },
    { label: "종료", click: () => app.quit() },
  ]);
  menu.popup({ window: widgetWin });
});

ipcMain.on("widget:resize", (_event, size) => {
  if (size && typeof size.width === "number" && typeof size.height === "number") {
    resizeWidget(widgetWin, size.width, size.height);
  }
});

// 온보딩 버튼 동작 — 렌더러는 액션 id만 보내고, URL은 여기서 고정(허용 목록)한다.
const HELP_URL = "https://github.com/jee-hub3/hobby-ji#install";
ipcMain.on("onboarding:action", (_event, id) => {
  if (id === "help") {
    shell.openExternal(HELP_URL);
  } else if (id === "retry" && poller) {
    poller.tick();
  }
});

ipcMain.handle("settings:get", () => settings.getAll());

ipcMain.handle("app:info", () => ({ canAutoStart: canAutoStart() }));

ipcMain.on("settings:set", (_event, partial) => {
  const prev = settings.getAll();
  const updated = settings.update(partial);

  if (partial.behavior) {
    if (
      typeof partial.behavior.pollIntervalSec === "number" &&
      partial.behavior.pollIntervalSec !== prev.behavior.pollIntervalSec
    ) {
      poller.setIntervalMs(updated.behavior.pollIntervalSec * 1000);
    }
    if (
      typeof partial.behavior.alwaysOnTop === "boolean" &&
      widgetWin &&
      !widgetWin.isDestroyed()
    ) {
      widgetWin.setAlwaysOnTop(updated.behavior.alwaysOnTop);
    }
    if (typeof partial.behavior.autoStart === "boolean") {
      applyAutoStart(updated.behavior.autoStart);
    }
  }

  // 레이아웃 변경 시 창 크기는 렌더러가 재측정해 widget:resize로 보고한다.

  broadcastSettings(updated);
});

app.on("window-all-closed", () => {
  // 트레이 상주 앱이므로 창을 모두 닫아도 종료하지 않음 (트레이 메뉴로만 종료)
});

app.on("before-quit", () => {
  if (poller) poller.stop();
  if (tray) tray.destroy();
});
