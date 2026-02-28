import assert from "node:assert/strict"
import test from "node:test"
import { parseSessionCommandInput } from "../sessionRuntimeInput"

test("parseSessionCommandInput: parses slash command and arguments", () => {
  assert.deepEqual(parseSessionCommandInput("/summarize src/index.ts"), {
    command: "summarize",
    arguments: "src/index.ts",
  })
})

test("parseSessionCommandInput: handles command without arguments", () => {
  assert.deepEqual(parseSessionCommandInput("compact"), {
    command: "compact",
    arguments: "",
  })
})

test("parseSessionCommandInput: trims spaces and handles empty input", () => {
  assert.equal(parseSessionCommandInput("   "), undefined)
  assert.equal(parseSessionCommandInput("/"), undefined)
})
