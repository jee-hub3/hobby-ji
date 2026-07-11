// 트레이 아이콘/메뉴 — F-10

const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");

function createTray({ isWidgetVisible, onToggleWidget, onRecenter, onOpenSettings, onQuit }) {
  const iconPath = path.join(__dirname, "..", "..", "assets", "icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(icon);
  tray.setToolTip("Claude Usage Widget");

  function rebuildMenu() {
    const visible = isWidgetVisible();
    const menu = Menu.buildFromTemplate([
      {
        label: visible ? "위젯 숨기기" : "위젯 보이기",
        click: () => {
          onToggleWidget();
          rebuildMenu();
        },
      },
      { label: "위젯 위치 초기화", click: onRecenter },
      { label: "설정...", click: onOpenSettings },
      { type: "separator" },
      { label: "종료", click: onQuit },
    ]);
    tray.setContextMenu(menu);
  }

  rebuildMenu();
  tray.on("click", () => rebuildMenu());

  return tray;
}

module.exports = { createTray };
