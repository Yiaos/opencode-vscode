import test from "node:test"
import assert from "node:assert/strict"
import { normalizePath, parseFileReference, toFileReference } from "../fileReference"

test("normalizePath: normalizes windows separators", () => {
  assert.equal(normalizePath("src\\index.ts"), "src/index.ts")
})

test("toFileReference: builds reference without line range", () => {
  assert.equal(toFileReference("src/main.ts"), "@src/main.ts")
})

test("toFileReference: builds single-line reference", () => {
  assert.equal(toFileReference("src/main.ts", { startLine: 42, endLine: 42 }), "@src/main.ts#L42")
})

test("toFileReference: builds multi-line reference", () => {
  assert.equal(toFileReference("src/main.ts", { startLine: 10, endLine: 18 }), "@src/main.ts#L10-18")
})

test("parseFileReference: parses path only", () => {
  assert.deepEqual(parseFileReference("@src/main.ts"), { path: "src/main.ts" })
})

test("parseFileReference: parses single line", () => {
  assert.deepEqual(parseFileReference("@src/main.ts#L12"), {
    path: "src/main.ts",
    range: { startLine: 12, endLine: 12 },
  })
})

test("parseFileReference: parses multi-line and normalizes inverted range", () => {
  assert.deepEqual(parseFileReference("@src/main.ts#L20-12"), {
    path: "src/main.ts",
    range: { startLine: 12, endLine: 20 },
  })
})

test("parseFileReference: rejects invalid references", () => {
  assert.equal(parseFileReference("src/main.ts"), undefined)
  assert.equal(parseFileReference("@"), undefined)
  assert.equal(parseFileReference("@#L1"), undefined)
})
