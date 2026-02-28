import test from "node:test"
import assert from "node:assert/strict"
import vm from "node:vm"
import { createWebviewHtml } from "../webviewHtml"

function extractScript(html: string) {
  const match = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)
  assert.ok(match, "expected inline webview script")
  return match[1]
}

function runWebviewScript(serverUrl: string, savedState?: unknown) {
  const html = createWebviewHtml({
    cspSource: "vscode-webview://abc",
    serverUrl,
    nonce: "nonce123",
    title: "OpenCode GUI",
  })
  const script = extractScript(html)

  const setStateCalls: unknown[] = []
  const postMessages: unknown[] = []
  let messageHandler: ((event: unknown) => Promise<void>) | undefined

  const createClickable = () => ({
    handlers: new Map<string, ((event?: unknown) => void)[]>(),
    addEventListener(type: string, handler: (event?: unknown) => void) {
      const list = this.handlers.get(type) || []
      list.push(handler)
      this.handlers.set(type, list)
    },
    trigger(type: string, event?: unknown) {
      for (const handler of this.handlers.get(type) || []) {
        handler(event)
      }
    },
  })

  const frame = {
    src: "",
    contentWindow: {
      location: {
        reload: () => undefined,
      },
    },
    addEventListener: () => undefined,
  }
  const status = { textContent: "" }
  const sessionTitle = { textContent: "" }
  const promptInput = createClickable() as ReturnType<typeof createClickable> & { value: string }
  promptInput.value = ""
  const button = createClickable()
  const elements = new Map<string, unknown>([
    ["frame", frame],
    ["status", status],
    ["session-title", sessionTitle],
    ["prompt-input", promptInput],
    ["action-refresh", button],
    ["action-session-menu", button],
    ["action-review-permissions", button],
    ["action-open-panel", button],
    ["action-attach-menu", button],
    ["action-new-session", button],
    ["action-switch-session", button],
    ["action-send-context", button],
    ["action-show-todo", button],
    ["action-show-diff", button],
    ["action-run-command", button],
    ["action-run-shell", button],
    ["action-open-reference", button],
    ["action-abort-session", button],
    ["action-send-prompt", button],
  ])

  const context = {
    URL,
    document: {
      getElementById: (id: string) => elements.get(id),
    },
    window: {
      addEventListener: (type: string, handler: (event: unknown) => Promise<void>) => {
        if (type === "message") messageHandler = handler
      },
    },
    acquireVsCodeApi: () => ({
      getState: () => savedState,
      setState: (next: unknown) => setStateCalls.push(next),
      postMessage: (message: unknown) => postMessages.push(message),
    }),
  }
  vm.runInNewContext(script, context)
  assert.ok(messageHandler, "expected message event handler")

  return {
    frame,
    status,
    sessionTitle,
    promptInput,
    setStateCalls,
    postMessages,
    async postWindowMessage(event: unknown) {
      await messageHandler?.(event)
    },
  }
}

test("createWebviewHtml: injects server url and nonce", () => {
  const html = createWebviewHtml({
    cspSource: "vscode-webview://abc",
    serverUrl: "http://127.0.0.1:4096",
    nonce: "nonce123",
    title: "OpenCode GUI",
  })

  assert.ok(html.includes("http://127.0.0.1:4096"))
  assert.ok(html.includes("script-src 'nonce-nonce123'"))
  assert.ok(html.includes("frame-src http://localhost:* http://127.0.0.1:*"))
  assert.ok(html.includes("id=\"action-session-menu\""))
  assert.ok(html.includes("id=\"action-review-permissions\""))
  assert.ok(html.includes("id=\"action-attach-menu\""))
  assert.ok(html.includes("id=\"action-new-session\""))
  assert.ok(html.includes("id=\"action-switch-session\""))
  assert.ok(html.includes("id=\"action-show-todo\""))
  assert.ok(html.includes("id=\"action-show-diff\""))
  assert.ok(html.includes("id=\"action-run-command\""))
  assert.ok(html.includes("id=\"action-run-shell\""))
  assert.ok(html.includes("id=\"action-send-context\""))
  assert.ok(html.includes("id=\"action-abort-session\""))
  assert.ok(html.includes("id=\"action-open-reference\""))
  assert.ok(html.includes("id=\"action-send-prompt\""))
  assert.ok(html.includes("if (event.source === frame.contentWindow) return;"))
  assert.ok(html.includes("if (!prev.pathname.includes(\"/session/\")) return current;"))
  assert.ok(html.includes("grid-template-rows: auto minmax(0, 1fr) auto auto;"))
  assert.ok(html.includes("overflow-x: auto;"))
})

test("createWebviewHtml: escapes title", () => {
  const html = createWebviewHtml({
    cspSource: "vscode-webview://abc",
    serverUrl: "http://127.0.0.1:4096",
    nonce: "nonce123",
    title: "<Unsafe>",
  })

  assert.ok(html.includes("&lt;Unsafe&gt;"))
  assert.ok(!html.includes("<title><Unsafe></title>"))
})

test("createWebviewHtml script: keeps current host/port and restores session route", () => {
  const harness = runWebviewScript("http://127.0.0.1:4096", {
    url: "http://127.0.0.1:9999/session/s1?tab=chat#bottom",
  })

  assert.equal(harness.frame.src, "http://127.0.0.1:4096/session/s1?tab=chat#bottom")
  const firstState = harness.setStateCalls[0] as { url?: string } | undefined
  assert.equal(firstState?.url, "http://127.0.0.1:4096/session/s1?tab=chat#bottom")
  assert.equal(harness.sessionTitle.textContent, "s1")
})

test("createWebviewHtml script: ignores navigate messages from iframe source", async () => {
  const harness = runWebviewScript("http://127.0.0.1:4096")
  const initial = harness.frame.src

  await harness.postWindowMessage({
    source: harness.frame.contentWindow,
    data: { type: "navigate", url: "https://attacker.invalid/session/pwn" },
  })
  assert.equal(harness.frame.src, initial)
  assert.equal(harness.setStateCalls.length, 1)

  await harness.postWindowMessage({
    source: null,
    data: { type: "navigate", url: "http://127.0.0.1:4096/session/safe" },
  })
  assert.equal(harness.frame.src, "http://127.0.0.1:4096/session/safe")
  assert.equal(harness.setStateCalls.length, 2)
})

test("createWebviewHtml script: sends prompt on Enter", () => {
  const harness = runWebviewScript("http://127.0.0.1:4096")
  harness.promptInput.value = "hello opencode"

  harness.promptInput.trigger("keydown", {
    key: "Enter",
    shiftKey: false,
    preventDefault: () => undefined,
  })

  const last = harness.postMessages[harness.postMessages.length - 1] as { type?: string; text?: string } | undefined
  assert.equal(last?.type, "action-prompt")
  assert.equal(last?.text, "hello opencode")
  assert.equal(harness.promptInput.value, "")
})
