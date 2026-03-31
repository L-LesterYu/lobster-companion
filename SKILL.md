---
name: lobster-companion
description: 龙虾伴侣 - 实时推送工作状态到桌面龙虾悬浮窗，并通过语音播报 session 日志
metadata: {"openclaw": {"emoji": "🦞", "always": true}}
---

# Lobster Companion Skill

## 描述
与桌面龙虾助手联动，实时推送 OpenClaw 工作状态，并通过 TTS 语音播报 session 日志。

## 自动化状态推送（Plugin Hook）

**推荐方式：** 已通过 `lobster-companion-hook` 插件实现自动化。

插件会在每次工具调用后自动推送到龙虾，无需手动调用 `pushState`。插件功能：
- 监听 `after_tool_call` hook，自动捕获所有工具调用
- 根据工具类型映射为对应的龙虾状态、emoji 和文案
- 2 秒节流，同类工具合并，避免频繁推送
- `agent_end` 时自动推送 `done` 状态
- `message_received` 时自动推送 `idle` 状态

### 自动状态映射表

| 工具 | 龙虾状态 | Emoji | 文案示例 |
|------|---------|-------|---------|
| `read` | working | 📖 | "读取 config.json" |
| `write` | working | ✏️ | "写入 main.js" |
| `edit` | working | 🔧 | "修改 index.html" |
| `exec` | working | ⌨️ | "执行 npm..." |
| `web_fetch` | working | 🔍 | "访问 github.com" |
| `browser` | working | 🌐 | "浏览 example.com" |
| `tts` | working | 🔊 | "语音播报中..." |
| `message` | working | 💬 | "发送消息中..." |
| `sessions_spawn` | working | 🦞 | "派出助手~" |
| 其他工具 | working | 💻 | "处理中..." |
| agent 结束 | done | ✅ | "搞定啦！" |
| 收到消息 | idle | 📨 | "收到新消息" |

### Plugin 安装

插件位于 `~/.openclaw/extensions/lobster-companion-hook/`，已在 `openclaw.json` 中启用。

管理命令：
```bash
openclaw plugins list          # 查看插件状态
openclaw plugins disable lobster-companion-hook   # 禁用
openclaw plugins enable lobster-companion-hook    # 启用
```

---

## 手动状态推送（备选/调试用）

Plugin 已自动处理大部分状态推送。以下手动命令仅在特殊场景或调试时使用。

### API 端点
- `POST http://localhost:18182/api/state` — 状态推送
- `GET http://localhost:18182/api/health` — 健康检查

有效状态：`idle` | `working` | `thinking` | `sleeping` | `done` | `error`

### POST /api/state 参数

```json
{
  "state": "working",       // 必填：状态名
  "message": "读取文件",     // 可选：气泡文案
  "emoji": "📖",            // 可选：覆盖默认 emoji
  "toolName": "read",       // 可选：工具名称（供动画扩展）
  "priority": "normal"      // 可选：high/normal/low
}
```

所有新增参数（`emoji`/`toolName`/`priority`）均为可选，不传则使用默认值。保持向后兼容。

### 命令

#### pushState(state, message?, emoji?, toolName?)

推送状态到龙虾。

```bash
# 基础用法
timeout 3 curl -s -X POST http://localhost:18182/api/state \
  -H "Content-Type: application/json" \
  -d '{"state":"working","message":"正在处理..."}'

# 带 emoji 和 toolName
timeout 3 curl -s -X POST http://localhost:18182/api/state \
  -H "Content-Type: application/json" \
  -d '{"state":"working","message":"读取 config.json","emoji":"📖","toolName":"read"}'
```

#### checkHealth()

检查龙虾是否存活。

```bash
timeout 3 curl -s http://localhost:18182/api/health
```

#### launchLobster()

启动龙虾程序。

```bash
cd ~/.openclaw/skills/lobster-companion && nohup npx electron . --no-sandbox > /dev/null 2>&1 &
```

#### ensureLobster()

先健康检查，未运行则拉起。

---

## 核心功能：语音播报 Session 日志

### 工作原理
当 OpenClaw 正在工作时（派出子agent、执行任务等），通过 `tts` 工具将关键日志信息**语音播报**出来，让用户不用盯着屏幕也能了解进展。

### 播报时机与规则

**必须播报的事件：**
| 事件 | 播报内容示例 | 龙虾状态 |
|------|------------|---------|
| 派出子agent | "已派出XX助手处理任务" | working |
| 子agent完成 | "XX助手已完成任务，结果是..." | done |
| 子agent出错/超时 | "XX助手遇到了一些问题" | error |
| 收到用户消息 | "收到新消息" | idle |
| 重要工具调用结果 | "XX操作已完成" | done |

**不播报的事件：**
- 心跳轮询（HEARTBEAT_OK）
- 日常检查（无重要变化的）
- 重复性状态更新（避免刷屏）
- 内部系统事件

### 播报内容生成规则

1. **精简摘要** — 从 subagent 返回结果中提取关键信息（1-2句话）
2. **角色称呼** — 用友好的称呼（"开发助手"、"测试助手"、"文档助手"等）
3. **结果导向** — 重点说"做了什么"和"结果如何"，省略中间细节
4. **语气自然** — 用口语化表达，像在跟用户聊天

### 播报实现

使用 `tts` 工具进行语音播报：
```
调用 tts 工具，text 参数为播报文案
播报完成后回复 NO_REPLY（避免重复文字消息）
```

---

## 手动推送状态映射（无 Plugin 时）

| OpenClaw 场景 | 龙虾状态 | 气泡文案 | 是否播报 |
|--------------|---------|---------|---------|
| 收到用户消息 | idle | （消息前10字） | ✅ "收到新消息" |
| 开始处理请求 | working | "正在处理..." | ❌ |
| 派出子agent | working | "派出{角色}助手~" | ✅ 播报 |
| 子agent完成 | done | "搞定！" | ✅ 播报摘要 |
| 子agent出错/超时 | error | "出了点问题..." | ✅ 播报 |
| 心跳轮询 | — | 不推送 | ❌ |
| 用户离开（>5分钟） | sleeping | "zzZ..." | ❌ |

---

## 龙虾程序位置
`~/.openclaw/skills/lobster-companion/`

## 注意事项
- 推送失败时静默处理，不要因龙虾挂了影响主流程
- TTS 播报失败时也静默处理
- 气泡文案要简短（<20字），TTS 播报文案控制在 1-2 句话
- 所有 curl 调用使用 `timeout 3` 防止阻塞
- 避免短时间内连续播报（间隔至少 3 秒）
