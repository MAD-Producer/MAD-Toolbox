import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function collectChangedFiles() {
  if (process.env.FORMAT_ALL === "1") {
    return ["."];
  }

  const base = process.env.FORMAT_BASE?.trim();
  if (base && !/^0+$/u.test(base)) {
    return runGit(["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"]);
  }

  return [
    ...runGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    ...runGit(["ls-files", "--others", "--exclude-standard"])
  ];
}

const files = [...new Set(collectChangedFiles())];
if (files.length === 0) {
  console.log("No changed files to format.");
  process.exit(0);
}

const mode = process.argv.includes("--write") ? "--write" : "--check";
const prettierCli = fileURLToPath(
  new URL("../node_modules/prettier/bin/prettier.cjs", import.meta.url)
);
const result = spawnSync(process.execPath, [prettierCli, mode, "--ignore-unknown", "--", ...files], {
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
