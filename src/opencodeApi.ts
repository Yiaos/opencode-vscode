export type SessionSummary = {
  id: string
  directory: string
  title?: string
  share?: {
    url: string
  }
  time: {
    updated: number
    archived?: number
  }
}

export type ProviderModel = {
  id: string
  name?: string
}

export type ProviderSummary = {
  id: string
  name: string
  models: Record<string, ProviderModel>
}

export type ConfigProviders = {
  providers: ProviderSummary[]
  default: Record<string, string>
}

export type PermissionRequest = {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: {
    messageID: string
    callID: string
  }
}

export type PermissionReply = "once" | "always" | "reject"

export type SessionTodo = {
  id: string
  content: string
  status: string
  priority: string
}

export type SessionFileDiff = {
  [key: string]: unknown
}

export type ServerAuth = {
  username?: string
  password?: string
}

export function createAuthHeader(auth?: ServerAuth) {
  if (!auth?.password) return
  const username = auth.username || "opencode"
  return `Basic ${Buffer.from(`${username}:${auth.password}`).toString("base64")}`
}

export function pickActiveSession(sessions: SessionSummary[]) {
  return sessions
    .filter((session) => !session.time.archived)
    .sort((a, b) => b.time.updated - a.time.updated)[0]
}

function toSessionSummary(data: Partial<SessionSummary>): SessionSummary {
  if (!data.id || !data.directory || !data.time) {
    throw new Error("Invalid session response")
  }
  return {
    id: data.id,
    directory: data.directory,
    title: data.title,
    share: data.share,
    time: {
      updated: data.time.updated,
      archived: data.time.archived,
    },
  }
}

function toConfigProviders(data: unknown): ConfigProviders {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid config providers response")
  }

  const rawProviders = (data as { providers?: unknown }).providers
  const rawDefault = (data as { default?: unknown }).default
  if (!Array.isArray(rawProviders) || !rawDefault || typeof rawDefault !== "object") {
    throw new Error("Invalid config providers response")
  }

  const providers = rawProviders.map((provider) => {
    if (!provider || typeof provider !== "object") {
      throw new Error("Invalid config providers response")
    }

    const id = (provider as { id?: unknown }).id
    const name = (provider as { name?: unknown }).name
    const models = (provider as { models?: unknown }).models
    if (typeof id !== "string" || typeof name !== "string" || !models || typeof models !== "object") {
      throw new Error("Invalid config providers response")
    }

    const mappedModels: Record<string, ProviderModel> = {}
    for (const [modelKey, rawModel] of Object.entries(models as Record<string, unknown>)) {
      if (!rawModel || typeof rawModel !== "object") continue
      const rawID = (rawModel as { id?: unknown }).id
      const rawName = (rawModel as { name?: unknown }).name
      const modelID = typeof rawID === "string" ? rawID : modelKey
      mappedModels[modelID] = {
        id: modelID,
        name: typeof rawName === "string" ? rawName : undefined,
      }
    }

    return { id, name, models: mappedModels }
  })

  const defaults: Record<string, string> = {}
  for (const [providerID, modelID] of Object.entries(rawDefault as Record<string, unknown>)) {
    if (typeof modelID === "string") {
      defaults[providerID] = modelID
    }
  }

  return { providers, default: defaults }
}

function toPermissionRequest(data: unknown): PermissionRequest {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid permission response")
  }
  const value = data as Record<string, unknown>
  if (typeof value.id !== "string") throw new Error("Invalid permission response")
  if (typeof value.sessionID !== "string") throw new Error("Invalid permission response")
  if (typeof value.permission !== "string") throw new Error("Invalid permission response")

  return {
    id: value.id,
    sessionID: value.sessionID,
    permission: value.permission,
    patterns: Array.isArray(value.patterns) ? value.patterns.filter((x): x is string => typeof x === "string") : [],
    metadata: value.metadata && typeof value.metadata === "object" ? (value.metadata as Record<string, unknown>) : {},
    always: Array.isArray(value.always) ? value.always.filter((x): x is string => typeof x === "string") : [],
    tool:
      value.tool && typeof value.tool === "object"
        ? {
            messageID: typeof (value.tool as { messageID?: unknown }).messageID === "string"
              ? (value.tool as { messageID: string }).messageID
              : "",
            callID: typeof (value.tool as { callID?: unknown }).callID === "string"
              ? (value.tool as { callID: string }).callID
              : "",
          }
        : undefined,
  }
}

