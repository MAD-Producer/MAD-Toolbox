#!/bin/sh
# macOS packaging entry for Apple Silicon. Invoked by scripts/build/build.js,
# which already ran the TypeScript and cargo preflight checks.
#
# usage: macos.sh <lite|full> [tauri build arguments...]
set -eu

edition="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi
case "$edition" in
  lite | full) ;;
  *)
    echo "usage: macos.sh <lite|full> [tauri build arguments...]" >&2
    exit 2
    ;;
esac

project_directory="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
app="$project_directory/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MAD Toolbox.app"
dmg_directory="$project_directory/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg"
yt_dlp="$project_directory/src-tauri/binaries/yt-dlp-aarch64-apple-darwin"
bbdown="$project_directory/src-tauri/binaries/BBDown-aarch64-apple-darwin"

cd "$project_directory"
sh "$project_directory/scripts/build/macos-tools.sh" "$edition"

updater_args=""
if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  updater_args="--config src-tauri/tauri.updater.conf.json"
fi

if [ "$edition" = "lite" ]; then
  npm exec tauri -- build --target aarch64-apple-darwin $updater_args "$@"
  exit 0
fi

staging_directory="$(mktemp -d /private/tmp/mad-toolbox-full-dmg.XXXXXX)"

cleanup() {
  rm -rf "$staging_directory"
}
trap cleanup EXIT INT TERM

version="$(node -p "require('./package.json').version")"
dmg="$dmg_directory/MAD Toolbox_${version}_aarch64.dmg"
npm exec tauri -- build \
  --target aarch64-apple-darwin \
  --config src-tauri/tauri.full.conf.json \
  --bundles app \
  $updater_args \
  "$@"

# Tauri applies hardened runtime to every sidecar. Restore the verified
# upstream PyInstaller executables byte-for-byte, then reseal only the outer
# application bundle. This keeps BBDown exactly as published upstream and lets
# yt-dlp extract its Python framework without hardened library validation.
cp "$bbdown" "$app/Contents/MacOS/BBDown"
chmod 755 "$app/Contents/MacOS/BBDown"
cp "$yt_dlp" "$app/Contents/MacOS/yt-dlp"
chmod 755 "$app/Contents/MacOS/yt-dlp"
codesign --force --sign - --options runtime "$app"
codesign --verify --deep --strict "$app"
shasum -a 256 "$app/Contents/MacOS/BBDown" |
  grep -q "33597b2b7b83eecb4fbb4f0a50a43f1ada3ac1d9b6adf4eadda8399c700ea470"
"$app/Contents/MacOS/yt-dlp" --version | grep -q "2026.07.04"

# createUpdaterArtifacts 在构建期生成的 app.tar.gz/.sig 来自重封前的 .app：
# sidecar 恢复并重签后重新打包、重签，作为真正的 updater 产物
if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  app_directory="$(dirname "$app")"
  rm -f "$app_directory/MAD Toolbox.app.tar.gz" "$app_directory/MAD Toolbox.app.tar.gz.sig"
  tar -czf "$app_directory/MAD Toolbox.app.tar.gz" -C "$app_directory" "MAD Toolbox.app"
  npm exec tauri -- signer sign -p "" "$app_directory/MAD Toolbox.app.tar.gz"
fi

mkdir -p "$dmg_directory"
ditto "$app" "$staging_directory/MAD Toolbox.app"
ln -s /Applications "$staging_directory/Applications"
rm -f "$dmg"
hdiutil create \
  -volname "MAD Toolbox" \
  -srcfolder "$staging_directory" \
  -ov \
  -format UDZO \
  "$dmg"

echo "Full macOS app: $app"
echo "Full macOS DMG: $dmg"
shasum -a 256 "$dmg"
