import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import * as vscode from "vscode"
import {
  buildFileContextPayload,
  buildFilesContextPayload,
  buildGitDiffContextPayload,
  buildSymbolContextPayload,
} from "./contextPayload"
import { parseFileReference, toFileReference, type LineRange } from "./fileReference"

const execFileAsync = promisify(execFile)

export type ProviderContextHost = {
  defaultDirectory(): string | undefined
  sendTextContext(text: string, successMessage: string): Promise<void>
  getPrimaryWebview(): vscode.Webview | undefined
}

export class ProviderContextActions {
  constructor(private readonly host: ProviderContextHost) {}

  async copyActiveFileReference() {
    const ref = getActiveFileReference()
    if (!ref) {
      await vscode.window.showInformationMessage("No active file in current workspace")
      return
    }

    await vscode.env.clipboard.writeText(ref)
    await this.host.getPrimaryWebview()?.postMessage({ type: "show-file-reference", reference: ref })
    await vscode.window.showInformationMessage(`Copied ${ref}`)
  }

  async sendActiveContext() {
    const ref = getActiveFileReference()
    if (!ref) {
      await vscode.window.showInformationMessage("No active file in current workspace")
      return
    }
    await this.host.sendTextContext(buildFileContextPayload(ref), `Sent context to OpenCode: ${ref}`)
  }

  async attachFileContext() {
    const picked = await this.pickWorkspaceFile()
    if (!picked) return
    await this.host.sendTextContext(buildFileContextPayload(picked.ref), `Attached file context: ${picked.ref}`)
  }

  async attachExplorerFileContext(uri?: vscode.Uri, uris?: vscode.Uri[]) {
    const candidates = uris && uris.length > 0 ? uris : uri ? [uri] : []
    if (candidates.length === 0) {
      await vscode.window.showInformationMessage("No file selected in explorer")
      return
    }

    const refs = Array.from(
      new Set(
        candidates
          .filter((item) => item.scheme === "file")
          .map((item) => {
            const workspace = vscode.workspace.getWorkspaceFolder(item)
            if (!workspace) return
            const relative = normalizeRelativePath(path.relative(workspace.uri.fsPath, item.fsPath))
            if (relative.startsWith("..")) return
            return toFileReference(relative)
          })
          .filter((item): item is string => !!item),
      ),
    )

    if (refs.length === 0) {
      await vscode.window.showInformationMessage("Selected files are not in workspace")
      return
    }

    const payload = buildFilesContextPayload(refs)
    if (!payload) return
    const success = refs.length === 1 ? `Attached file context: ${refs[0]}` : `Attached ${refs.length} files as context`
    await this.host.sendTextContext(payload, success)
  }

  async attachSymbolContext() {
    const query = await vscode.window.showInputBox({
      title: "Attach Symbol Context",
      prompt: "Enter symbol search query",
      placeHolder: "function or class name",
      validateInput: (value) => (value.trim() ? undefined : "Query cannot be empty"),
    })
    if (!query) return

    const symbols =
      (await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        "vscode.executeWorkspaceSymbolProvider",
        query,
      )) ?? []
    if (symbols.length === 0) {
      await vscode.window.showInformationMessage("No symbols found")
      return
    }

    const items = symbols.slice(0, 100).map((symbol) => {
      const relative = vscode.workspace.asRelativePath(symbol.location.uri)
      const line = symbol.location.range.start.line + 1
      return {
        label: symbol.name,
        description: vscode.SymbolKind[symbol.kind] ?? "Symbol",
        detail: `${relative}:${line}`,
        symbol,
      }
    })

    const picked = await vscode.window.showQuickPick(items, {
      title: "Select Symbol",
      matchOnDescription: true,
      matchOnDetail: true,
    })
    if (!picked) return

    const relative = vscode.workspace.asRelativePath(picked.symbol.location.uri, false)
    const ref = toFileReference(relative, {
      startLine: picked.symbol.location.range.start.line + 1,
      endLine: Math.max(
        picked.symbol.location.range.start.line + 1,
        picked.symbol.location.range.end.line + 1,
      ),
    })

