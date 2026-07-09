// 위젯 창 + 설정 창 생성. 위젯: 프레임리스·투명·항상 위.
// 창 크기는 렌더러가 측정한 콘텐츠 크기에 맞춘다(resizeWidget). 위치는 settings에 저장.

const { BrowserWindow, screen } = require("electron");
const path = require("path");
const settings = require("./settings");

// 렌더러가 실제 크기를 보고하기 전까지 쓰는 초기값(가로형 M 근사).
const INITIAL_SIZE = { width: 300, height: 140 };

function clampToDisplay(x, y, width, height) {
  const { workArea } = screen.getDisplayNearestPoint({ x, y });
  const clampedX = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width);
  const clampedY = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height);
  return { x: clampedX, y: clampedY };
}

function createWidgetWindow() {
  const current = settings.getAll();
  const saved = current.position;
  const hasSavedPosition = typeof saved.x === "number" && typeof saved.y === "number";
  const initial = hasSavedPosition
    ? clampToDisplay(saved.x, saved.y, INITIAL_SIZE.width, INITIAL_SIZE.height)
    : null;

  const win = new BrowserWindow({
    width: INITIAL_SIZE.width,
    height: INITIAL_SIZE.height,
    x: initial?.x,
    y: initial?.y,
    frame: false,
    transparent: true,
    alwaysOnTop: current.behavior.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    useContentSize: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "widget", "index.html"));
  win.once("ready-to-show", () => win.show());

  win.on("moved", () => {
    const [x, y] = win.getPosition();
    settings.setPosition({ x, y });
  });

  return win;
}

// 렌더러가 보고한 콘텐츠 크기에 창을 맞추고, 화면 밖으로 나가지 않게 위치 보정.
function resizeWidget(win, width, height) {
  if (!win || win.isDestroyed()) return;
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  win.setContentSize(w, h);
  const [x, y] = win.getPosition();
  const clamped = clampToDisplay(x, y, w, h);
  if (clamped.x !== x || clamped.y !== y) win.setPosition(clamped.x, clamped.y);
}

function createSettingsWindow() {
  const win = new BrowserWindow({
    width: 360,
    height: 540,
    resizable: false,
    title: "설정",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "renderer", "settings", "index.html"));

  return win;
}

module.exports = { createWidgetWindow, createSettingsWindow, resizeWidget };
