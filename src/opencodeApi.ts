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