    await this.host.sendTextContext(
      buildSymbolContextPayload({
        symbol: picked.symbol.name,
        fileRef: ref,
      }),
      `Attached symbol context: ${picked.symbol.name}`,
    )
  }

  async attachGitDiffContext() {
    const cwd = this.host.defaultDirectory()
    if (!cwd) {
      await vscode.window.showInformationMessage("No workspace directory available")
      return
    }

    try {
      const { stdout } = await execFileAsync("git", ["diff", "--"], { cwd, maxBuffer: 8 * 1024 * 1024 })
      const payload = buildGitDiffContextPayload({ diff: stdout, maxChars: 14_000 })
      if (!payload.text) {
        await vscode.window.showInformationMessage("No unstaged git diff to attach")
        return
      }
      await this.host.sendTextContext(
        payload.text,
        payload.truncated ? "Attached git diff (truncated)" : "Attached git diff",
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await vscode.window.showErrorMessage(`Failed to read git diff: ${message}`)
    }
  }

  async attachActions() {
    const picked = await vscode.window.showQuickPick(
      [
        { label: "Attach Active File/Selection", id: "active" },
        { label: "Attach Workspace File", id: "file" },
        { label: "Attach Workspace Symbol", id: "symbol" },
        { label: "Attach Git Diff", id: "diff" },
      ],
      { title: "OpenCode Attach Context" },
    )
    if (!picked) return
    if (picked.id === "active") return this.sendActiveContext()
    if (picked.id === "file") return this.attachFileContext()
    if (picked.id === "symbol") return this.attachSymbolContext()
    if (picked.id === "diff") return this.attachGitDiffContext()
  }

  async openReferenceInEditor() {
    const clipboard = await vscode.env.clipboard.readText()
    const pref = parseFileReference(clipboard)
    const value = await vscode.window.showInputBox({
      title: "Open File Reference",
      prompt: "Use @path or @path#Lx / @path#Lx-y",
      value: pref ? clipboard : "",
      placeHolder: "@src/index.ts#L42",
    })
    if (!value) return

    const parsed = parseFileReference(value)
    if (!parsed?.path) {
      await vscode.window.showErrorMessage("Invalid file reference")
      return
    }

    const uri = await resolveWorkspaceUri(parsed.path)
    if (!uri) {
      await vscode.window.showErrorMessage(`File not found in workspace: ${parsed.path}`)
      return
    }

    const doc = await vscode.workspace.openTextDocument(uri)
    const editor = await vscode.window.showTextDocument(doc, { preview: false })
    if (!parsed.range) return
    const start = new vscode.Position(parsed.range.startLine - 1, 0)
    const end = new vscode.Position(parsed.range.endLine - 1, 0)
    editor.selection = new vscode.Selection(start, end)
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter)
  }

  private async pickWorkspaceFile() {
    const files = await vscode.workspace.findFiles(
      "**/*",
      "**/{.git,node_modules,dist,out,build,.next,.turbo}/**",
      500,
    )
    if (files.length === 0) {
      await vscode.window.showInformationMessage("No files found in workspace")
      return
    }

    const items = files.map((uri) => {
      const relative = vscode.workspace.asRelativePath(uri, false)
      return {
        label: relative,
        detail: uri.fsPath,
        ref: toFileReference(relative),
      }
    })

    return vscode.window.showQuickPick(items, {
      title: "Attach File Context",
      matchOnDescription: true,
      matchOnDetail: true,
    })
  }
}

function getActiveFileReference() {
  const editor = vscode.window.activeTextEditor
  if (!editor) return

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)
  if (!workspaceFolder) return

  const relative = normalizeRelativePath(path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath))
  const range = getRange(editor.selection)
  return toFileReference(relative, range)
}

function normalizeRelativePath(input: string) {
  return input.replace(/\\/g, "/")
}

async function resolveWorkspaceUri(relativePath: string) {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) return
  for (const folder of folders) {
    const uri = vscode.Uri.joinPath(folder.uri, relativePath)
    try {
      await vscode.workspace.fs.stat(uri)
      return uri
    } catch {}
  }
  return
}

function getRange(selection: vscode.Selection): LineRange | undefined {
  if (selection.isEmpty) return
  const startLine = selection.start.line + 1
  const endLine = selection.end.line + 1
  if (startLine <= endLine) return { startLine, endLine }
  return { startLine: endLine, endLine: startLine }
}
