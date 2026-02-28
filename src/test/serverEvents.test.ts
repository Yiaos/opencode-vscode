import test from "node:test"
import assert from "node:assert/strict"
import { parseSseDataLine } from "../serverEvents"

test("parseSseDataLine: parses valid data event line", () => {
  const line = 'data: {"directory":"global","payload":{"type":"session.idle","properties":{"sessionID":"s1"}}}'
  const result = parseSseDataLine(line)
  assert.equal(result?.payload?.type, "session.idle")
})

test("parseSseDataLine: ignores non-data lines", () => {
  assert.equal(parseSseDataLine("event: message"), undefined)
  assert.equal(parseSseDataLine(""), undefined)
})
