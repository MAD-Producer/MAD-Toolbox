// Prints the CHANGELOG section for one release so CI can use it as the
// GitHub Release body. Version headings may use any Markdown heading level.
//
// Usage: npm run release:notes -- <vX.Y.Z|X.Y.Z>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const versionDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(path.dirname(versionDirectory));
const requested = process.argv[2] ?? "";
const version = requested.replace(/^v/, "");

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: npm run release:notes -- <vX.Y.Z|X.Y.Z>");
  process.exit(1);
}

const lines = readFileSync(path.join(projectDirectory, "CHANGELOG.md"), "utf8").split(/\r?\n/);
const versionHeading = /^#{1,6}\s+v?(\d+\.\d+\.\d+)\s*$/;
const matchingHeadings = lines
  .map((line, index) => ({ index, version: line.match(versionHeading)?.[1] }))
  .filter((heading) => heading.version === version);

if (matchingHeadings.length === 0) {
  console.error(`CHANGELOG.md has no section for ${version}.`);
  process.exit(1);
}
if (matchingHeadings.length > 1) {
  console.error(`CHANGELOG.md has multiple sections for ${version}.`);
  process.exit(1);
}

const start = matchingHeadings[0].index;
let end = lines.length;
for (let index = start + 1; index < lines.length; index += 1) {
  if (versionHeading.test(lines[index])) {
    end = index;
    break;
  }
}

const notes = lines
  .slice(start + 1, end)
  .join("\n")
  .trim();
if (!notes) {
  console.error(`CHANGELOG.md section ${version} is empty.`);
  process.exit(1);
}

process.stdout.write(`${notes}\n`);
