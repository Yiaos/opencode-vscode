import type { SessionSummary } from "./opencodeApi"
import type { SessionInfo } from "./sessionUrl"

export type SessionPickItem = {
  label: string
  description: string
  detail: string
  session: SessionInfo
}

export function sortSessionsForPicker(sessions: SessionSummary[]) {
  return sessions
    .filter((session) => !session.time.archived)
    .sort((a, b) => b.time.updated - a.time.updated)
}

export function buildSessionPickItems(input: { sessions: SessionSummary[]; now?: number }) {
  const now = input.now ?? Date.now()
  return sortSessionsForPicker(input.sessions).map((session) => {
    const title = session.title?.trim() || session.id
    const detail = `${session.directory} • ${formatAge(now - session.time.updated)}`
    return {
      label: title,
      description: session.id,
      detail,
      session: {
        id: session.id,
        directory: session.directory,
      },
    } satisfies SessionPickItem
  })
}

export function formatAge(deltaMs: number) {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return "just now"
  const sec = Math.floor(deltaMs / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}h ago`
  const day = Math.floor(hour / 24)
  return `${day}d ago`
}
