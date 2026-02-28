import assert from "node:assert/strict"
import test from "node:test"
import { toWorkspaceRelativePath } from "../workspacePath"

test("toWorkspaceRelativePath: keeps valid workspace-relative paths", () => {
  assert.equal(toWorkspaceRelativePath("src/index.ts"), "src/index.ts")
  assert.equal(toWorkspaceRelativePath("src\\main.ts"), "src/main.ts")
  assert.equal(toWorkspaceRelativePath(" docs/readme.md "), "docs/readme.md")
})

test("toWorkspaceRelativePath: rejects traversal and absolute paths", () => {
  assert.equal(toWorkspaceRelativePath("../secret.txt"), undefined)
  assert.equal(toWorkspaceRelativePath("src/../../secret.txt"), undefined)
  assert.equal(toWorkspaceRelativePath("/etc/passwd"), undefined)
  assert.equal(toWorkspaceRelativePath("C:\\Users\\demo\\secret.txt"), undefined)
})
