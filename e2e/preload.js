// Minimal preload — no IPC handlers needed for E2E test
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
})
