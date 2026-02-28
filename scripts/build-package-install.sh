#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pick_code_cli() {
  if [[ -n "${CODE_CLI:-}" ]]; then
    printf "%s" "$CODE_CLI"
    return 0
  fi

  local candidates=("code" "cursor" "codium" "windsurf")
  local candidate
  for candidate in "${candidates[@]}"; do
    if command -v "$candidate" >/dev/null 2>&1; then
      printf "%s" "$candidate"
      return 0
    fi
  done
  return 1
}

echo "[opencode-gui] 1/5 running tests"
npm test

echo "[opencode-gui] 2/5 compiling extension"
npm run compile

echo "[opencode-gui] 3/5 building production bundle"
npm run package

echo "[opencode-gui] 4/5 packaging VSIX"
mkdir -p .artifacts
npm run package:vsix

if [[ "${SKIP_EXTENSION_INSTALL:-0}" == "1" ]]; then
  echo "[opencode-gui] 5/5 skipped install (SKIP_EXTENSION_INSTALL=1)"
  exit 0
fi

if ! CODE_BIN="$(pick_code_cli)"; then
  echo "[opencode-gui] no VS Code CLI found (tried code/cursor/codium/windsurf)" >&2
  echo "[opencode-gui] set CODE_CLI=<path> or use SKIP_EXTENSION_INSTALL=1" >&2
  exit 1
fi

VSIX_PATH="$ROOT_DIR/.artifacts/opencode-gui-vscode.vsix"
EXTENSION_ID="$(node -e 'const p=require("./package.json"); process.stdout.write(p.publisher + "." + p.name)')"

echo "[opencode-gui] 5/5 installing VSIX with $CODE_BIN"
"$CODE_BIN" --install-extension "$VSIX_PATH" --force

if "$CODE_BIN" --list-extensions | grep -Fxq "$EXTENSION_ID"; then
  echo "[opencode-gui] installed successfully: $EXTENSION_ID"
  exit 0
fi

echo "[opencode-gui] install verification failed for $EXTENSION_ID" >&2
exit 1
