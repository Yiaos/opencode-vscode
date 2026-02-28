import * as vscode from "vscode"
import type { ServerAuth } from "./opencodeApi"
import {
  abortSession,
  createSession,
  forkSession as apiForkSession,
  getSessionDiff,
  listConfigProviders,
  listPermissions,
  listSessions,
  listSessionTodos,
  pickActiveSession,
  promptSessionWithText,
  replyPermission,
  removeSession,
  renameSession as apiRenameSession,
  runSessionCommand,
  runSessionShell,
  shareSession as apiShareSession,
  summarizeSession as apiSummarizeSession,
  unshareSession as apiUnshareSession,
} from "./opencodeApi"
import { buildSessionPickItems } from "./sessionPicker"
import { parseSessionCommandInput } from "./sessionRuntimeInput"
import { buildSessionUrl, type SessionInfo } from "./sessionUrl"

type CompactionModel = {
  providerID: string
  modelID: string
}

export type ProviderSessionHost = {
  ensureServerRunning(): Promise<string>
  serverAuth(): ServerAuth | undefined
  defaultDirectory(): string | undefined
  getActiveSession(): SessionInfo | undefined
  setActiveSession(session: SessionInfo | undefined): void
  open(): Promise<void>
  navigateWebviews(url: string): Promise<void>
  refresh(): Promise<void>
}

export class ProviderSessionActions {
  constructor(private readonly host: ProviderSessionHost) {}

