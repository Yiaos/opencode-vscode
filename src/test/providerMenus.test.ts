import test from "node:test"
import assert from "node:assert/strict"
import { ATTACH_ACTION_ITEMS, SESSION_ACTION_ITEMS } from "../providerMenus"

test("SESSION_ACTION_ITEMS: contains expected order and action ids", () => {
  assert.deepEqual(
    SESSION_ACTION_ITEMS.map((item) => item.id),
    [
      "new",
      "switch",
      "compact",
      "review-permissions",
      "attach-file",
      "attach-symbol",
      "attach-diff",
      "rename",
      "fork",
      "share",
      "unshare",
      "stop",
      "delete",
    ],
  )
})

test("ATTACH_ACTION_ITEMS: contains expected actions", () => {
  assert.deepEqual(
    ATTACH_ACTION_ITEMS.map((item) => item.id),
    ["active", "file", "symbol", "diff"],
  )
})
