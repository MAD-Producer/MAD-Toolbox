#!/bin/sh
# Verifies the pinned Apple Silicon sidecars in src-tauri/binaries for the
# given edition. Unlike scripts/build/windows-tools.ps1 this never downloads:
# the macOS sidecars are committed to the repository (FFmpeg is built from the
# pinned source via third_party/build). Checksums are read from
# third_party/sources.json through pinned-sha256.sh, the single source of
# truth, so bumping a tool never edits this file.
#
# usage: macos-tools.sh <lite|full>
set -eu

edition="${1:-}"
case "$edition" in
  lite | full) ;;
  *)
    echo "usage: macos-tools.sh <lite|full>" >&2
    exit 2
    ;;
esac

project_directory="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
binary_directory="$project_directory/src-tauri/binaries"
suffix="aarch64-apple-darwin"

pinned_sha256() {
  sh "$project_directory/scripts/build/pinned-sha256.sh" "$@"
}

file_sha256() {
  shasum -a 256 "$1" | awk '{print $1}'
}

verify_pinned_checksum() {
  binary="$1"
  tool="$2"
  field="$3"
  key="${4:-}"
  test -x "$binary"
  test "$(file_sha256 "$binary")" = "$(pinned_sha256 "$tool" "$field" "$key")"
}

verify_system_links() {
  otool -L "$1" | awk -v binary="$1" '
    NR > 1 && $1 != binary &&
      $1 !~ "^/System/" && $1 !~ "^/usr/lib/" { exit 1 }
  '
}

verify_pinned_checksum "$binary_directory/BBDown-$suffix" BBDown binarySha256
file "$binary_directory/BBDown-$suffix" | grep -q "arm64"
"$binary_directory/BBDown-$suffix" --help | grep -q "BBDown version 1.6.3"

if [ "$edition" = "full" ]; then
  verify_pinned_checksum "$binary_directory/ffmpeg-$suffix" FFmpeg binarySha256 ffmpeg
  verify_pinned_checksum "$binary_directory/ffprobe-$suffix" FFmpeg binarySha256 ffprobe
  verify_pinned_checksum "$binary_directory/mediainfo-$suffix" "MediaInfo CLI" binarySha256
  verify_pinned_checksum "$binary_directory/yt-dlp-$suffix" yt-dlp binarySha256
  verify_pinned_checksum "$binary_directory/deno-$suffix" Deno binarySha256

  file "$binary_directory/ffmpeg-$suffix" | grep -q "arm64"
  file "$binary_directory/ffprobe-$suffix" | grep -q "arm64"
  file "$binary_directory/mediainfo-$suffix" | grep -q "arm64"
  file "$binary_directory/yt-dlp-$suffix" | grep -q "arm64"
  file "$binary_directory/deno-$suffix" | grep -q "arm64"

  "$binary_directory/ffmpeg-$suffix" -version 2>&1 | grep -q "ffmpeg version 8.1.2"
  "$binary_directory/ffprobe-$suffix" -version 2>&1 | grep -q "ffprobe version 8.1.2"
  "$binary_directory/mediainfo-$suffix" --Version | grep -q "v26.05"
  test "$("$binary_directory/yt-dlp-$suffix" --version)" = "2026.07.04"
  "$binary_directory/deno-$suffix" --version | grep -q "deno 2.9.4"

  test "$(file_sha256 "$project_directory/third_party/source_archives/ffmpeg-8.1.2.tar.xz")" = \
    "$(pinned_sha256 FFmpeg artifactSha256)"
fi

for binary in "$binary_directory"/*-"$suffix"; do
  verify_system_links "$binary"
done

echo "All pinned $edition build tools, versions, checksums and dynamic links passed."
