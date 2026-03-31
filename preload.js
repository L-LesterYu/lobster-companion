/**
 * 🦞 龙虾悬浮助手 — Preload 脚本
 * 通过 contextBridge 暴露安全 API 给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lobsterAPI', {
  // 监听状态变更（从 HTTP API 转发过来）
  onStateChange: (callback) => {
    ipcRenderer.on('state-change', (event, data) => callback(data));
  },

  // 窗口拖拽：发送鼠标位移量
  moveWindow: (deltaX, deltaY) => {
    ipcRenderer.send('window-move', { deltaX, deltaY });
  },

  // 窗口缩放：发送缩放增量
  resizeWindow: (delta) => {
    ipcRenderer.send('window-resize', delta);
  },

  // 获取窗口当前位置
  getWindowPosition: () => {
    return ipcRenderer.invoke('window-position');
  }
});
