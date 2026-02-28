export function createNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let text = ""
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

export function createWebviewHtml(input: {
  cspSource: string
  serverUrl: string
  nonce: string
  title: string
}) {
  const frameUrl = input.serverUrl
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${input.cspSource} https: data:; style-src ${input.cspSource} 'unsafe-inline'; script-src 'nonce-${input.nonce}'; frame-src http://localhost:* http://127.0.0.1:* https://*;"
  />
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f1115;
      --panel: #151922;
      --panel-2: #10141d;
      --line: rgba(255, 255, 255, 0.12);
      --text: #e8ecf4;
      --muted: rgba(232, 236, 244, 0.66);
      --accent: #5da8ff;
    }
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font-family: "Avenir Next", "SF Pro Text", "Segoe UI", sans-serif;
    }
    .root {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      height: 100%;
      width: 100%;
      min-width: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      min-width: 0;
    }
    .brand {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #f06b4a;
      flex: 0 0 auto;
    }
    .title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }
    .session-title {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
    }
    .icon-btn {
      border: 1px solid var(--line);
      background: transparent;
      color: var(--muted);
      height: 24px;
      min-width: 24px;
      border-radius: 6px;
      padding: 0 6px;
      cursor: pointer;
      font-size: 12px;
    }
    .icon-btn:hover {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.28);
      background: rgba(255, 255, 255, 0.04);
    }
    .content {
      min-height: 0;
      min-width: 0;
      background: var(--bg);
    }
    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      background: var(--bg);
    }
    .composer {
      border-top: 1px solid var(--line);
      background: var(--panel-2);
      padding: 10px 10px 8px;
      display: grid;
      gap: 8px;
    }
    .prompt {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 44px;
      max-height: 160px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.02);
      color: var(--text);
      padding: 10px;
      font: 12px/1.4 "Avenir Next", "SF Pro Text", "Segoe UI", sans-serif;
      outline: none;
    }
    .prompt:focus {
      border-color: rgba(93, 168, 255, 0.7);
      box-shadow: 0 0 0 1px rgba(93, 168, 255, 0.3);
    }
    .composer-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .chip {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted);
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      flex: 0 0 auto;
    }
    .chip:hover {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.28);
    }
    .chip.link {
      border-style: dashed;
      color: var(--accent);
    }
    .send {
      margin-left: auto;
      border: 1px solid rgba(93, 168, 255, 0.5);
      background: rgba(93, 168, 255, 0.14);
      color: #cde4ff;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      cursor: pointer;
      flex: 0 0 auto;
      font-size: 12px;
    }
    .send:hover {
      background: rgba(93, 168, 255, 0.24);
    }
    .footer {
      height: 22px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--line);
      background: var(--panel);
      color: var(--muted);
      font-size: 11px;
    }
    .status {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-left: 8px;
      text-align: right;
    }
    @media (max-width: 560px) {
      .header {
        padding: 6px 8px;
      }
      .composer {
        padding: 8px;
      }
      .chip {
        padding: 3px 7px;
      }
    }
  </style>