  async newSession() {
    try {
      const serverUrl = await this.host.ensureServerRunning()
      const session = await createSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: this.host.defaultDirectory(),
      })
      this.host.setActiveSession({ id: session.id, directory: session.directory })
      await this.host.open()
      await this.host.navigateWebviews(buildSessionUrl(serverUrl, session))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to create OpenCode session: ${message}`)
    }
  }

  async switchSession() {
    try {
      const serverUrl = await this.host.ensureServerRunning()
      const session = await this.pickSession("Switch OpenCode Session")
      if (!session) {
        await vscode.window.showInformationMessage("No sessions found")
        return
      }
      this.host.setActiveSession(session)
      await this.host.navigateWebviews(buildSessionUrl(serverUrl, session))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to switch session: ${message}`)
    }
  }

  async abortActiveSession() {
    const active = await this.resolveSessionForAction("Select Session To Stop")
    if (!active) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      await abortSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: active.directory,
        sessionID: active.id,
      })
      await vscode.window.showInformationMessage("Requested session stop")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to stop session: ${message}`)
    }
  }

  async renameSession() {
    const session = await this.resolveSessionForAction("Select Session To Rename")
    if (!session) return

    const next = await vscode.window.showInputBox({
      title: "Rename OpenCode Session",
      prompt: "Enter new session title",
      value: session.id,
      validateInput: (value) => (value.trim() ? undefined : "Title cannot be empty"),
    })
    if (!next) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      const updated = await apiRenameSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
        title: next.trim(),
      })
      const nextSession = { id: updated.id, directory: updated.directory }
      this.host.setActiveSession(nextSession)
      await this.host.navigateWebviews(buildSessionUrl(serverUrl, nextSession))
      await vscode.window.showInformationMessage("Session renamed")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to rename session: ${message}`)
    }
  }

  async deleteSession() {
    const session = await this.resolveSessionForAction("Select Session To Delete")
    if (!session) return
    const confirmed = await vscode.window.showWarningMessage(
      `Delete session ${session.id}? This cannot be undone.`,
      { modal: true },
      "Delete",
    )
    if (confirmed !== "Delete") return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      await removeSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
      })

      if (this.host.getActiveSession()?.id === session.id) {
        this.host.setActiveSession(undefined)
      }
      await this.host.refresh()
      await vscode.window.showInformationMessage("Session deleted")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to delete session: ${message}`)
    }
  }

  async forkSession() {
    const session = await this.resolveSessionForAction("Select Session To Fork")
    if (!session) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      const forked = await apiForkSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
      })
      const next = { id: forked.id, directory: forked.directory }
      this.host.setActiveSession(next)
      await this.host.navigateWebviews(buildSessionUrl(serverUrl, next))
      await vscode.window.showInformationMessage("Session forked")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to fork session: ${message}`)
    }
  }

  async shareSession() {
    const session = await this.resolveSessionForAction("Select Session To Share")
    if (!session) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      const shared = await apiShareSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
      })
      const url = shared.share?.url
      if (!url) {
        await vscode.window.showErrorMessage("Session shared but no URL was returned")
        return
      }
      await vscode.env.clipboard.writeText(url)
      await vscode.window.showInformationMessage(`Share link copied: ${url}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to share session: ${message}`)
    }
  }

  async unshareSession() {
    const session = await this.resolveSessionForAction("Select Session To Unshare")
    if (!session) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      await apiUnshareSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
      })
      await vscode.window.showInformationMessage("Session unshared")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to unshare session: ${message}`)
    }
  }

  async compactSession() {
    const session = await this.resolveSessionForAction("Select Session To Compact")
    if (!session) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      const model = await this.pickCompactionModel(serverUrl, session.directory)
      if (!model) return

      await apiSummarizeSession({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
        providerID: model.providerID,
        modelID: model.modelID,
      })
      await vscode.window.showInformationMessage(`Session compact requested: ${model.providerID}/${model.modelID}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to compact session: ${message}`)
    }
  }

  async reviewPermissions() {
    try {
      const serverUrl = await this.host.ensureServerRunning()
      const pending = await listPermissions({
        serverUrl,
        auth: this.host.serverAuth(),
      })
      if (pending.length === 0) {
        await vscode.window.showInformationMessage("No pending permissions")
        return
      }

      const picked = await vscode.window.showQuickPick(
        pending.map((item) => ({
          label: item.permission,
          description: item.sessionID,
          detail: item.patterns.join(", ") || "No patterns",
          permission: item,
        })),
        {
          title: "Pending Permissions",
          matchOnDescription: true,
          matchOnDetail: true,
        },
      )
      if (!picked) return

      const action = await vscode.window.showQuickPick(
        [
          { label: "Allow Once", id: "once" as const },
          { label: "Always Allow", id: "always" as const },
          { label: "Reject", id: "reject" as const },
        ],
        { title: `Permission: ${picked.permission.permission}` },
      )
      if (!action) return

      let message: string | undefined
      if (action.id === "reject") {
        message = await vscode.window.showInputBox({
          title: "Reject Permission",
          prompt: "Optional reason",
          placeHolder: "Reason (optional)",
        })
      }

      await replyPermission({
        serverUrl,
        auth: this.host.serverAuth(),
        requestID: picked.permission.id,
        reply: action.id,
        message: message?.trim() || undefined,
      })
      await vscode.window.showInformationMessage(`Permission replied: ${action.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to review permissions: ${message}`)
    }
  }

  async showSessionTodo() {
    const session = await this.resolveSessionForAction("Select Session To View Todo")
    if (!session) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      const todos = await listSessionTodos({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
      })
      if (todos.length === 0) {
        await vscode.window.showInformationMessage("No todos in this session")
        return
      }

      await vscode.window.showQuickPick(
        todos.map((todo) => ({
          label: `[${todo.status}] ${todo.content}`,
          description: todo.priority,
          detail: todo.id,
        })),
        {
          title: `Session Todo (${todos.length})`,
          matchOnDescription: true,
          matchOnDetail: true,
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to load session todo: ${message}`)
    }
  }

  async showSessionDiff() {
    const session = await this.resolveSessionForAction("Select Session To View Diff")
    if (!session) return

    const messageID = await vscode.window.showInputBox({
      title: "Session Diff",
      prompt: "Optional message ID filter",
      placeHolder: "message_xxx (leave empty for latest)",
      validateInput: (value) => {
        if (!value.trim()) return undefined
        return value.trim().length > 2 ? undefined : "Message ID seems too short"
      },
    })
    if (messageID === undefined) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      const diff = await getSessionDiff({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
        messageID: messageID?.trim() || undefined,
      })
      if (diff.length === 0) {
        await vscode.window.showInformationMessage("No diff found for this session")
        return
      }

      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(diff, null, 2),
        language: "json",
      })
      await vscode.window.showTextDocument(doc, { preview: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to load session diff: ${message}`)
    }
  }

  async runSessionCommandAction() {
    const session = await this.resolveSessionForAction("Select Session To Run Command")
    if (!session) return

    const raw = await vscode.window.showInputBox({
      title: "Run Session Command",
      prompt: "Input command with args. Example: /summarize this file",
      placeHolder: "/command arguments...",
      validateInput: (value) => (value.trim() ? undefined : "Command cannot be empty"),
    })
    if (!raw) return

    const parsed = parseSessionCommandInput(raw)
    if (!parsed) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      await runSessionCommand({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
        command: parsed.command,
        arguments: parsed.arguments,
      })
      await vscode.window.showInformationMessage(`Session command executed: /${parsed.command}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to run session command: ${message}`)
    }
  }

  async runSessionShellAction() {
    const session = await this.resolveSessionForAction("Select Session To Run Shell")
    if (!session) return

    const command = await vscode.window.showInputBox({
      title: "Run Session Shell",
      prompt: "Shell command to execute in session context",
      placeHolder: "git status",
      validateInput: (value) => (value.trim() ? undefined : "Shell command cannot be empty"),
    })
    if (!command) return

    const agent = await vscode.window.showInputBox({
      title: "Session Shell Agent",
      prompt: "Agent name",
      value: "build",
      validateInput: (value) => (value.trim() ? undefined : "Agent cannot be empty"),
    })
    if (!agent) return

    try {
      const serverUrl = await this.host.ensureServerRunning()
      await runSessionShell({
        serverUrl,
        auth: this.host.serverAuth(),
        directory: session.directory,
        sessionID: session.id,
        command: command.trim(),
        agent: agent.trim(),
      })
      await vscode.window.showInformationMessage("Session shell command executed")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to run session shell: ${message}`)
    }
  }

  async sendTextContext(text: string, successMessage: string) {
    await this.host.open()

    try {
      const state = await this.ensurePromptSession()
      const send = async (target: SessionInfo) => {
        await promptSessionWithText({
          serverUrl: state.serverUrl,
          auth: state.auth,
          directory: target.directory,
          sessionID: target.id,
          text,
        })
      }

      try {
        await send(state.session)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes("HTTP 404")) throw error
        const created = await createSession({
          serverUrl: state.serverUrl,
          auth: state.auth,
          directory: state.directory,
        })
        state.session = { id: created.id, directory: created.directory }
        await send(state.session)
      }

      this.host.setActiveSession(state.session)
      await this.host.navigateWebviews(buildSessionUrl(state.serverUrl, state.session))
      await vscode.window.showInformationMessage(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to send context: ${message}`)
    }
  }

  private async resolveSessionForAction(title: string) {
    const active = this.host.getActiveSession()
    if (active) return active
    const picked = await this.pickSession(title)
    if (!picked) {
      await vscode.window.showInformationMessage("No OpenCode session selected")
      return
    }
    this.host.setActiveSession(picked)
    return picked
  }

  private async pickSession(title: string) {
    const serverUrl = await this.host.ensureServerRunning()
    const sessions = await listSessions({
      serverUrl,
      auth: this.host.serverAuth(),
      directory: this.host.defaultDirectory(),
      limit: 100,
    })
    const items = buildSessionPickItems({ sessions })
    if (items.length === 0) return
    const picked = await vscode.window.showQuickPick(items, {
      title,
      matchOnDescription: true,
      matchOnDetail: true,
    })
    return picked?.session
  }

  private async pickCompactionModel(serverUrl: string, directory?: string) {
    const result = await listConfigProviders({
      serverUrl,
      auth: this.host.serverAuth(),
      directory,
    })

    const items: Array<vscode.QuickPickItem & CompactionModel> = []
    for (const provider of result.providers) {
      const modelID = result.default[provider.id] || Object.keys(provider.models)[0]
      if (!modelID) continue
      const model = provider.models[modelID]
      items.push({
        label: provider.name,
        description: provider.id,
        detail: `${model?.name || modelID} (${modelID})`,
        providerID: provider.id,
        modelID,
      })
    }

    if (items.length === 0) {
      await vscode.window.showErrorMessage("No provider/model available for compaction")
      return
    }
    if (items.length === 1) {
      const item = items[0]!
      return {
        providerID: item.providerID,
        modelID: item.modelID,
      }
    }

    const picked = await vscode.window.showQuickPick<vscode.QuickPickItem & CompactionModel>(items, {
      title: "Select Model For Session Compact",
      matchOnDescription: true,
      matchOnDetail: true,
    })
    if (!picked) return
    return {
      providerID: picked.providerID,
      modelID: picked.modelID,
    }
  }

  private async ensurePromptSession() {
    const serverUrl = await this.host.ensureServerRunning()
    const auth = this.host.serverAuth()
    const directory = this.host.defaultDirectory()
    let session = this.host.getActiveSession()

    if (!session) {
      const sessions = await listSessions({
        serverUrl,
        auth,
        directory,
        limit: 20,
      })
      const picked = pickActiveSession(sessions)
      session = picked ? { id: picked.id, directory: picked.directory } : undefined
    }

    if (!session) {
      const created = await createSession({ serverUrl, auth, directory })
      session = { id: created.id, directory: created.directory }
    }

    return { serverUrl, auth, session, directory }
  }
}
