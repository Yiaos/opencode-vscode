import type { GlobalEventEnvelope } from "./serverEvents"
import type { SessionInfo } from "./sessionUrl"
import type { SessionRuntimeState } from "./statusBarState"

export type ServerEventDecision = {
  refreshPermissions: boolean
  nextSession?: SessionInfo
  nextState?: SessionRuntimeState
}

export function decideServerEvent(input: {
  event: GlobalEventEnvelope
  activeSession?: SessionInfo
}): ServerEventDecision {
  const { event, activeSession } = input
  const payload = event.payload
  if (!payload || typeof payload.type !== "string") {
    return { refreshPermissions: false }
  }

  if (
    payload.type === "permission.asked" ||
    payload.type === "permission.replied" ||
    payload.type === "permission.updated"
  ) {
    return { refreshPermissions: true }
  }

  if (payload.type === "session.created" || payload.type === "session.updated") {
    if (activeSession) return { refreshPermissions: false }
    const info = readInfo(payload.properties)
    return {
      refreshPermissions: false,
      nextSession: info,
    }
  }

  if (payload.type === "session.status") {
    const properties = payload.properties || {}
    const sessionID = typeof properties.sessionID === "string" ? properties.sessionID : undefined
    const statusType = readStatusType(properties.status)
    if (!sessionID || !statusType) return { refreshPermissions: false }

    if (activeSession && activeSession.id !== sessionID) {
      if (statusType !== "busy" && statusType !== "retry") return { refreshPermissions: false }
      const directory = readDirectory(event.directory)
      if (!directory) {
        return {
          refreshPermissions: false,
          nextState: statusType,
        }
      }
      return {
        refreshPermissions: false,
        nextSession: { id: sessionID, directory },
        nextState: statusType,
      }
    }

    const directory = readDirectory(event.directory)
    return {
      refreshPermissions: false,
      nextSession: !activeSession && directory ? { id: sessionID, directory } : undefined,
      nextState: statusType,
    }
  }

  if (payload.type === "session.idle") {
    const properties = payload.properties || {}
    const sessionID = typeof properties.sessionID === "string" ? properties.sessionID : undefined
    if (!sessionID) return { refreshPermissions: false }
    if (activeSession && activeSession.id !== sessionID) return { refreshPermissions: false }

    const directory = readDirectory(event.directory)
    return {
      refreshPermissions: false,
      nextSession: !activeSession && directory ? { id: sessionID, directory } : undefined,
      nextState: "idle",
    }
  }

  if (payload.type === "session.error") {
    const properties = payload.properties || {}
    const sessionID = typeof properties.sessionID === "string" ? properties.sessionID : undefined
    if (sessionID && activeSession && activeSession.id !== sessionID) return { refreshPermissions: false }

    const directory = readDirectory(event.directory)
    return {
      refreshPermissions: false,
      nextSession: !activeSession && sessionID && directory ? { id: sessionID, directory } : undefined,
      nextState: "error",
    }
  }

  return { refreshPermissions: false }
}

function readStatusType(value: unknown): SessionRuntimeState | undefined {
  if (!value || typeof value !== "object") return
  const type = (value as { type?: unknown }).type
  if (type === "idle" || type === "busy" || type === "retry") return type
}

function readInfo(value: unknown): SessionInfo | undefined {
  if (!value || typeof value !== "object") return
  const info = (value as { info?: unknown }).info
  if (!info || typeof info !== "object") return
  const record = info as { id?: unknown; directory?: unknown }
  if (typeof record.id !== "string") return
  if (typeof record.directory !== "string") return
  return { id: record.id, directory: record.directory }
}

function readDirectory(value: unknown) {
  if (typeof value !== "string") return
  if (value === "global") return
  return value
}
