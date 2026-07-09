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

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (partial) => ipcRenderer.send("settings:set", partial),
  onSettingsUpdate: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:update", listener);
    return () => ipcRenderer.removeListener("settings:update", listener);
  },
});
