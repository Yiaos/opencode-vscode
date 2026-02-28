export type SessionMenuActionID =
  | "new"
  | "switch"
  | "compact"
  | "review-permissions"
  | "todo"
  | "diff"
  | "command"
  | "shell"
  | "attach-file"
  | "attach-symbol"
  | "attach-diff"
  | "rename"
  | "fork"
  | "share"
  | "unshare"
  | "stop"
  | "delete"

export type AttachMenuActionID = "active" | "file" | "symbol" | "diff"

export const SESSION_ACTION_ITEMS: Array<{ label: string; id: SessionMenuActionID }> = [
  { label: "New Session", id: "new" },
  { label: "Switch Session", id: "switch" },
  { label: "Compact Session", id: "compact" },
  { label: "Review Pending Permissions", id: "review-permissions" },
  { label: "Show Session Todo", id: "todo" },
  { label: "Show Session Diff", id: "diff" },
  { label: "Run Session Command", id: "command" },
  { label: "Run Session Shell", id: "shell" },
  { label: "Attach File Context", id: "attach-file" },
  { label: "Attach Symbol Context", id: "attach-symbol" },
  { label: "Attach Git Diff Context", id: "attach-diff" },
  { label: "Rename Session", id: "rename" },
  { label: "Fork Session", id: "fork" },
  { label: "Share Session", id: "share" },
  { label: "Unshare Session", id: "unshare" },
  { label: "Stop Session", id: "stop" },
  { label: "Delete Session", id: "delete" },
]

export const ATTACH_ACTION_ITEMS: Array<{ label: string; id: AttachMenuActionID }> = [
  { label: "Attach Active File/Selection", id: "active" },
  { label: "Attach Workspace File", id: "file" },
  { label: "Attach Workspace Symbol", id: "symbol" },
  { label: "Attach Git Diff", id: "diff" },
]
