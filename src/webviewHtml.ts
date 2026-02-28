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
    }
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
      background: #0f1115;
      color: #e7eaef;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    }
    .root {
      height: 100%;
      width: 100%;
      display: grid;
      grid-template-rows: 36px 1fr;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      background: #141821;
      font-size: 12px;
      line-height: 1;
      user-select: none;
    }
    .status {
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100vw - 24px);
    }
    .left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
    }
    .btn {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      border-radius: 4px;
      line-height: 1;
      padding: 4px 8px;
      cursor: pointer;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.16);
    }
    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      background: #0f1115;
    }
  </style>
</head>
<body>
  <div class="root">
    <div class="bar">
      <div class="left">
        <div class="status" id="status">Connecting OpenCode GUI...</div>
      </div>
      <div class="actions">
        <button class="btn" id="session-menu" type="button">Session</button>
        <button class="btn" id="attach-menu" type="button">Attach</button>
        <button class="btn" id="new-session" type="button">New Session</button>
        <button class="btn" id="switch-session" type="button">Switch</button>
        <button class="btn" id="send-context" type="button">Send Context</button>
        <button class="btn" id="abort-session" type="button">Stop</button>
        <button class="btn" id="open-reference" type="button">Open Ref</button>
        <button class="btn" id="refresh" type="button">Refresh</button>
      </div>
    </div>
    <iframe id="frame" allow="clipboard-read; clipboard-write"></iframe>
  </div>
  <script nonce="${input.nonce}">
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById("frame");
    const status = document.getElementById("status");
    const buttonNewSession = document.getElementById("new-session");
    const buttonSessionMenu = document.getElementById("session-menu");
    const buttonAttachMenu = document.getElementById("attach-menu");
    const buttonSwitchSession = document.getElementById("switch-session");
    const buttonSendContext = document.getElementById("send-context");
    const buttonAbortSession = document.getElementById("abort-session");
    const buttonOpenReference = document.getElementById("open-reference");
    const buttonRefresh = document.getElementById("refresh");

    const setStatus = (text) => {
      status.textContent = text;
    };

    const setFrame = (url) => {
      frame.src = url;
      setStatus("OpenCode GUI: " + url);
      vscode.setState({ url });
    };

    const saved = vscode.getState();
    const initial = saved && saved.url ? saved.url : ${JSON.stringify(frameUrl)};
    setFrame(initial);

    frame.addEventListener("load", () => {
      vscode.postMessage({ type: "ready", url: frame.src });
    });

    frame.addEventListener("error", () => {
      setStatus("OpenCode GUI failed to load");
      vscode.postMessage({ type: "frame-error" });
    });

    window.addEventListener("message", async (event) => {
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

    buttonSessionMenu.addEventListener("click", () => {
      vscode.postMessage({ type: "action-session-menu" });
    });

    buttonAttachMenu.addEventListener("click", () => {
      vscode.postMessage({ type: "action-attach-menu" });
    });

    buttonNewSession.addEventListener("click", () => {
      vscode.postMessage({ type: "action-new-session" });
    });

    buttonSwitchSession.addEventListener("click", () => {
      vscode.postMessage({ type: "action-switch-session" });
    });

    buttonSendContext.addEventListener("click", () => {
      vscode.postMessage({ type: "action-send-context" });
    });

    buttonAbortSession.addEventListener("click", () => {
      vscode.postMessage({ type: "action-abort-session" });
    });

    buttonOpenReference.addEventListener("click", () => {
      vscode.postMessage({ type: "action-open-reference" });
    });

    buttonRefresh.addEventListener("click", () => {
      vscode.postMessage({ type: "action-refresh" });
    });
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
