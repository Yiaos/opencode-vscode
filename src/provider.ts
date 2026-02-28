import * as vscode from "vscode"
import {
  COMMAND_ABORT_SESSION,
  COMMAND_ATTACH_EXPLORER_FILE,
  COMMAND_ATTACH_FILE,
  COMMAND_ATTACH_GIT_DIFF,
  COMMAND_ATTACH_SYMBOL,
  COMMAND_COPY_FILE_REFERENCE,
  COMMAND_COMPACT_SESSION,
  COMMAND_DELETE_SESSION,
  COMMAND_FORK_SESSION,
  COMMAND_NEW_SESSION,
  COMMAND_OPEN_REFERENCE,
  COMMAND_RENAME_SESSION,
  COMMAND_REVIEW_PERMISSIONS,
  COMMAND_RUN_SESSION_COMMAND,
  COMMAND_RUN_SESSION_SHELL,
  COMMAND_SHOW_SESSION_DIFF,
  COMMAND_SHOW_SESSION_TODO,
  COMMAND_OPEN_PANEL,
  COMMAND_OPEN,
  COMMAND_REFRESH,
  COMMAND_SESSION_ACTIONS,
  COMMAND_SEND_CONTEXT,
  COMMAND_SHARE_SESSION,
  COMMAND_SWITCH_SESSION,
  COMMAND_UNSHARE_SESSION,
  CONFIG_NS,
  VIEW_CONTAINER_ID,
  VIEW_ID,
} from "./constants"
import { listPermissions, type ServerAuth } from "./opencodeApi"
import { ProviderContextActions } from "./providerContext"
import { SESSION_ACTION_ITEMS } from "./providerMenus"
import { ProviderSessionActions } from "./providerSessions"
import { ServerManager } from "./serverManager"
import { decideServerEvent } from "./serverEventDecision"
import { ServerEventsClient, type GlobalEventEnvelope } from "./serverEvents"
import { buildSessionUrl, parseSessionUrl, type SessionInfo } from "./sessionUrl"
import { buildStatusBarState, type SessionRuntimeState } from "./statusBarState"
import { createNonce, createWebviewHtml } from "./webviewHtml"
import { dispatchWebviewMessage } from "./webviewMessageRouter"