</head>
<body>
  <div class="root">
    <div class="header">
      <div class="brand">CODEX</div>
      <div class="title-wrap">
        <button class="icon-btn" id="action-switch-session" type="button" title="Switch Session">←</button>
        <div class="session-title" id="session-title">Task</div>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="action-refresh" type="button" title="Refresh">↻</button>
        <button class="icon-btn" id="action-session-menu" type="button" title="Session Actions">☰</button>
        <button class="icon-btn" id="action-review-permissions" type="button" title="Approvals">⚙</button>
        <button class="icon-btn" id="action-open-panel" type="button" title="Open Panel">↗</button>
      </div>
    </div>

    <div class="content">
      <iframe id="frame" allow="clipboard-read; clipboard-write"></iframe>
    </div>

    <div class="composer">
      <textarea
        id="prompt-input"
        class="prompt"
        placeholder="向 Codex 任务提问，@ 添加文件，/ 调出命令"
      ></textarea>
      <div class="composer-actions">
        <button class="chip" id="action-attach-menu" type="button">+</button>
        <button class="chip" id="action-new-session" type="button">New</button>
        <button class="chip" id="action-send-context" type="button">IDE 背景信息</button>
        <button class="chip" id="action-show-todo" type="button">Todo</button>
        <button class="chip" id="action-show-diff" type="button">Diff</button>
        <button class="chip" id="action-run-command" type="button">Slash</button>
        <button class="chip" id="action-run-shell" type="button">Shell</button>
        <button class="chip link" id="action-open-reference" type="button">Open Ref</button>
        <button class="chip" id="action-abort-session" type="button">Stop</button>
        <button class="send" id="action-send-prompt" type="button" title="Send">↑</button>
      </div>
    </div>

    <div class="footer">
      <div>本地 · 完全访问权限</div>
      <div class="status" id="status">Ready</div>
    </div>
  </div>

  <script nonce="${input.nonce}">
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById("frame");
    const status = document.getElementById("status");
    const sessionTitle = document.getElementById("session-title");
    const promptInput = document.getElementById("prompt-input");

    const buttonActionRefresh = document.getElementById("action-refresh");
    const buttonActionSessionMenu = document.getElementById("action-session-menu");
    const buttonActionReviewPermissions = document.getElementById("action-review-permissions");
    const buttonActionOpenPanel = document.getElementById("action-open-panel");
    const buttonActionAttachMenu = document.getElementById("action-attach-menu");
    const buttonActionNewSession = document.getElementById("action-new-session");
    const buttonActionSwitchSession = document.getElementById("action-switch-session");
    const buttonActionSendContext = document.getElementById("action-send-context");
    const buttonActionShowTodo = document.getElementById("action-show-todo");
    const buttonActionShowDiff = document.getElementById("action-show-diff");
    const buttonActionRunCommand = document.getElementById("action-run-command");
    const buttonActionRunShell = document.getElementById("action-run-shell");
    const buttonActionOpenReference = document.getElementById("action-open-reference");
    const buttonActionAbortSession = document.getElementById("action-abort-session");
    const buttonActionSendPrompt = document.getElementById("action-send-prompt");

    const setStatus = (text) => {
      status.textContent = text;
    };

    const setSessionTitle = (url) => {
      try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter(Boolean);
        const sessionIndex = segments.indexOf("session");
        const id = sessionIndex >= 0 ? segments[sessionIndex + 1] : "";
        sessionTitle.textContent = id || "Task";
      } catch {
        sessionTitle.textContent = "Task";
      }
    };

    const setFrame = (url) => {
      frame.src = url;
      setSessionTitle(url);
      setStatus("OpenCode GUI: " + url);
      vscode.setState({ url });
    };

    const saved = vscode.getState();
    const toInitialUrl = () => {
      const current = ${JSON.stringify(frameUrl)};
      if (!saved || typeof saved.url !== "string") return current;
      try {
        const next = new URL(current);
        const prev = new URL(saved.url);
        if (!prev.pathname.includes("/session/")) return current;
        next.pathname = prev.pathname;
        next.search = prev.search;
        next.hash = prev.hash;
        return next.toString();
      } catch {
        return current;
      }
    };
    setFrame(toInitialUrl());

    const sendPrompt = () => {
      const text = promptInput.value.trim();
      if (!text) return;
      vscode.postMessage({ type: "action-prompt", text });
      promptInput.value = "";
      setStatus("Prompt sent");
    };

    frame.addEventListener("load", () => {
      vscode.postMessage({ type: "ready", url: frame.src });
    });

    frame.addEventListener("error", () => {
      setStatus("OpenCode GUI failed to load");
      vscode.postMessage({ type: "frame-error" });
    });

    window.addEventListener("message", async (event) => {
      if (event.source === frame.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "navigate" && typeof message.url === "string") {
        setFrame(message.url);
        return;
      }

      if (message.type === "reload") {
        if (frame.contentWindow) frame.contentWindow.location.reload();
        return;
      }

      if (message.type === "show-file-reference" && typeof message.reference === "string") {
        setStatus("Copied: " + message.reference);
        return;
      }
    });

    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendPrompt();
      }
    });

    buttonActionRefresh.addEventListener("click", () => vscode.postMessage({ type: "action-refresh" }));
    buttonActionSessionMenu.addEventListener("click", () => vscode.postMessage({ type: "action-session-menu" }));
    buttonActionReviewPermissions.addEventListener("click", () => vscode.postMessage({ type: "action-review-permissions" }));
    buttonActionOpenPanel.addEventListener("click", () => vscode.postMessage({ type: "action-open-panel" }));
    buttonActionAttachMenu.addEventListener("click", () => vscode.postMessage({ type: "action-attach-menu" }));
    buttonActionNewSession.addEventListener("click", () => vscode.postMessage({ type: "action-new-session" }));
    buttonActionSwitchSession.addEventListener("click", () => vscode.postMessage({ type: "action-switch-session" }));
    buttonActionSendContext.addEventListener("click", () => vscode.postMessage({ type: "action-send-context" }));
    buttonActionShowTodo.addEventListener("click", () => vscode.postMessage({ type: "action-show-todo" }));
    buttonActionShowDiff.addEventListener("click", () => vscode.postMessage({ type: "action-show-diff" }));
    buttonActionRunCommand.addEventListener("click", () => vscode.postMessage({ type: "action-run-command" }));
    buttonActionRunShell.addEventListener("click", () => vscode.postMessage({ type: "action-run-shell" }));
    buttonActionOpenReference.addEventListener("click", () => vscode.postMessage({ type: "action-open-reference" }));
    buttonActionAbortSession.addEventListener("click", () => vscode.postMessage({ type: "action-abort-session" }));
    buttonActionSendPrompt.addEventListener("click", sendPrompt);
  </script>
</body>
</html>`
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
