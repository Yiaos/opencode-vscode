import test from "node:test"
import assert from "node:assert/strict"
import {
  buildFileContextPayload,
  buildFilesContextPayload,
  buildGitDiffContextPayload,
  buildSymbolContextPayload,
} from "../contextPayload"

test("buildFileContextPayload: wraps reference", () => {
  assert.equal(buildFileContextPayload("@src/index.ts#L42"), "In @src/index.ts#L42")
})

test("buildSymbolContextPayload: includes symbol and reference", () => {
  assert.equal(
    buildSymbolContextPayload({
      symbol: "createClient",
      fileRef: "@src/client.ts#L10-30",
    }),
    "Focus on symbol createClient in @src/client.ts#L10-30",
  )
})

test("buildFilesContextPayload: formats multiple file references", () => {
  assert.equal(
    buildFilesContextPayload(["@src/a.ts", "@src/b.ts#L10-20"]),
    "Use these files as context:\n- In @src/a.ts\n- In @src/b.ts#L10-20",
  )
})

test("buildGitDiffContextPayload: returns non-truncated payload when diff fits", () => {
  const result = buildGitDiffContextPayload({
    diff: "diff --git a/a.ts b/a.ts\n+hello",
    maxChars: 1000,
  })
  assert.equal(result.truncated, false)
  assert.ok(result.text.includes("```diff"))
  assert.ok(result.text.includes("+hello"))
})

test("buildGitDiffContextPayload: truncates large diff", () => {
  const result = buildGitDiffContextPayload({
    diff: "x".repeat(200),
    maxChars: 50,
  })
  assert.equal(result.truncated, true)
  assert.ok(result.text.includes("[diff truncated to fit context window]"))
})
