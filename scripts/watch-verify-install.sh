#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WATCH_INTERVAL_SECONDS="${WATCH_INTERVAL_SECONDS:-2}"
TARGET_GLOBS=(
  "src/**/*.ts"
  "scripts/**/*.sh"
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "esbuild.js"
)

snapshot() {
  shopt -s globstar nullglob
  local files=()
  local pattern
  for pattern in "${TARGET_GLOBS[@]}"; do
    for file in $pattern; do
      files+=("$file")
    done
  done
  shopt -u globstar nullglob
  if ((${#files[@]} == 0)); then
    printf "empty"
    return 0
  fi
  printf "%s\0" "${files[@]}" | xargs -0 shasum | shasum | awk '{print $1}'
}

echo "[opencode-gui] auto verify/install watcher started"
echo "[opencode-gui] interval: ${WATCH_INTERVAL_SECONDS}s"
echo "[opencode-gui] targets: ${TARGET_GLOBS[*]}"

last_hash="$(snapshot)"

while true; do
  sleep "$WATCH_INTERVAL_SECONDS"
  next_hash="$(snapshot)"
  if [[ "$next_hash" == "$last_hash" ]]; then
    continue
  fi
  last_hash="$next_hash"
  echo "[opencode-gui] change detected, running verify/install"
  if bash "$ROOT_DIR/scripts/build-package-install.sh"; then
    echo "[opencode-gui] verify/install succeeded"
  else
    echo "[opencode-gui] verify/install failed, waiting for next change" >&2
  fi
done
