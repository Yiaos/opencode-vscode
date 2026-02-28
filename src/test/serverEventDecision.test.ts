import assert from "node:assert/strict"
import test from "node:test"
import { decideServerEvent } from "../serverEventDecision"

test("decideServerEvent: refreshes pending permissions on permission events", () => {
  const decision = decideServerEvent({
    event: {
      directory: "/tmp/demo",
      payload: { type: "permission.asked", properties: {} },
    },
  })
  assert.equal(decision.refreshPermissions, true)
})

test("decideServerEvent: switches active session on busy status from another session", () => {
  const decision = decideServerEvent({
    activeSession: {
      id: "session_old",
      directory: "/tmp/demo",
    },
    event: {
      directory: "/tmp/demo",
      payload: {
        type: "session.status",
        properties: {
          sessionID: "session_new",
          status: { type: "busy" },
        },
      },
    },
  })
  assert.deepEqual(decision.nextSession, { id: "session_new", directory: "/tmp/demo" })
  assert.equal(decision.nextState, "busy")
})

test("decideServerEvent: ignores idle from non-active session", () => {
  const decision = decideServerEvent({
    activeSession: {
      id: "session_current",
      directory: "/tmp/demo",
    },
    event: {
      directory: "/tmp/demo",
      payload: {
        type: "session.idle",
        properties: {
          sessionID: "session_other",
        },
      },
    },
  })
  assert.equal(decision.nextSession, undefined)
  assert.equal(decision.nextState, undefined)
})

test("decideServerEvent: picks first session from created event when no active", () => {
  const decision = decideServerEvent({
    event: {
      directory: "/tmp/demo",
      payload: {
        type: "session.created",
        properties: {
          info: {
            id: "session_1",
            directory: "/tmp/demo",
          },
        },
      },
    },
  })
  assert.deepEqual(decision.nextSession, { id: "session_1", directory: "/tmp/demo" })
})

test("decideServerEvent: marks session error for active session", () => {
  const decision = decideServerEvent({
    activeSession: {
      id: "session_1",
      directory: "/tmp/demo",
    },
    event: {
      directory: "/tmp/demo",
      payload: {
        type: "session.error",
        properties: {
          sessionID: "session_1",
        },
      },
    },
  })
  assert.equal(decision.nextState, "error")
})
