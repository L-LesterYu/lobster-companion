# 🦞 Lobster Companion

[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-ff6b35?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjE0Ij48dGV4dCB5PSIxOCIgZm9udC1zaXplPSIxNiI+🦞PC90ZXh0Pjwvc3ZnPg==)](https://github.com/openclaw/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-339933?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)

一个基于 Electron + Canvas 2D 的可爱龙虾桌面宠物，专为 [OpenClaw](https://openclaw.com) 设计的 Agent Skill。当你的 AI Agent 在工作时，龙虾会在桌面上实时展示工作状态，并通过语音播报关键进展——让你不用盯着屏幕也能掌握一切。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🦞 **Q版可爱龙虾** | 纯 Canvas 2D 手绘的红色龙虾，支持 6 种状态动画 |
| 🖥️ **桌面悬浮窗** | 无边框透明窗口，始终置顶，可拖拽、可缩放 |
| 🔔 **系统托盘** | 最小化到托盘，随时唤出 |
| 📡 **HTTP API** | 本地 API 端点，接收外部状态推送 |
| 💬 **语音气泡** | 根据状态显示不同的气泡文案和 Emoji |
| 🔊 **语音播报** | 通过 TTS 语音播报子 Agent 派出、完成、出错等关键事件 |
| 🤖 **OpenClaw 集成** | 作为 Skill 安装后，自动推送 OpenClaw 工作状态 |
| 🔌 **Plugin Hook** | 内置 `lobster-companion-hook` 插件，全自动化状态推送 |

## 🎭 支持的状态

| 状态 | Emoji | 含义 | 触发场景 |
|------|-------|------|---------|
| `idle` | 📨 | 空闲 | 收到用户消息 |
| `working` | ⌨️ | 工作中 | 文件读写、执行命令、浏览网页等 |
| `thinking` | 🤔 | 思考中 | Agent 分析推理 |
| `sleeping` | 💤 | 休眠中 | 用户长时间离开 |
| `done` | ✅ | 完成 | 任务完成 |
| `error` | ❌ | 出错 | 任务执行失败 |

---

## 🛠️ 技术栈

- **[Electron](https://www.electronjs.org/)** — 跨平台桌面应用框架
- **Canvas 2D** — 纯手绘龙虾形象与动画，零外部依赖
- **[Express](https://expressjs.com/)** — 本地 HTTP API 服务器
- **Node.js** — 运行时环境

---

## 📦 安装

### 前置要求

- **Node.js** >= 18
- **npm**
- **桌面环境**（显示 GUI 窗口）：Linux 需要 X11 或 Wayland，macOS/Windows 无额外要求
- **服务器/无头环境**：需通过 X11 Forwarding（`ssh -X`）或虚拟帧缓冲（`xvfb`）提供显示服务

### 作为 OpenClaw Skill 安装

> ⚠️ 当前版本尚未发布到 ClawHub，请使用手动安装方式。

```bash
# 手动克隆到 skills 目录
cd ~/.openclaw/skills
git clone https://github.com/L-LesterYu/lobster-companion.git
cd lobster-companion
npm install
```

### 国内网络环境

国内网络环境下，`npm install` 和 Electron 二进制下载可能超时或失败，建议使用镜像源：

```bash
# 使用淘宝镜像安装依赖
cd ~/.openclaw/skills/lobster-companion
npm install --registry=https://registry.npmmirror.com

# 使用 Electron 国内镜像安装二进制（如果首次安装失败）
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install electron
```

如果 Electron 启动时报 `Electron failed to install correctly`，执行以下命令修复：

```bash
rm -rf node_modules/electron
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install electron
```

### Plugin Hook 安装

插件会在每次工具调用后自动推送到龙虾，无需手动调用：

```bash
# 插件位于 OpenClaw extensions 目录，已在 openclaw.json 中启用
openclaw plugins list                          # 查看插件状态
openclaw plugins disable lobster-companion-hook # 禁用
openclaw plugins enable lobster-companion-hook  # 启用
```

> ⚠️ `lobster-companion-hook` 插件需要单独安装，当前仓库中未包含。请确认该插件已放置在 `~/.openclaw/extensions/lobster-companion-hook/` 目录下。

---

## 🎮 使用方法

### 启动龙虾

```bash
cd ~/.openclaw/skills/lobster-companion
npx electron . --no-sandbox
```

> 💡 `--no-sandbox` 参数在 Linux 服务器环境下通常必须，避免 Chromium 沙箱权限问题。macOS/Windows 桌面环境可省略。启动时如果看到 `Exiting GPU process due to errors during initialization` 警告，属于正常现象，不影响功能。

### 推送状态（手动/调试用）

> Plugin Hook 已自动处理大部分状态推送，以下命令仅在特殊场景或调试时使用。

```bash
# 推送工作状态
curl -X POST http://localhost:18182/api/state \
  -H "Content-Type: application/json" \
  -d '{"state":"working","message":"正在处理...","emoji":"⌨️"}'

# 健康检查
curl http://localhost:18182/api/health
```

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `http://localhost:18182/api/state` | 推送状态变更 |
| `GET` | `http://localhost:18182/api/health` | 健康检查 |

**POST `/api/state` 参数：**

```json
{
  "state": "working",    // 必填：idle | working | thinking | sleeping | done | error
  "message": "读取文件",  // 可选：气泡文案（建议 <20 字）
  "emoji": "📖",         // 可选：覆盖默认 emoji
  "toolName": "read",    // 可选：工具名称（供动画扩展）
  "priority": "normal"   // 可选：high | normal | low
}
```

---

## 🔊 语音播报

配合 OpenClaw 的 TTS 工具，龙虾 companion 可以语音播报关键事件：

| 事件 | 播报内容示例 | 是否播报 |
|------|------------|---------|
| 派出子 agent | "已派出开发助手处理任务" | ✅ |
| 子 agent 完成 | "开发助手已完成，结果正常" | ✅ |
| 子 agent 出错 | "测试助手遇到了一些问题" | ✅ |
| 收到用户消息 | "收到新消息" | ✅ |
| 心跳轮询 | — | ❌ |

---

## 📁 项目结构

```
lobster-companion/
├── index.html          # 主界面（Canvas 渲染）
├── main.js             # Electron 主进程 + Express 服务器
├── preload.js          # 预加载脚本
├── package.json        # 依赖配置
├── SKILL.md            # OpenClaw Skill 描述文件
├── LICENSE             # MIT 许可证
└── sprites/            # 龙虾各状态 PNG 精灵图
    ├── lobster_waiting_*.png
    ├── lobster_working_*.png
    ├── lobster_eating_*.png
    ├── lobster_coding_done.png
    ├── lobster_coding_error_1_1.png
    └── lobster_sleepy_bubbles_*.png
```

---

## ❓ 常见问题

<details>
<summary><b>Q: 启动时报 <code>Electron failed to install correctly</code></b></summary>

Electron 二进制未完整下载。删除后重新安装：

```bash
cd ~/.openclaw/skills/lobster-companion
rm -rf node_modules/electron
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install electron
```

</details>

<details>
<summary><b>Q: <code>npm install</code> 卡住不动</b></summary>

网络问题导致依赖下载超时。切换到国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

</details>

<details>
<summary><b>Q: 启动时出现 GPU 相关错误</b></summary>

服务器环境通常没有 GPU 加速，这是预期行为，不影响龙虾功能。可忽略。

</details>

<details>
<summary><b>Q: 服务器没有显示器，如何使用？</b></summary>

龙虾是一个桌面 GUI 应用，需要显示服务。以下方案可选：

- **X11 Forwarding**：`ssh -X user@server`，启动后窗口会转发到本地
- **Xvfb 虚拟帧缓冲**：`xvfb-run npx electron . --no-sandbox`
- **VNC / 远程桌面**：安装 VNC 服务后在远程桌面中启动

</details>

<details>
<summary><b>Q: Plugin Hook 提示找不到</b></summary>

`lobster-companion-hook` 插件不在本仓库中，需单独获取并安装到 `~/.openclaw/extensions/lobster-companion-hook/`。没有该插件时，龙虾仍可通过手动 API 调用正常工作。

</details>

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

---

## 📄 License

[MIT](LICENSE) © 2025 L-LesterYu

---

<p align="center">
  Made with 🦞 for <a href="https://openclaw.com">OpenClaw</a>
</p>
