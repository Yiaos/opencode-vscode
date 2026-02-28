import assert from "node:assert/strict"
import test from "node:test"
import { dispatchWebviewMessage, type WebviewMessageHandlers } from "../webviewMessageRouter"

function createHandlers() {
  const calls: Array<{ event: string; value?: string }> = []
  const handlers: WebviewMessageHandlers = {
    onReady: (url) => calls.push({ event: "ready", value: url }),
    onNewSession: () => calls.push({ event: "new" }),
    onSessionMenu: () => calls.push({ event: "session-menu" }),
    onReviewPermissions: () => calls.push({ event: "review" }),
    onAttachMenu: () => calls.push({ event: "attach" }),
    onSendContext: () => calls.push({ event: "send-context" }),
    onPrompt: (text) => calls.push({ event: "prompt", value: text }),
    onSwitchSession: () => calls.push({ event: "switch" }),
    onOpenPanel: () => calls.push({ event: "open-panel" }),
    onShowTodo: () => calls.push({ event: "todo" }),
    onShowDiff: () => calls.push({ event: "diff" }),
    onRunCommand: () => calls.push({ event: "command" }),
    onRunShell: () => calls.push({ event: "shell" }),
    onAbortSession: () => calls.push({ event: "abort" }),
    onOpenReference: () => calls.push({ event: "open-reference" }),
    onRefresh: () => calls.push({ event: "refresh" }),
    onFrameError: () => calls.push({ event: "frame-error" }),
  }
  return { calls, handlers }
}

test("dispatchWebviewMessage: ignores invalid payload", () => {
  const { calls, handlers } = createHandlers()
  dispatchWebviewMessage(undefined, handlers)
  dispatchWebviewMessage(null, handlers)
  dispatchWebviewMessage("x", handlers)
  dispatchWebviewMessage({}, handlers)
  dispatchWebviewMessage({ type: 123 }, handlers)
  assert.equal(calls.length, 0)
})

test("dispatchWebviewMessage: routes ready and prompt messages", () => {
  const { calls, handlers } = createHandlers()
  dispatchWebviewMessage({ type: "ready", url: "http://127.0.0.1:4096/session/s1" }, handlers)
  dispatchWebviewMessage({ type: "action-prompt", text: "  hello codex  " }, handlers)
  dispatchWebviewMessage({ type: "action-prompt", text: "   " }, handlers)

  assert.deepEqual(calls, [
    { event: "ready", value: "http://127.0.0.1:4096/session/s1" },
    { event: "prompt", value: "hello codex" },
  ])
})

test("dispatchWebviewMessage: routes action messages", () => {
  const { calls, handlers } = createHandlers()
  const actionTypes = [
    "action-new-session",
    "action-session-menu",
    "action-review-permissions",
    "action-attach-menu",
    "action-send-context",
    "action-switch-session",
    "action-open-panel",
    "action-show-todo",
    "action-show-diff",
    "action-run-command",
    "action-run-shell",
    "action-abort-session",
    "action-open-reference",
    "action-refresh",
    "frame-error",
  ]
  for (const type of actionTypes) {
    dispatchWebviewMessage({ type }, handlers)
  }

  assert.deepEqual(
    calls.map((item) => item.event),
    [
      "new",
      "session-menu",
      "review",
      "attach",
      "send-context",
      "switch",
      "open-panel",
      "todo",
      "diff",
      "command",
      "shell",
      "abort",
      "open-reference",
      "refresh",
      "frame-error",
    ],
  )
})
