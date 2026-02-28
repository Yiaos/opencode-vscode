import test from "node:test"
import assert from "node:assert/strict"
import { buildStatusBarState } from "../statusBarState"

test("buildStatusBarState: includes busy and permission badge", () => {
  const result = buildStatusBarState({
    connected: true,
    serverUrl: "http://127.0.0.1:4096",
    sessionState: "busy",
    pendingPermissions: 2,
  })

  assert.ok(result.text.includes("Connected"))
  assert.ok(result.text.includes("$(sync~spin)"))
  assert.ok(result.text.includes("$(warning)2"))
  assert.ok(result.tooltip.includes("Pending approvals: 2"))
})

test("buildStatusBarState: disconnected state", () => {
  const result = buildStatusBarState({
    connected: false,
    sessionState: "idle",
    pendingPermissions: 0,
  })

  assert.ok(result.text.includes("OpenCode GUI"))
  assert.ok(result.tooltip.includes("Server: disconnected"))
})
