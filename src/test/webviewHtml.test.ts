import test from "node:test"
import assert from "node:assert/strict"
import { createWebviewHtml } from "../webviewHtml"

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
