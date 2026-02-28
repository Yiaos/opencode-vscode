import test from "node:test"
import assert from "node:assert/strict"
import { buildSessionUrl, parseSessionUrl } from "../sessionUrl"

test("buildSessionUrl: encodes directory into route segment", () => {
  const url = buildSessionUrl("http://127.0.0.1:4096", {
    id: "session_123",
    directory: "/Users/test/work space/project",
  })

  assert.equal(url, "http://127.0.0.1:4096/%2FUsers%2Ftest%2Fwork%20space%2Fproject/session/session_123")
})

test("buildSessionUrl: trims trailing slash from base url", () => {
  const url = buildSessionUrl("http://127.0.0.1:4096/", {
    id: "s1",
    directory: "/tmp/demo",
  })

  assert.equal(url, "http://127.0.0.1:4096/%2Ftmp%2Fdemo/session/s1")
})

test("parseSessionUrl: parses session id and directory", () => {
  const parsed = parseSessionUrl("http://127.0.0.1:4096/%2Ftmp%2Fdemo/session/s1")
  assert.deepEqual(parsed, { id: "s1", directory: "/tmp/demo" })
})

test("parseSessionUrl: returns undefined for non-session path", () => {
  assert.equal(parseSessionUrl("http://127.0.0.1:4096/project/list"), undefined)
})
