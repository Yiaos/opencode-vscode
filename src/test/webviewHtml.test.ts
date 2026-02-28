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
  const button = { addEventListener: () => undefined }
  const elements = new Map<string, unknown>([
    ["frame", frame],
    ["status", status],
    ["new-session", button],
    ["session-menu", button],
    ["review-permissions", button],
    ["attach-menu", button],
    ["switch-session", button],
    ["show-todo", button],
    ["show-diff", button],
    ["run-command", button],
    ["run-shell", button],
    ["send-context", button],
    ["abort-session", button],
    ["open-reference", button],
    ["refresh", button],
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
  assert.ok(html.includes("id=\"session-menu\""))
  assert.ok(html.includes("id=\"review-permissions\""))
  assert.ok(html.includes("id=\"attach-menu\""))
  assert.ok(html.includes("id=\"new-session\""))
  assert.ok(html.includes("id=\"switch-session\""))
  assert.ok(html.includes("id=\"show-todo\""))
  assert.ok(html.includes("id=\"show-diff\""))
  assert.ok(html.includes("id=\"run-command\""))
  assert.ok(html.includes("id=\"run-shell\""))
  assert.ok(html.includes("id=\"send-context\""))
  assert.ok(html.includes("id=\"abort-session\""))
  assert.ok(html.includes("id=\"open-reference\""))
  assert.ok(html.includes("if (event.source === frame.contentWindow) return;"))
  assert.ok(html.includes("if (!prev.pathname.includes(\"/session/\")) return current;"))
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
