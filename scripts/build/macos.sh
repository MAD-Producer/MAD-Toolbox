#!/bin/sh
set -eu

project_directory="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
cd "$project_directory"

if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  npm exec tauri -- build --target aarch64-apple-darwin --config src-tauri/tauri.updater.conf.json "$@"
else
  npm exec tauri -- build --target aarch64-apple-darwin "$@"
fi
