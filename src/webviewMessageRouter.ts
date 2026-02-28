export type WebviewMessageHandlers = {
  onReady(url: string): void
  onNewSession(): void
  onSessionMenu(): void
  onReviewPermissions(): void
  onAttachMenu(): void
  onSendContext(): void
  onPrompt(text: string): void
  onSwitchSession(): void
  onOpenPanel(): void
  onShowTodo(): void
  onShowDiff(): void
  onRunCommand(): void
  onRunShell(): void
  onAbortSession(): void
  onOpenReference(): void
  onRefresh(): void
  onFrameError(): void
}

export function dispatchWebviewMessage(message: unknown, handlers: WebviewMessageHandlers) {
  if (!message || typeof message !== "object") return
  const record = message as Record<string, unknown>
  const type = record.type
  if (typeof type !== "string") return

  if (type === "ready") {
    handlers.onReady(String(record.url ?? ""))
    return
  }
  if (type === "action-new-session") {
    handlers.onNewSession()
    return
  }
  if (type === "action-session-menu") {
    handlers.onSessionMenu()
    return
  }
  if (type === "action-review-permissions") {
    handlers.onReviewPermissions()
    return
  }
  if (type === "action-attach-menu") {
    handlers.onAttachMenu()
    return
  }
  if (type === "action-send-context") {
    handlers.onSendContext()
    return
  }
  if (type === "action-prompt") {
    const text = typeof record.text === "string" ? record.text : ""
    const normalized = text.trim()
    if (normalized) handlers.onPrompt(normalized)
    return
  }
  if (type === "action-switch-session") {
    handlers.onSwitchSession()
    return
  }
  if (type === "action-open-panel") {
    handlers.onOpenPanel()
    return
  }
  if (type === "action-show-todo") {
    handlers.onShowTodo()
    return
  }
  if (type === "action-show-diff") {
    handlers.onShowDiff()
    return
  }
  if (type === "action-run-command") {
    handlers.onRunCommand()
    return
  }
  if (type === "action-run-shell") {
    handlers.onRunShell()
    return
  }
  if (type === "action-abort-session") {
    handlers.onAbortSession()
    return
  }
  if (type === "action-open-reference") {
    handlers.onOpenReference()
    return
  }
  if (type === "action-refresh") {
    handlers.onRefresh()
    return
  }
  if (type === "frame-error") {
    handlers.onFrameError()
  }
}
