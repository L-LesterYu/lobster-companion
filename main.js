/**
 * 🦞 龙虾悬浮助手 — Electron 主进程
 * 功能：无边框透明悬浮窗 + 系统托盘 + 本地 HTTP API
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } = require('electron');
const express = require('express');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
const HTTP_PORT = 18182;

// ===== 单例锁 =====
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ===== 创建悬浮窗 =====
function createWindow() {
  // 获取屏幕尺寸，计算居中位置
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 320, winH = 400;

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 200,
    minHeight: 250,
    maxWidth: 600,
    maxHeight: 750,
    x: Math.round(screenW - winW - 40),   // 默认右上角
    y: Math.round((screenH - winH) / 2),
    frame: false,           // 无边框
    transparent: true,       // 透明背景
    alwaysOnTop: true,       // 始终置顶
    skipTaskbar: true,       // 不显示在任务栏
    resizable: false,        // 禁止边框调整（用代码控制大小）
    hasShadow: false,        // 无阴影
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setVisibleOnAllWorkspaces(true);

  // 关闭窗口时隐藏而非退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ===== 系统托盘 =====
function createTray() {
  // 尝试加载托盘图标，不存在则创建空图标
  let iconPath = path.join(__dirname, 'tray-icon.png');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    // 确保图标尺寸合理
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '🦞 显示龙虾', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '🚪 退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('🦞 龙虾助手');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

// ===== IPC 处理 =====
// 窗口拖拽
ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + deltaX, y + deltaY);
  }
});

// 窗口缩放
ipcMain.on('window-resize', (event, delta) => {
  if (mainWindow) {
    const [w, h] = mainWindow.getSize();
    const newW = Math.max(200, Math.min(600, w + delta));
    const newH = Math.max(250, Math.min(750, h + delta * 1.25));
    mainWindow.setSize(Math.round(newW), Math.round(newH));
  }
});

// 获取窗口位置（用于拖拽起点）
ipcMain.handle('window-position', () => {
  if (mainWindow) return mainWindow.getPosition();
  return [0, 0];
});

// ===== HTTP API 服务器 =====
function startHttpServer() {
  const expressApp = express();
  expressApp.use(express.json());

  // 接收状态变更（向后兼容：emoji/toolName/priority 均为可选）
  expressApp.post('/api/state', (req, res) => {
    const { state, message, emoji, toolName, priority } = req.body;
    const validStates = ['idle', 'working', 'thinking', 'sleeping', 'done', 'error'];
    if (validStates.includes(state)) {
      // 构建发送给渲染进程的数据，只传有效字段
      const payload = { state, message };
      if (emoji) payload.emoji = emoji;
      if (toolName) payload.toolName = toolName;
      if (priority) payload.priority = priority;
      mainWindow?.webContents.send('state-change', payload);
      res.json({ ok: true, lobsterState: state });
    } else {
      res.status(400).json({ ok: false, error: 'Invalid state' });
    }
  });

  // 健康检查
  expressApp.get('/api/health', (req, res) => {
    res.json({ alive: true, uptime: process.uptime() });
  });

  expressApp.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`🦞 Lobster API server on http://localhost:${HTTP_PORT}`);
  });
}

// ===== App 生命周期 =====
app.whenReady().then(() => {
  createWindow();
  createTray();
  startHttpServer();
});

app.on('second-instance', () => {
  if (mainWindow) mainWindow.show();
});

app.on('window-all-closed', () => {
  // 不退出，保持托盘
});

// 他人尝试启动时，聚焦已有窗口
app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});