function toSessionTodo(data: unknown): SessionTodo {
  if (!data || typeof data !== "object") throw new Error("Invalid todo response")
  const value = data as Record<string, unknown>
  if (typeof value.id !== "string") throw new Error("Invalid todo response")
  if (typeof value.content !== "string") throw new Error("Invalid todo response")
  if (typeof value.status !== "string") throw new Error("Invalid todo response")
  if (typeof value.priority !== "string") throw new Error("Invalid todo response")
  return {
    id: value.id,
    content: value.content,
    status: value.status,
    priority: value.priority,
  }
}

function headers(input: { auth?: ServerAuth; directory?: string; extra?: Record<string, string> }) {
  const next: Record<string, string> = { ...(input.extra || {}) }
  const authHeader = createAuthHeader(input.auth)
  if (authHeader) next.Authorization = authHeader
  if (input.directory) next["x-opencode-directory"] = input.directory
  return next
}

export async function createSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
}): Promise<SessionSummary> {
  const response = await fetch(`${input.serverUrl}/session`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({}),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Partial<SessionSummary>
  return toSessionSummary(data)
}

export async function listSessions(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  limit?: number
}): Promise<SessionSummary[]> {
  const url = new URL(`${input.serverUrl}/session`)
  if (input.limit) url.searchParams.set("limit", String(input.limit))
  const response = await fetch(url, {
    headers: headers({
      auth: input.auth,
      directory: input.directory,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Partial<SessionSummary>[]
  if (!Array.isArray(data)) throw new Error("Invalid session list response")
  return data.map((item) => toSessionSummary(item))
}

export async function promptSessionWithText(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
  text: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/message`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({
      parts: [{ type: "text", text: input.text }],
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function abortSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/abort`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({}),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function renameSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
  title: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}`, {
    method: "PATCH",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({ title: input.title }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Partial<SessionSummary>
  return toSessionSummary(data)
}

export async function removeSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}`, {
    method: "DELETE",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function forkSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/fork`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({}),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Partial<SessionSummary>
  return toSessionSummary(data)
}

export async function shareSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/share`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({}),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Partial<SessionSummary>
  return toSessionSummary(data)
}

export async function summarizeSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
  providerID: string
  modelID: string
  auto?: boolean
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/summarize`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({
      providerID: input.providerID,
      modelID: input.modelID,
      auto: input.auto ?? false,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function listConfigProviders(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
}): Promise<ConfigProviders> {
  const response = await fetch(`${input.serverUrl}/config/providers`, {
    headers: headers({
      auth: input.auth,
      directory: input.directory,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  return toConfigProviders(data)
}

export async function listPermissions(input: {
  serverUrl: string
  auth?: ServerAuth
}): Promise<PermissionRequest[]> {
  const response = await fetch(`${input.serverUrl}/permission`, {
    headers: headers({
      auth: input.auth,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error("Invalid permission list response")
  return data.map((item) => toPermissionRequest(item))
}

export async function replyPermission(input: {
  serverUrl: string
  auth?: ServerAuth
  requestID: string
  reply: PermissionReply
  message?: string
}) {
  const response = await fetch(`${input.serverUrl}/permission/${input.requestID}/reply`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({
      reply: input.reply,
      message: input.message,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function listSessionTodos(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
}): Promise<SessionTodo[]> {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/todo`, {
    headers: headers({
      auth: input.auth,
      directory: input.directory,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error("Invalid todo list response")
  return data.map((item) => toSessionTodo(item))
}

export async function getSessionDiff(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
  messageID?: string
}): Promise<SessionFileDiff[]> {
  const url = new URL(`${input.serverUrl}/session/${input.sessionID}/diff`)
  if (input.messageID) url.searchParams.set("messageID", input.messageID)
  const response = await fetch(url, {
    headers: headers({
      auth: input.auth,
      directory: input.directory,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data)) throw new Error("Invalid diff response")
  return data as SessionFileDiff[]
}

export async function runSessionCommand(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
  command: string
  arguments: string
  agent?: string
  model?: string
  messageID?: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/command`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({
      command: input.command,
      arguments: input.arguments,
      agent: input.agent,
      model: input.model,
      messageID: input.messageID,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function runSessionShell(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
  command: string
  agent: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/shell`, {
    method: "POST",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
      extra: { "Content-Type": "application/json" },
    }),
    body: JSON.stringify({
      command: input.command,
      agent: input.agent,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response
}

export async function unshareSession(input: {
  serverUrl: string
  auth?: ServerAuth
  directory?: string
  sessionID: string
}) {
  const response = await fetch(`${input.serverUrl}/session/${input.sessionID}/share`, {
    method: "DELETE",
    headers: headers({
      auth: input.auth,
      directory: input.directory,
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Partial<SessionSummary>
  return toSessionSummary(data)
}
