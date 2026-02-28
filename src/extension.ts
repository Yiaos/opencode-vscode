import * as vscode from "vscode"
import { VIEW_ID } from "./constants"
import { OpencodeGuiViewProvider } from "./provider"

export function activate(context: vscode.ExtensionContext) {
  const provider = new OpencodeGuiViewProvider(context)

  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
  )

  provider.registerCommands(context)
}

export function deactivate() {}
