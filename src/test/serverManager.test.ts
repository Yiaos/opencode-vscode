import test from "node:test"
import assert from "node:assert/strict"
import { parseServerUrlFromOutput } from "../serverManager"

test("parseServerUrlFromOutput: parses listen line", () => {
  const url = parseServerUrlFromOutput("opencode server listening on http://127.0.0.1:4096")
  assert.equal(url, "http://127.0.0.1:4096")
})

test("parseServerUrlFromOutput: supports extra logs before line", () => {
  const output = [
    "[info] starting...",
    "Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.",
    "opencode server listening on http://127.0.0.1:51234",
  ].join("\n")

  assert.equal(parseServerUrlFromOutput(output), "http://127.0.0.1:51234")
})

test("parseServerUrlFromOutput: returns undefined when line missing", () => {
  assert.equal(parseServerUrlFromOutput("starting server..."), undefined)
})
