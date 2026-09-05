#!/bin/sh
# Prints one SHA-256 pinned in third_party/sources.json, the shared source of
# truth for macOS sidecar checksums. Runs under the same node that every build
# entry (scripts/build/build.js) already requires.
#
# usage: pinned-sha256.sh <tool name> <field> [nested key]
set -eu

if [ "$#" -lt 2 ]; then
  echo "usage: pinned-sha256.sh <tool name> <field> [nested key]" >&2
  exit 2
fi

project_directory="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"

node -e '
  const fs = require("fs");
  const manifestPath = process.argv[1];
  const name = process.argv[2];
  const field = process.argv[3];
  const subkey = process.argv[4];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const tool = (manifest.tools || []).find((entry) => entry.name === name);
  if (!tool) {
    console.error("third_party/sources.json has no entry for " + name + ".");
    process.exit(1);
  }
  let value = tool[field];
  if (subkey) {
    value = value && value[subkey];
  }
  const where = name + "." + field + (subkey ? "." + subkey : "");
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    console.error(where + " is not a lowercase SHA-256 digest.");
    process.exit(1);
  }
  process.stdout.write(value);
' "$project_directory/third_party/sources.json" "$1" "$2" "${3:-}"
