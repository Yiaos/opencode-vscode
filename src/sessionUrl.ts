export type SessionInfo = {
  id: string
  directory: string
}

export function buildSessionUrl(serverUrl: string, session: SessionInfo) {
  const base = serverUrl.replace(/\/+$/, "")
  const directory = encodeURIComponent(session.directory)
  return `${base}/${directory}/session/${session.id}`
}

export function parseSessionUrl(url: string) {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split("/").filter(Boolean)
    if (segments.length < 3) return
    if (segments[1] !== "session") return
    const directory = decodeURIComponent(segments[0])
    const id = segments[2]
    if (!directory || !id) return
    return { id, directory }
  } catch {
    return
  }
}
