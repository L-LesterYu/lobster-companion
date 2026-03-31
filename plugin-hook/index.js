/**
 * 🦞 Lobster Companion Hook
 *
 * Automatically pushes OpenClaw agent working status to the
 * Lobster Companion desktop pet via HTTP API.
 *
 * Hooked events:
 *   - after_tool_call  → "working" (with tool-specific emoji & message)
 *   - agent_end        → "done" / "error"
 *   - message_received → "idle"
 *   - subagent_spawned → "working" (subagent dispatched)
 *   - subagent_ended   → "done" / "error" (subagent result)
 */

const { definePluginEntry } = require("/usr/local/lib/node_modules/openclaw/dist/plugin-sdk/plugin-entry.js");

// ─── Tool → State Mapping ────────────────────────────────────────────

const TOOL_STATE_MAP = {
  read:           { state: "working",  emoji: "📖", label: "读取文件" },
  write:          { state: "working",  emoji: "✏️", label: "写入文件" },
  edit:           { state: "working",  emoji: "🔧", label: "修改文件" },
  exec:           { state: "working",  emoji: "⌨️", label: "执行命令" },
  web_fetch:      { state: "working",  emoji: "🔍", label: "访问网页" },
  web_search:     { state: "working",  emoji: "🔎", label: "搜索中" },
  browser:        { state: "working",  emoji: "🌐", label: "浏览网页" },
  tts:            { state: "working",  emoji: "🔊", label: "语音播报" },
  message:        { state: "working",  emoji: "💬", label: "发送消息" },
  sessions_spawn: { state: "working",  emoji: "🦞", label: "派出助手" },
};

const DEFAULT_TOOL_STATE = { state: "working", emoji: "💻", label: "处理中" };

// ─── Throttle & Idle Tracker ─────────────────────────────────────────

let lastPushTime = 0;
let idleTimer = null;

function resolveConfig(pluginConfig) {
  return {
    apiUrl:         (pluginConfig && pluginConfig.apiUrl) || "http://localhost:18182/api/state",
    healthUrl:      (pluginConfig && pluginConfig.healthUrl) || "http://localhost:18182/api/health",
    throttleMs:     (pluginConfig && pluginConfig.throttleMs) || 2000,
    idleTimeoutMs:  (pluginConfig && pluginConfig.idleTimeoutMs) || 300000,
    enabled:        (pluginConfig && pluginConfig.enabled) !== false,
  };
}

function now() { return Date.now(); }

function pushState(config, payload) {
  if (!config.enabled) return;

  const elapsed = now() - lastPushTime;
  if (elapsed < config.throttleMs && payload.priority !== "high") {
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).then(() => {
      clearTimeout(timeout);
      lastPushTime = now();
    }).catch(() => {
      clearTimeout(timeout);
    });
  } catch {
    // Silently ignore
  }
}

function resetIdleTimer(config) {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    pushState(config, { state: "sleeping", message: "zzZ...", emoji: "💤" });
  }, config.idleTimeoutMs);
}

// ─── Extract short description from tool params ─────────────────────

function extractToolDetail(toolName, params) {
  params = params || {};
  switch (toolName) {
    case "read":
    case "write":
    case "edit": {
      const p = params.path || params.file_path || "";
      return p.split("/").pop() || "";
    }
    case "exec": {
      const cmd = params.command || "";
      return cmd.length > 30 ? cmd.slice(0, 30) + "…" : cmd;
    }
    case "web_fetch": {
      const url = params.url || "";
      try { return new URL(url).hostname; } catch { return url.slice(0, 20); }
    }
    case "web_search": {
      const q = params.query || "";
      return q.length > 20 ? q.slice(0, 20) + "…" : q;
    }
    default:
      return "";
  }
}

// ─── Plugin Entry ────────────────────────────────────────────────────

module.exports = definePluginEntry({
  id: "lobster-companion-hook",
  name: "Lobster Companion Hook",
  description: "Automatically pushes agent working status to the Lobster Companion desktop pet",

  register(api) {
    const config = resolveConfig(api.pluginConfig);
    const logger = api.logger;

    logger.info("🦞 Lobster Companion Hook registered");

    // ── after_tool_call ──
    api.on("after_tool_call", (event, _ctx) => {
      const toolName = event.toolName;

      // Skip heartbeat-internal tools
      if (toolName === "sessions_list" || toolName === "sessions_history" || toolName === "sessions_send") {
        return;
      }

      const mapping = TOOL_STATE_MAP[toolName] || DEFAULT_TOOL_STATE;
      const detail = extractToolDetail(toolName, event.params);
      const message = detail ? `${mapping.label} ${detail}` : mapping.label;

      pushState(config, {
        state: mapping.state,
        message: message.length > 20 ? message.slice(0, 20) + "…" : message,
        emoji: mapping.emoji,
        toolName,
      });

      resetIdleTimer(config);
    });

    // ── agent_end ──
    api.on("agent_end", (event, _ctx) => {
      if (event.success) {
        pushState(config, { state: "done", message: "搞定啦！", emoji: "✅", priority: "high" });
      } else {
        pushState(config, { state: "error", message: "出了点问题…", emoji: "❌", priority: "high" });
      }
      resetIdleTimer(config);
    });

    // ── message_received ──
    api.on("message_received", (event, _ctx) => {
      const preview = event.content.length > 15
        ? event.content.slice(0, 15) + "…"
        : event.content;

      pushState(config, {
        state: "idle",
        message: preview,
        emoji: "📨",
        priority: "high",
      });

      resetIdleTimer(config);
    });

    // ── subagent_spawned ──
    api.on("subagent_spawned", (event, _ctx) => {
      const label = event.label || event.agentId || "助手";
      pushState(config, {
        state: "working",
        message: `派出${label}~`,
        emoji: "🦞",
        toolName: "sessions_spawn",
      });

      resetIdleTimer(config);
    });

    // ── subagent_ended ──
    api.on("subagent_ended", (event, _ctx) => {
      if (event.outcome === "ok" || event.outcome === "timeout") {
        pushState(config, {
          state: "done",
          message: "助手已完成",
          emoji: "✅",
          priority: "high",
        });
      } else {
        pushState(config, {
          state: "error",
          message: "助手遇到了问题",
          emoji: "❌",
          priority: "high",
        });
      }

      resetIdleTimer(config);
    });

    // ── gateway_start: health check & initial state ──
    api.on("gateway_start", async (_event, _ctx) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(config.healthUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          logger.info("🦞 Lobster Companion is running — hook active");
          pushState(config, { state: "idle", message: "在线", emoji: "🦞" });
        } else {
          logger.warn("🦞 Lobster Companion health check returned non-OK");
        }
      } catch {
        logger.info("🦞 Lobster Companion not running — will push when available");
      }

      resetIdleTimer(config);
    });
  },
});
