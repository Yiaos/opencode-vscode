import test from "node:test"
import assert from "node:assert/strict"
import { buildSessionPickItems, formatAge, sortSessionsForPicker } from "../sessionPicker"
import type { SessionSummary } from "../opencodeApi"

test("formatAge: formats age buckets", () => {
  assert.equal(formatAge(10_000), "just now")
  assert.equal(formatAge(2 * 60_000), "2m ago")
  assert.equal(formatAge(3 * 60 * 60_000), "3h ago")
  assert.equal(formatAge(2 * 24 * 60 * 60_000), "2d ago")
})

test("sortSessionsForPicker: filters archived and sorts by updated desc", () => {
  const sessions: SessionSummary[] = [
    { id: "a", directory: "/tmp/a", time: { updated: 100 } },
    { id: "b", directory: "/tmp/b", time: { updated: 300 } },
    { id: "c", directory: "/tmp/c", time: { updated: 200, archived: 201 } },
  ]
  const sorted = sortSessionsForPicker(sessions)
  assert.deepEqual(
    sorted.map((x) => x.id),
    ["b", "a"],
  )
})

test("buildSessionPickItems: builds quickpick labels", () => {
  const sessions: SessionSummary[] = [{ id: "s1", directory: "/tmp/project", title: "Feature Work", time: { updated: 0 } }]
  const picks = buildSessionPickItems({ sessions, now: 3 * 60_000 })
  assert.equal(picks.length, 1)
  assert.equal(picks[0].label, "Feature Work")
  assert.equal(picks[0].description, "s1")
  assert.ok(picks[0].detail.includes("/tmp/project"))
  assert.ok(picks[0].detail.includes("3m ago"))
})
