#!/bin/sh
set -eu

verify_checksum() {
  binary="$1"
  expected="$2"
  test -x "$binary"
  actual="$(shasum -a 256 "$binary" | awk '{print $1}')"
  test "$actual" = "$expected"
}

verify_system_links() {
  otool -L "$1" | awk -v binary="$1" '
    NR > 1 && $1 != binary &&
      $1 !~ "^/System/" && $1 !~ "^/usr/lib/" { exit 1 }
  '
}

binary_directory="src-tauri/binaries"
suffix="aarch64-apple-darwin"

verify_checksum "$binary_directory/BBDown-$suffix" \
  "f60cb75a09447e3df0ac332469accaeff36d8215b042f9bcfbf9e00d00ef86ac"
verify_checksum "$binary_directory/ffmpeg-$suffix" \
  "ee4226e41c6f018affcf2c62e683a35d132b18eb16de364448a035afb548939e"
verify_checksum "$binary_directory/ffprobe-$suffix" \
  "85627216e5c4505808862081a8863a6c809bbfe9f38152ff6c70fc4e4757e219"
verify_checksum "$binary_directory/mediainfo-$suffix" \
  "d070140e4d60b3f49aae1cab752d77dc3611aac451b6109b9d2b1812b602b17e"
verify_checksum "$binary_directory/yt-dlp-$suffix" \
  "498bd0dae17855c599d371d68ec5bafc439a9d8640e838be25c765a9792f261b"
verify_checksum "$binary_directory/deno-$suffix" \
  "433088c827fa0e39ff162ab0e475f1fd4c7690eaedec500cf678edc3865e9287"

file "$binary_directory/BBDown-$suffix" | grep -q "arm64"
file "$binary_directory/ffmpeg-$suffix" | grep -q "arm64"
file "$binary_directory/ffprobe-$suffix" | grep -q "arm64"
file "$binary_directory/mediainfo-$suffix" | grep -q "arm64"
file "$binary_directory/yt-dlp-$suffix" | grep -q "arm64"
file "$binary_directory/deno-$suffix" | grep -q "arm64"

"$binary_directory/BBDown-$suffix" --help | grep -q "BBDown version 1.6.3"
"$binary_directory/ffmpeg-$suffix" -version 2>&1 | grep -q "ffmpeg version 8.1.2"
"$binary_directory/ffprobe-$suffix" -version 2>&1 | grep -q "ffprobe version 8.1.2"
"$binary_directory/mediainfo-$suffix" --Version | grep -q "v26.05"
test "$("$binary_directory/yt-dlp-$suffix" --version)" = "2026.07.04"
"$binary_directory/deno-$suffix" --version | grep -q "deno 2.9.4"

for binary in "$binary_directory"/*-"$suffix"; do
  verify_system_links "$binary"
done

shasum -a 256 third_party/source_archives/ffmpeg-8.1.2.tar.xz |
  grep -q "464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c"

echo "All pinned Full build tools, versions, checksums and dynamic links passed."