export class OpencodeGuiViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private static readonly ACTIVE_SESSION_KEY = "opencodeGui.activeSession"
  private view?: vscode.WebviewView
  private panel?: vscode.WebviewPanel
  private readonly output: vscode.OutputChannel
  private readonly server: ServerManager
  private readonly status: vscode.StatusBarItem
  private readonly events: ServerEventsClient
  private readonly attachedWebviews = new WeakSet<vscode.Webview>()
  private readonly sessions: ProviderSessionActions
  private readonly contextActions: ProviderContextActions
  private activeSession?: SessionInfo
  private connectedServerUrl?: string
  private pendingPermissions = 0
  private sessionState: SessionRuntimeState = "idle"

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel("OpenCode GUI")

    const config = vscode.workspace.getConfiguration(CONFIG_NS)
    const opencodePath = config.get<string>("opencodePath", "opencode")
    const extraArgs = config.get<string[]>("serveArgs", [])
    const timeoutMs = config.get<number>("startTimeoutMs", 20_000)
    const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    this.server = new ServerManager({
      command: opencodePath,
      args: ["serve", "--hostname=127.0.0.1", "--port=0", ...extraArgs],
      cwd: workspaceDir,
      timeoutMs,
      onLog: (line) => this.output.append(line),
    })

    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    this.status.name = "OpenCode GUI"
    this.status.command = COMMAND_OPEN
    this.status.show()
    this.events = new ServerEventsClient({
      onEvent: (event) => this.handleServerEvent(event),
      onLog: (line) => this.output.appendLine(line),
    })
    this.updateStatusBar()

    const saved = this.context.workspaceState.get<SessionInfo>(OpencodeGuiViewProvider.ACTIVE_SESSION_KEY)
    if (saved?.id && saved?.directory) {
      this.activeSession = saved
    }

    this.sessions = new ProviderSessionActions({
      ensureServerRunning: () => this.server.ensureRunning(),
      serverAuth: () => this.serverAuth(),
      defaultDirectory: () => this.defaultDirectory(),
      getActiveSession: () => this.activeSession,
      setActiveSession: (session) => this.setActiveSession(session),
      open: () => this.open(),
      navigateWebviews: (url) => this.navigateWebviews(url),
      refresh: () => this.refresh(),
    })

    this.contextActions = new ProviderContextActions({
      defaultDirectory: () => this.defaultDirectory(),
      sendTextContext: (text, successMessage) => this.sessions.sendTextContext(text, successMessage),
      getPrimaryWebview: () => this.view?.webview,
    })
  }

  async resolveWebviewView(view: vscode.WebviewView) {
    this.view = view
    view.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
    }
    this.attachWebview(view.webview)
    await this.renderWebview(view.webview)
  }

  async open() {
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`).then(
      () => undefined,
      () => vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`),
    )

    if (!this.view) {
      await vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`)
      return
    }

    this.view.show?.(true)
  }

  async openPanel() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true)
      return
    }

    const panel = vscode.window.createWebviewPanel(
      "opencodeGui.panel",
      "OpenCode GUI",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true,
      },
    )
    this.panel = panel
    this.attachWebview(panel.webview)
    panel.onDidDispose(() => {
      if (this.panel === panel) this.panel = undefined
    })
    await this.renderWebview(panel.webview)
  }

  async refresh() {
    const targets = this.webviews()
    if (targets.length === 0) return
    await Promise.all(targets.map((webview) => this.renderWebview(webview)))
  }

  async sessionActionsMenu() {
    const picked = await vscode.window.showQuickPick(SESSION_ACTION_ITEMS, { title: "OpenCode Session Actions" })
    if (!picked) return
    if (picked.id === "new") return this.sessions.newSession()
    if (picked.id === "switch") return this.sessions.switchSession()
    if (picked.id === "compact") return this.sessions.compactSession()
    if (picked.id === "review-permissions") return this.reviewPermissions()
    if (picked.id === "todo") return this.sessions.showSessionTodo()
    if (picked.id === "diff") return this.sessions.showSessionDiff()
    if (picked.id === "command") return this.sessions.runSessionCommandAction()
    if (picked.id === "shell") return this.sessions.runSessionShellAction()
    if (picked.id === "attach-file") return this.contextActions.attachFileContext()
    if (picked.id === "attach-symbol") return this.contextActions.attachSymbolContext()
    if (picked.id === "attach-diff") return this.contextActions.attachGitDiffContext()
    if (picked.id === "rename") return this.sessions.renameSession()
    if (picked.id === "fork") return this.sessions.forkSession()
    if (picked.id === "share") return this.sessions.shareSession()
    if (picked.id === "unshare") return this.sessions.unshareSession()
    if (picked.id === "stop") return this.sessions.abortActiveSession()
    if (picked.id === "delete") return this.sessions.deleteSession()
  }

  registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand(COMMAND_OPEN, async () => this.open()),
      vscode.commands.registerCommand(COMMAND_OPEN_PANEL, async () => this.openPanel()),
      vscode.commands.registerCommand(COMMAND_REFRESH, async () => this.refresh()),
      vscode.commands.registerCommand(COMMAND_NEW_SESSION, async () => this.sessions.newSession()),
      vscode.commands.registerCommand(COMMAND_SWITCH_SESSION, async () => this.sessions.switchSession()),
      vscode.commands.registerCommand(COMMAND_REVIEW_PERMISSIONS, async () => this.reviewPermissions()),
      vscode.commands.registerCommand(COMMAND_SHOW_SESSION_TODO, async () => this.sessions.showSessionTodo()),
      vscode.commands.registerCommand(COMMAND_SHOW_SESSION_DIFF, async () => this.sessions.showSessionDiff()),
      vscode.commands.registerCommand(COMMAND_RUN_SESSION_COMMAND, async () => this.sessions.runSessionCommandAction()),
      vscode.commands.registerCommand(COMMAND_RUN_SESSION_SHELL, async () => this.sessions.runSessionShellAction()),
      vscode.commands.registerCommand(COMMAND_SESSION_ACTIONS, async () => this.sessionActionsMenu()),
      vscode.commands.registerCommand(COMMAND_RENAME_SESSION, async () => this.sessions.renameSession()),
      vscode.commands.registerCommand(COMMAND_DELETE_SESSION, async () => this.sessions.deleteSession()),
      vscode.commands.registerCommand(COMMAND_FORK_SESSION, async () => this.sessions.forkSession()),
      vscode.commands.registerCommand(COMMAND_SHARE_SESSION, async () => this.sessions.shareSession()),
      vscode.commands.registerCommand(COMMAND_UNSHARE_SESSION, async () => this.sessions.unshareSession()),
      vscode.commands.registerCommand(COMMAND_COMPACT_SESSION, async () => this.sessions.compactSession()),
      vscode.commands.registerCommand(COMMAND_ATTACH_FILE, async () => this.contextActions.attachFileContext()),
      vscode.commands.registerCommand(COMMAND_ATTACH_EXPLORER_FILE, async (uri?: vscode.Uri, uris?: vscode.Uri[]) =>
        this.contextActions.attachExplorerFileContext(uri, uris),
      ),
      vscode.commands.registerCommand(COMMAND_ATTACH_SYMBOL, async () => this.contextActions.attachSymbolContext()),
      vscode.commands.registerCommand(COMMAND_ATTACH_GIT_DIFF, async () => this.contextActions.attachGitDiffContext()),
      vscode.commands.registerCommand(COMMAND_COPY_FILE_REFERENCE, async () => this.contextActions.copyActiveFileReference()),
      vscode.commands.registerCommand(COMMAND_SEND_CONTEXT, async () => this.contextActions.sendActiveContext()),
      vscode.commands.registerCommand(COMMAND_ABORT_SESSION, async () => this.sessions.abortActiveSession()),
      vscode.commands.registerCommand(COMMAND_OPEN_REFERENCE, async () => this.contextActions.openReferenceInEditor()),
    )
  }

  dispose() {
    this.events.stop()
    void this.server.dispose()
    this.output.dispose()
    this.status.dispose()
    this.panel?.dispose()
  }

  private loadingHtml(message: string) {
    const escaped = message
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\n", "<br />")

    return `<!doctype html>
<html>
  <body style="margin:0;padding:16px;background:#0f1115;color:#e7eaef;font:12px ui-sans-serif,system-ui;">
    ${escaped}
  </body>
</html>`
  }

  private webviews() {
    return [this.view?.webview, this.panel?.webview].filter((x): x is vscode.Webview => !!x)
  }

  private attachWebview(webview: vscode.Webview) {
    if (this.attachedWebviews.has(webview)) return
    this.attachedWebviews.add(webview)
    webview.onDidReceiveMessage((message) => {
      dispatchWebviewMessage(message, {
        onReady: (url) => {
          this.output.appendLine(`[webview] ready: ${url}`)
          const session = parseSessionUrl(url)
          if (session) this.setActiveSession(session)
        },
        onNewSession: () => void this.sessions.newSession(),
        onSessionMenu: () => void this.sessionActionsMenu(),
        onReviewPermissions: () => void this.reviewPermissions(),
        onAttachMenu: () => void this.contextActions.attachActions(),
        onSendContext: () => void this.contextActions.sendActiveContext(),
        onPrompt: (text) => void this.sessions.sendPrompt(text),
        onSwitchSession: () => void this.sessions.switchSession(),
        onOpenPanel: () => void this.openPanel(),
        onShowTodo: () => void this.sessions.showSessionTodo(),
        onShowDiff: () => void this.sessions.showSessionDiff(),
        onRunCommand: () => void this.sessions.runSessionCommandAction(),
        onRunShell: () => void this.sessions.runSessionShellAction(),
        onAbortSession: () => void this.sessions.abortActiveSession(),
        onOpenReference: () => void this.contextActions.openReferenceInEditor(),
        onRefresh: () => void this.refresh(),
        onFrameError: () => void vscode.window.showErrorMessage("OpenCode GUI frame failed to load"),
      })
    })
  }

  private async renderWebview(webview: vscode.Webview) {
    webview.html = this.loadingHtml("Starting OpenCode server...")
    try {
      const serverUrl = await this.server.ensureRunning()
      this.connectedServerUrl = serverUrl
      this.ensureEventStream(serverUrl)
      this.updateStatusBar()
      const nonce = createNonce()
      webview.html = createWebviewHtml({
        cspSource: webview.cspSource,
        serverUrl,
        nonce,
        title: "OpenCode GUI",
      })
      this.output.appendLine(`[server] connected: ${serverUrl}`)
      if (this.activeSession) {
        const url = buildSessionUrl(serverUrl, this.activeSession)
        await webview.postMessage({ type: "navigate", url })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.output.appendLine(`[server] start failed: ${message}`)
      this.connectedServerUrl = undefined
      this.sessionState = "error"
      this.updateStatusBar()
      webview.html = this.loadingHtml(`Failed to start OpenCode server\n${message}`)
      await vscode.window.showErrorMessage(`OpenCode GUI failed to start: ${message}`)
    }
  }

  private async navigateWebviews(url: string) {
    const views = this.webviews()
    if (views.length === 0) {
      await this.open()
      return
    }
    await Promise.all(
      views.map((webview) =>
        webview.postMessage({
          type: "navigate",
          url,
        }),
      ),
    )
  }

  private serverAuth(): ServerAuth | undefined {
    const config = vscode.workspace.getConfiguration(CONFIG_NS)
    const username = config.get<string>("serverUsername", "")
    const password = config.get<string>("serverPassword", "")
    if (!password) return undefined
    return { username, password }
  }

  private defaultDirectory() {
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const workspace = vscode.workspace.getWorkspaceFolder(editor.document.uri)
      if (workspace?.uri.fsPath) return workspace.uri.fsPath
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  }

  private setActiveSession(session: SessionInfo | undefined) {
    this.activeSession = session
    this.sessionState = "idle"
    if (!session) {
      void this.context.workspaceState.update(OpencodeGuiViewProvider.ACTIVE_SESSION_KEY, undefined)
      this.updateStatusBar()
      return
    }
    void this.context.workspaceState.update(OpencodeGuiViewProvider.ACTIVE_SESSION_KEY, session)
    this.updateStatusBar()
  }

  private async reviewPermissions() {
    await this.sessions.reviewPermissions()
    await this.refreshPendingPermissions()
  }

  private ensureEventStream(serverUrl: string) {
    this.events.start({
      serverUrl,
      auth: this.serverAuth(),
    })
    void this.refreshPendingPermissions()
  }

  private async refreshPendingPermissions() {
    if (!this.connectedServerUrl) return
    try {
      const pending = await listPermissions({
        serverUrl: this.connectedServerUrl,
        auth: this.serverAuth(),
      })
      this.pendingPermissions = pending.length
      this.updateStatusBar()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.output.appendLine(`[permission] refresh failed: ${message}`)
    }
  }

  private handleServerEvent(event: GlobalEventEnvelope) {
    const decision = decideServerEvent({
      event,
      activeSession: this.activeSession,
    })
    if (decision.refreshPermissions) {
      void this.refreshPendingPermissions()
    }
    if (decision.nextSession) this.setActiveSession(decision.nextSession)
    if (decision.nextState) this.sessionState = decision.nextState
    if (decision.nextSession || decision.nextState) this.updateStatusBar()
  }

  private updateStatusBar() {
    const state = buildStatusBarState({
      connected: !!this.connectedServerUrl,
      serverUrl: this.connectedServerUrl,
      sessionState: this.sessionState,
      pendingPermissions: this.pendingPermissions,
    })
    this.status.text = state.text
    this.status.tooltip = state.tooltip
  }
}
