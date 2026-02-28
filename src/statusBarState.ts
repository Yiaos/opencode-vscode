export type SessionRuntimeState = "idle" | "busy" | "retry" | "error"

export function buildStatusBarState(input: {
  connected: boolean
  serverUrl?: string
  sessionState: SessionRuntimeState
  pendingPermissions: number
}) {
  const parts = ["$(globe) OpenCode GUI"]
  if (input.connected) parts.push("Connected")

  if (input.sessionState === "busy") parts.push("$(sync~spin)")
  if (input.sessionState === "retry") parts.push("$(history)")
  if (input.sessionState === "error") parts.push("$(error)")

  if (input.pendingPermissions > 0) {
    parts.push(`$(warning)${input.pendingPermissions}`)
  }

  const tooltipLines = [
    input.serverUrl ? `Server: ${input.serverUrl}` : "Server: disconnected",
    `Session: ${input.sessionState}`,
    `Pending approvals: ${input.pendingPermissions}`,
  ]

  return {
    text: parts.join(" "),
    tooltip: tooltipLines.join("\n"),
  }
}
