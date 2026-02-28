# OpenCode GUI VS Code Extension

A standalone GUI extension located in `vsocode`.

## What it provides

- Starts and manages a local `opencode serve` process.
- Embeds the full OpenCode Web UI in a VS Code Webview.
- Supports core commands:
  - Open GUI
  - Open GUI in floating panel
  - New Session
  - Switch Session (quick picker)
  - Session Actions menu (rename/delete/fork/share/unshare/compact/stop)
  - Compact Session (AI summarize)
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
