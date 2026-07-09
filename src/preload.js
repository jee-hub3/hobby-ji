// contextBridge로만 노출. nodeIntegration 금지, 토큰은 여기 어디에도 등장하지 않음.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("claudeUsage", {
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("usage:update", listener);
    return () => ipcRenderer.removeListener("usage:update", listener);
  },
  requestContextMenu: () => ipcRenderer.send("widget:context-menu"),
  reportSize: (size) => ipcRenderer.send("widget:resize", size),

  // 온보딩 버튼: 액션 id만 전달(임의 URL 금지). main이 id→동작을 매핑한다.
  onboardingAction: (id) => ipcRenderer.send("onboarding:action", id),

  getAppInfo: () => ipcRenderer.invoke("app:info"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (partial) => ipcRenderer.send("settings:set", partial),
  onSettingsUpdate: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:update", listener);
    return () => ipcRenderer.removeListener("settings:update", listener);
  },
});
