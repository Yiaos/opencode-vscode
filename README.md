# OpenCode GUI VS Code Extension

A standalone GUI extension located in `vsocode`.

## What it provides

- Starts and manages a local `opencode serve` process.
- Embeds the full OpenCode Web UI in a VS Code Webview.
- Provides codex-style top action bar (`Session/Approvals/Attach/New/Switch/Todo/Diff/Slash/Shell/Stop`).
- Supports core commands:
  - Open GUI
  - Open GUI in floating panel
  - New Session
  - Switch Session (quick picker)
  - Session Actions menu (rename/delete/fork/share/unshare/compact/stop)
  - Compact Session (AI summarize)
  - Review pending permissions (allow once / always allow / reject)
  - Real-time status sync in status bar (session state + pending approvals badge)
  - Session runtime actions: show todo, show diff, run command, run shell
  - Attach context: active file/selection, workspace file, workspace symbol, git diff
  - Explorer right-click attach (single file or multi-select files)
  - Refresh GUI
  - Copy active file reference (`@path#Lx-y`)
  - Send active file/selection context to OpenCode session
  - Abort active OpenCode session
  - Open `@file#Lx-y` reference directly in VS Code editor

## Development

```bash
cd vsocode
npm install
npm run watch
```

Press `F5` in VS Code to run the extension host.

## Tests

```bash
cd vsocode
npm test
```

## Build/Package/Install Automation

Run full verification and install to local VS Code in one command:

```bash
cd vsocode
npm run verify:install
```

This command executes:
- `npm test`
- `npm run compile`
- `npm run package`
- `npm run package:vsix`
- `code --install-extension .artifacts/opencode-gui-vscode.vsix --force` (or `CODE_CLI` override)

Git hook automation is enabled by default via `prepare` + `.githooks/pre-commit`, so each commit will auto-run the same verification/install workflow.

For continuous auto-run after every file change during development:

```bash
cd vsocode
npm run watch:verify-install
```

Optional env vars:
- `CODE_CLI=/path/to/code` to specify IDE CLI
- `SKIP_EXTENSION_INSTALL=1` to skip install step (CI/headless)
- `WATCH_INTERVAL_SECONDS=2` to tune watcher polling interval
