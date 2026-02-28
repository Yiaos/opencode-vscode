import test from "node:test"
import assert from "node:assert/strict"
import {
  createAuthHeader,
  forkSession,
  listConfigProviders,
  listPermissions,
  pickActiveSession,
  replyPermission,
  removeSession,
  renameSession,
  shareSession,
  summarizeSession,
  unshareSession,
  type SessionSummary,
} from "../opencodeApi"

test("createAuthHeader: returns undefined without password", () => {
  assert.equal(createAuthHeader({ username: "user", password: "" }), undefined)
  assert.equal(createAuthHeader(undefined), undefined)
})

test("createAuthHeader: encodes basic credentials", () => {
  assert.equal(createAuthHeader({ username: "alice", password: "secret" }), "Basic YWxpY2U6c2VjcmV0")
})

test("pickActiveSession: chooses latest non-archived session", () => {
  const sessions: SessionSummary[] = [
    {
      id: "old",
      directory: "/tmp",
      time: { updated: 10 },
    },
    {
      id: "archived",
      directory: "/tmp",
      time: { updated: 20, archived: 21 },
    },
    {
      id: "latest",
      directory: "/tmp",
      time: { updated: 30 },
    },
  ]

  const picked = pickActiveSession(sessions)
  assert.equal(picked?.id, "latest")
})

test("session mutation APIs: call expected routes", async () => {
  const requests: Array<{ url: string; method: string }> = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method || "GET",
    })
    return new Response(
      JSON.stringify({
        id: "s1",
        directory: "/tmp/demo",
        title: "demo",
        time: { updated: 1 },
        share: { url: "https://share.example/s1" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }) as typeof fetch

  try {
    await renameSession({
      serverUrl: "http://127.0.0.1:4096",
      sessionID: "s1",
      title: "Renamed",
    })
    await removeSession({
      serverUrl: "http://127.0.0.1:4096",
      sessionID: "s1",
    })
    await forkSession({
      serverUrl: "http://127.0.0.1:4096",
      sessionID: "s1",
    })
    await shareSession({
      serverUrl: "http://127.0.0.1:4096",
      sessionID: "s1",
    })
    await unshareSession({
      serverUrl: "http://127.0.0.1:4096",
      sessionID: "s1",
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(
    requests.map((r) => `${r.method} ${r.url}`),
    [
      "PATCH http://127.0.0.1:4096/session/s1",
      "DELETE http://127.0.0.1:4096/session/s1",
      "POST http://127.0.0.1:4096/session/s1/fork",
      "POST http://127.0.0.1:4096/session/s1/share",
      "DELETE http://127.0.0.1:4096/session/s1/share",
    ],
  )
})

test("config providers API: parses providers and defaults", async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        providers: [
          {
            id: "openai",
            name: "OpenAI",
            models: {
              "gpt-5": { id: "gpt-5", name: "GPT-5" },
              "gpt-5-mini": { id: "gpt-5-mini", name: "GPT-5 Mini" },
            },
          },
        ],
        default: {
          openai: "gpt-5",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }) as typeof fetch

  try {
    const result = await listConfigProviders({
      serverUrl: "http://127.0.0.1:4096",
    })

    assert.equal(result.providers.length, 1)
    assert.equal(result.providers[0].id, "openai")
    assert.equal(result.default.openai, "gpt-5")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("summarizeSession API: calls expected route with model payload", async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method || "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    })
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch

  try {
    await summarizeSession({
      serverUrl: "http://127.0.0.1:4096",
      sessionID: "s1",
      providerID: "openai",
      modelID: "gpt-5",
      auto: false,
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, "POST")
  assert.equal(requests[0].url, "http://127.0.0.1:4096/session/s1/summarize")
  assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
    providerID: "openai",
    modelID: "gpt-5",
    auto: false,
  })
})

test("permission APIs: list and reply call expected routes", async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method || "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    })
    if (String(input).endsWith("/permission")) {
      return new Response(
        JSON.stringify([
          {
            id: "permission_1",
            sessionID: "session_1",
            permission: "edit",
            patterns: ["src/**"],
            metadata: {},
            always: ["src/**"],
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch

  try {
    const list = await listPermissions({
      serverUrl: "http://127.0.0.1:4096",
    })
    assert.equal(list.length, 1)
    assert.equal(list[0].id, "permission_1")

    await replyPermission({
      serverUrl: "http://127.0.0.1:4096",
      requestID: "permission_1",
      reply: "once",
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(requests[0].method, "GET")
  assert.equal(requests[0].url, "http://127.0.0.1:4096/permission")
  assert.equal(requests[1].method, "POST")
  assert.equal(requests[1].url, "http://127.0.0.1:4096/permission/permission_1/reply")
  assert.deepEqual(JSON.parse(requests[1].body || "{}"), {
    reply: "once",
  })
})
