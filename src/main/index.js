const { app, ipcMain, Menu, Notification } = require("electron");
const { createWidgetWindow, createSettingsWindow, resizeWidget } = require("./windows");
const { createTray } = require("./tray");
const Poller = require("./poller");
const settings = require("./settings");

let widgetWin;
let settingsWin = null;
let tray;
let poller;

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

app.whenReady().then(() => {
  widgetWin = createWidgetWindow();

  const initialSettings = settings.getAll();
  app.setLoginItemSettings({ openAtLogin: initialSettings.behavior.autoStart });

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
    onOpenSettings: openSettingsWindow,
    onQuit: () => app.quit(),
  });
});

ipcMain.on("widget:context-menu", () => {
  const visible = widgetWin && !widgetWin.isDestroyed() && widgetWin.isVisible();
  const menu = Menu.buildFromTemplate([
    { label: "설정...", click: openSettingsWindow },
    { label: visible ? "위젯 숨기기" : "위젯 보이기", click: toggleWidgetVisibility },
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

ipcMain.handle("settings:get", () => settings.getAll());

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
      app.setLoginItemSettings({ openAtLogin: updated.behavior.autoStart });
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
