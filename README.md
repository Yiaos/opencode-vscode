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

## Implementation Overview

- Goal: build a standalone VS Code extension in `vsocode` that keeps full OpenCode Web capability while providing codex-style GUI interaction entry points.
- Architecture:
  - `src/extension.ts`: activation entry, registers webview provider and commands.
  - `src/provider.ts`: orchestration layer for command dispatch, server lifecycle, webview navigation, event handling, status bar sync.
  - `src/serverManager.ts`: starts/stops `opencode serve`, parses runtime server URL.
  - `src/webviewHtml.ts`: codex-style top action bar + embedded OpenCode Web iframe.
  - `src/providerSessions.ts`: session lifecycle actions and runtime actions (`todo/diff/command/shell`).
  - `src/providerContext.ts`: context attach pipeline (file/symbol/git diff/explorer).
  - `src/opencodeApi.ts`: typed REST client wrappers for OpenCode server APIs.
- Interaction flow:
  - User action from command palette/keybinding/top bar -> message/command routed to provider.
  - Provider resolves active session and directory -> calls API wrapper -> updates webview/status.
  - SSE `/event` stream drives runtime state and pending permission sync.
  - Session URL navigation keeps webview route and extension active session aligned.
- Build and delivery:
  - `npm run verify:install` runs test, compile, production bundle, VSIX package, and local install verification.
  - `.githooks/pre-commit` enforces the same gate before each commit.
  - `npm run watch:verify-install` continuously re-runs full gate after source changes.
- Quality strategy:
  - Unit tests cover API routes, menu definitions, URL parsing, event parsing/decision, runtime command parsing, and webview HTML generation.
  - Packaging/install path is validated through real VSIX build + CLI install.

## OpenCode Baseline

Current alignment baseline (recorded on **2026-02-28**):

- OpenCode repo path: `/Users/yangguangfu/worksp/extension/opencode`
- OpenCode git commit: `2a2082233d9e8bda4674ce596f04b61b3b32522d` (short: `2a20822`)
- OpenCode package version: `opencode@1.2.15`
- OpenCode Web package version: `@opencode-ai/web@1.2.15`
- OpenCode commit time: `2026-02-27 19:18:14 -0600`

When OpenCode is upgraded, refresh this baseline first, then develop incremental features by comparing:
- API route changes (`packages/opencode/src/server/routes/**`)
- event payload changes (`/event`, `session.*`, `permission.*`)
- Web interaction changes (`packages/web/**`)

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code 用户入口                         │
│ Command Palette / Keybinding / View Title / Explorer Context   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   extension.ts (激活)   │
                    │ 注册 Provider + Commands│
                    └───────────┬─────────────┘
                                │
                                ▼
              ┌─────────────────────────────────────┐
              │ provider.ts (编排中枢)              │
              │ - 命令分发                           │
              │ - Webview/Panel 生命周期             │
              │ - 状态栏同步                         │
              │ - 事件流接入                         │
              └───────┬───────────────┬─────────────┘
                      │               │
          ┌───────────▼──────────┐   │
          │ providerSessions.ts   │   │
          │ 会话与运行时动作       │   │
          │ new/switch/todo/diff  │   │
          │ slash/shell/...       │   │
          └───────────┬──────────┘   │
                      │               │
          ┌───────────▼──────────┐   │
          │ providerContext.ts    │   │
          │ 上下文注入/引用打开    │   │
          │ file/symbol/diff      │   │
          └───────────┬──────────┘   │
                      │               │
                      ▼               ▼
             ┌────────────────┐  ┌────────────────────┐
             │ opencodeApi.ts │  │ webviewHtml.ts      │
             │ REST API封装   │  │ 顶栏 + iframe WebUI │
             └───────┬────────┘  └─────────┬──────────┘
                     │                     │
                     ▼                     ▼
         ┌──────────────────────┐   ┌──────────────────────┐
         │ serverManager.ts      │   │ OpenCode Web (iframe)│
         │ 启停 opencode serve   │   │ 完整 Web 功能        │
         └──────────┬───────────┘   └──────────────────────┘
                    │
                    ▼
           ┌─────────────────────┐
           │ localhost opencode  │
           │ /session/* /event   │
           └─────────┬───────────┘
                     │ SSE
                     ▼
           ┌─────────────────────┐
           │ serverEvents.ts      │
           │ serverEventDecision.ts│
           │ 事件解析+状态决策     │
           └─────────┬───────────┘
                     ▼
               provider.ts 状态更新
```

## Directory Responsibilities

```text
vsocode/
├── src/                              # 扩展核心源码
│   ├── extension.ts                  # 激活入口，注册 Provider 与命令
│   ├── provider.ts                   # 主编排层（命令分发、Webview、状态栏、事件接入）
│   ├── providerSessions.ts           # 会话与运行时动作（todo/diff/command/shell）
│   ├── providerContext.ts            # 上下文注入（file/symbol/git diff/explorer）
│   ├── opencodeApi.ts                # OpenCode REST API 封装
│   ├── serverManager.ts              # 本地 opencode serve 进程管理
│   ├── serverEvents.ts               # SSE 事件订阅与解析
│   ├── serverEventDecision.ts        # 事件到会话/状态的决策逻辑
│   ├── webviewHtml.ts                # codex 风格顶栏 + iframe 壳层
│   ├── session*.ts                   # 会话 URL/Picker/运行时输入等工具模块
│   ├── statusBarState.ts             # 状态栏显示模型
│   ├── fileReference.ts              # @file#Lx-y 引用解析/生成
│   ├── contextPayload.ts             # 上下文文本 payload 构建
│   ├── providerMenus.ts              # 菜单项定义
│   ├── constants.ts                  # 命令 ID 与配置常量
│   └── test/                         # 单元测试（API/事件/解析/HTML/状态等）
├── scripts/                          # 自动化脚本
│   ├── build-package-install.sh      # test -> compile -> package -> vsix -> install
│   ├── setup-hooks.sh                # 启用 .githooks
│   └── watch-verify-install.sh       # 文件变更后持续执行完整 gate
├── resources/                        # 图标等静态资源
├── dist/                             # esbuild 产物（扩展运行时代码）
├── out/                              # 测试编译输出
├── .artifacts/                       # VSIX 构建产物
└── .githooks/                        # pre-commit 质量门禁
```

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
