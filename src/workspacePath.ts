import path from "node:path"

function normalizeRelativePath(input: string) {
  return input.replace(/\\/g, "/")
}

export function toWorkspaceRelativePath(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return

  const normalized = normalizeRelativePath(trimmed)
  if (normalized.includes("\0")) return
  if (path.isAbsolute(normalized)) return
  if (/^[A-Za-z]:\//.test(normalized)) return
  if (normalized.startsWith("/")) return

  const segments = normalized.split("/").filter(Boolean)
  if (segments.length === 0) return
  if (segments.some((segment) => segment === "." || segment === "..")) return
  return segments.join("/")
}
