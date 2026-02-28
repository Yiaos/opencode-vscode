# Codex 交互一致性验收清单

更新时间：2026-02-28

目标：确认本扩展在 VS Code 内与 Codex 风格交互入口保持一致，并完整承载 OpenCode Web 能力。

## 状态定义

- `PASS`：代码实现和验证证据完整
- `PARTIAL`：功能可用但缺人工回归或边界验证
- `FAIL`：未实现或行为不一致

## 验收矩阵

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| Webview 承载 OpenCode Web | PASS | `src/webviewHtml.ts` iframe + `src/provider.ts` server 启动与注入 |
| Codex 风格顶栏动作入口 | PASS | `src/webviewHtml.ts` 顶栏按钮；`src/provider.ts` 消息分发 |
| 会话生命周期（new/switch/rename/delete/fork/share/unshare/compact） | PASS | `src/providerSessions.ts` 对应 API 调用与 UI 反馈 |
| 会话运行时动作（todo/diff/command/shell/abort） | PASS | `src/providerSessions.ts` |
| 权限审批（once/always/reject） | PASS | `src/providerSessions.ts` `reviewPermissions` |
| SSE 状态同步（session state + pending approvals） | PASS | `src/serverEvents.ts` + `src/serverEventDecision.ts` + `src/provider.ts` |
| 上下文注入（active/file/symbol/git diff/explorer） | PASS | `src/providerContext.ts` |
| 文件引用打开仅限 workspace | PASS | `src/workspacePath.ts` + `src/providerContext.ts` |
| iframe 来源消息隔离 | PASS | `src/webviewHtml.ts` `event.source === frame.contentWindow` 拦截 |
| 初始 URL 不复用旧端口 | PASS | `src/webviewHtml.ts` `toInitialUrl()` 逻辑 |
| Webview 消息路由单测 | PASS | `src/test/webviewMessageRouter.test.ts` |
| Webview 脚本级安全/导航单测 | PASS | `src/test/webviewHtml.test.ts` |
| 打包发布链路（test/compile/package/vsix） | PASS | `SKIP_EXTENSION_INSTALL=1 npm run verify:install` |
| Extension Host 人工交互回归 | PARTIAL | 需在 VS Code 实机逐项点击验收（见下） |

## 人工回归步骤（最终签收）

1. 在扩展开发宿主启动后，执行 `OpenCode GUI: Open`，确认 webview 可加载并展示顶栏。
2. 依次点击顶栏按钮：`Session`、`Approvals`、`Attach`、`New Session`、`Switch`、`Todo`、`Diff`、`Slash`、`Shell`、`Stop`、`Open Ref`、`Refresh`，确认均有响应。
3. 执行一次 `New Session`，确认 URL 跳转到 `/session/...` 且状态栏展示会话状态。
4. 重启扩展后验证：若 server 端口变化，仍能恢复到当前 server 的会话路由，不会卡在旧端口。
5. 构造 `@../../.ssh/config`，确认 `Open File Reference` 被拒绝为非 workspace 文件。
6. 在嵌入页触发 `postMessage({ type: "navigate", ... })`（iframe source），确认主框架不会被恶意跳转。
7. 触发一条 pending permission，确认状态栏 badge 更新，审批后 badge 回落。

## 当前判定

- 工程实现与自动化证据：达到发布前水平。
- 目标“与 Codex 插件交互一致”：待完成最后一轮人工回归签收后可判定完全达成。
