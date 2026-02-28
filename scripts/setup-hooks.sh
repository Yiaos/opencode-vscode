#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "[opencode-gui] git not found, skip hook setup"
  exit 0
fi

if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[opencode-gui] not a git repository, skip hook setup"
  exit 0
fi

git -C "$ROOT_DIR" config core.hooksPath "$ROOT_DIR/.githooks"
chmod +x "$ROOT_DIR/.githooks/pre-commit"

echo "[opencode-gui] git hooks enabled: $ROOT_DIR/.githooks"
