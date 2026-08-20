#!/bin/sh
# Ensures the pinned Apple Silicon sidecars exist in src-tauri/binaries and
# that every SHA-256 matches. Missing or outdated upstream tools (BBDown,
# MediaInfo, yt-dlp, Deno) are re-downloaded from the pinned releases, just
# like scripts/build/windows-tools.ps1. FFmpeg/ffprobe are the exception:
# they are self-built LGPL binaries with no downloadable upstream build and
# must already be committed (third_party/build has the reproducible recipe).
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
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/mad-toolbox-macos.XXXXXX")"

cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT INT TERM

checksum_of() {
  shasum -a 256 "$1" | awk '{print $1}'
}

verify_checksum() {
  binary="$1"
  expected="$2"
  test -x "$binary"
  test "$(checksum_of "$binary")" = "$expected"
}

# Downloads url to output and verifies the pinned archive SHA-256.
download_file() {
  url="$1"
  output="$2"
  expected="$3"
  curl --fail --location --retry 3 --output "$output" "$url"
  actual="$(checksum_of "$output")"
  if test "$actual" != "$expected"; then
    echo "SHA256 mismatch for $output. Expected $expected, got $actual" >&2
    exit 1
  fi
}

up_to_date() {
  test -f "$1" && test "$(checksum_of "$1")" = "$2"
}

ensure_bbdown() {
  destination="$binary_directory/BBDown-$suffix"
  expected="33597b2b7b83eecb4fbb4f0a50a43f1ada3ac1d9b6adf4eadda8399c700ea470"
  if up_to_date "$destination" "$expected"; then
    return
  fi
  echo "Fetching BBDown 1.6.3 (osx-arm64)..."
  archive="$temporary_directory/bbdown.zip"
  download_file \
    "https://github.com/nilaoda/BBDown/releases/download/1.6.3/BBDown_1.6.3_20240814_osx-arm64.zip" \
    "$archive" \
    "4df84014d818bd6dff2b365b847645340e8955c4450fe965688f41af89a38baa"
  unzip -q "$archive" -d "$temporary_directory/bbdown"
  executable="$(find "$temporary_directory/bbdown" -type f -name BBDown -print -quit)"
  if test -z "$executable"; then
    echo "BBDown archive does not contain a BBDown executable" >&2
    exit 1
  fi
  cp "$executable" "$destination"
  chmod 755 "$destination"
  verify_checksum "$destination" "$expected"
}

ensure_mediainfo() {
  destination="$binary_directory/mediainfo-$suffix"
  expected="d070140e4d60b3f49aae1cab752d77dc3611aac451b6109b9d2b1812b602b17e"
  if up_to_date "$destination" "$expected"; then
    return
  fi
  echo "Fetching MediaInfo CLI 26.05 (macOS)..."
  image="$temporary_directory/mediainfo.dmg"
  download_file \
    "https://mediaarea.net/download/binary/mediainfo/26.05/MediaInfo_CLI_26.05_Mac.dmg" \
    "$image" \
    "507605a7c8f1054a6996d99a4ef5b5a0711cfbf2f8ca2ef5161d6ee701ea8015"
  mount_point="$temporary_directory/mediainfo-mount"
  mkdir "$mount_point"
  hdiutil attach -nobrowse -readonly -mountpoint "$mount_point" "$image" >/dev/null
  executable="$(find "$mount_point" -type f -name mediainfo -print -quit)"
  if test -z "$executable"; then
    hdiutil detach "$mount_point" -quiet
    echo "MediaInfo disk image does not contain a mediainfo executable" >&2
    exit 1
  fi
  cp "$executable" "$destination"
  chmod 755 "$destination"
  hdiutil detach "$mount_point" -quiet
  verify_checksum "$destination" "$expected"
}

ensure_yt_dlp() {
  destination="$binary_directory/yt-dlp-$suffix"
  expected="498bd0dae17855c599d371d68ec5bafc439a9d8640e838be25c765a9792f261b"
  if up_to_date "$destination" "$expected"; then
    return
  fi
  echo "Fetching yt-dlp 2026.07.04 (macOS)..."
  # The upstream artifact is the executable itself, so the archive and binary
  # SHA-256 are the same value.
  download_file \
    "https://github.com/yt-dlp/yt-dlp/releases/download/2026.07.04/yt-dlp_macos" \
    "$destination" \
    "$expected"
  chmod 755 "$destination"
  verify_checksum "$destination" "$expected"
}

ensure_deno() {
  destination="$binary_directory/deno-$suffix"
  expected="433088c827fa0e39ff162ab0e475f1fd4c7690eaedec500cf678edc3865e9287"
  if up_to_date "$destination" "$expected"; then
    return
  fi
  echo "Fetching Deno 2.9.4 (aarch64-apple-darwin)..."
  archive="$temporary_directory/deno.zip"
  download_file \
    "https://github.com/denoland/deno/releases/download/v2.9.4/deno-aarch64-apple-darwin.zip" \
    "$archive" \
    "6d17647fdbf9c587a581dba205054c4ccf732dae0a196cc1e9b44c07589db412"
  unzip -q "$archive" -d "$temporary_directory/deno"
  executable="$(find "$temporary_directory/deno" -type f -name deno -print -quit)"
  if test -z "$executable"; then
    echo "Deno archive does not contain a deno executable" >&2
    exit 1
  fi
  cp "$executable" "$destination"
  chmod 755 "$destination"
  verify_checksum "$destination" "$expected"
}

# FFmpeg/ffprobe are committed self-built binaries (see third_party/build);
# there is no upstream artifact this script could download.
require_selfbuilt_ffmpeg() {
  for name in ffmpeg ffprobe; do
    if ! test -x "$binary_directory/$name-$suffix"; then
      echo "src-tauri/binaries/$name-$suffix is missing. Build it from third_party/source_archives/ffmpeg-8.1.2.tar.xz with third_party/build/ffmpeg-macos-arm64.sh and commit the result." >&2
      exit 1
    fi
  done
}

verify_system_links() {
  otool -L "$1" | awk -v binary="$1" '
    NR > 1 && $1 != binary &&
      $1 !~ "^/System/" && $1 !~ "^/usr/lib/" { exit 1 }
  '
}

ensure_bbdown
file "$binary_directory/BBDown-$suffix" | grep -q "arm64"
"$binary_directory/BBDown-$suffix" --help | grep -q "BBDown version 1.6.3"

if [ "$edition" = "full" ]; then
  require_selfbuilt_ffmpeg
  verify_checksum "$binary_directory/ffmpeg-$suffix" \
    "ee4226e41c6f018affcf2c62e683a35d132b18eb16de364448a035afb548939e"
  verify_checksum "$binary_directory/ffprobe-$suffix" \
    "85627216e5c4505808862081a8863a6c809bbfe9f38152ff6c70fc4e4757e219"
  ensure_mediainfo
  ensure_yt_dlp
  ensure_deno

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

  shasum -a 256 "$project_directory/third_party/source_archives/ffmpeg-8.1.2.tar.xz" |
    grep -q "464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c"
fi

for binary in "$binary_directory"/*-"$suffix"; do
  verify_system_links "$binary"
done

echo "All pinned $edition build tools, versions, checksums and dynamic links passed."
