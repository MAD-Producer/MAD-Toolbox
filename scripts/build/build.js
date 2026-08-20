// Cross-platform packaging entry.
//
// Usage (host platform is detected automatically):
//   npm run tauri:build:lite
//   npm run tauri:build:full
//
// Usage (explicit target, must match the host; cross-building is unsupported):
//   npm run tauri:build:lite -- win
//   npm run tauri:build:full -- mac --ci
//
// Any further arguments are passed through to `tauri build`.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const buildDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(path.dirname(buildDirectory));

const targetAliases = {
  win: "windows",
  windows: "windows",
  mac: "macos",
  macos: "macos"
};

function parseArguments(argv) {
  const options = { edition: undefined, target: undefined, passthrough: [] };

  const setTarget = (value) => {
    const alias = value?.toLowerCase();
    if (!Object.hasOwn(targetAliases, alias)) {
      throw new Error(`Unknown build target '${value}'. Use 'win' or 'mac'.`);
    }
    if (options.target) {
      throw new Error("Build target was specified more than once.");
    }
    options.target = targetAliases[alias];
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--edition") {
      index += 1;
      options.edition = argv[index];
    } else if (argument.startsWith("--edition=")) {
      options.edition = argument.slice("--edition=".length);
    } else if (argument === "--target") {
      index += 1;
      setTarget(argv[index]);
    } else if (argument.startsWith("--target=")) {
      setTarget(argument.slice("--target=".length));
    } else if (argument === "--") {
      options.passthrough.push(...argv.slice(index + 1));
      break;
    } else if (argument.startsWith("-")) {
      options.passthrough.push(argument);
    } else if (options.target) {
      throw new Error(
        `Unexpected positional argument '${argument}'. Only one target ('win' or 'mac') is allowed; put arguments meant for 'tauri build' after '--'.`
      );
    } else {
      setTarget(argument);
    }
  }

  const edition = options.edition?.toLowerCase();
  if (edition !== "full" && edition !== "lite") {
    throw new Error("Build edition must be 'full' or 'lite'.");
  }
  return { edition, target: options.target, passthrough: options.passthrough };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectDirectory,
    stdio: "inherit",
    shell: false,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNpm(args) {
  // Node refuses to spawn .cmd shims without a shell (CVE-2024-27980) and
  // deprecates shell:true with an args array, so Windows passes one command
  // string. The arguments are fixed strings, so nothing needs escaping.
  const isWindows = process.platform === "win32";
  run(isWindows ? `npm.cmd ${args.join(" ")}` : "npm", isWindows ? [] : args, {
    shell: isWindows
  });
}

const { edition, target: requestedTarget, passthrough } = parseArguments(process.argv.slice(2));

const buildableHosts = [];
if (process.platform === "win32" && process.arch === "x64") buildableHosts.push("windows");
if (process.platform === "darwin" && process.arch === "arm64") buildableHosts.push("macos");

const target = requestedTarget ?? buildableHosts[0];
if (!target) {
  throw new Error(
    `Unsupported build host: ${process.platform}/${process.arch}. ` +
      "Supported hosts are Windows x64 and Apple Silicon macOS."
  );
}
if (!buildableHosts.includes(target)) {
  throw new Error(
    `Building the '${target}' package on ${process.platform}/${process.arch} is not supported. ` +
      "Run the command on the matching host."
  );
}

console.log(`Packaging the ${edition} edition for ${target}...`);

runNpm(["run", "check"]);

// Fetch the sidecars before the cargo preflight: tauri's build script
// validates bundle.externalBin paths on every cargo invocation. The
// packaging scripts below re-run the same tools script, which then only
// re-verifies the SHA-256 checksums.
if (target === "windows") {
  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(buildDirectory, "windows-tools.ps1"),
    "-Edition",
    edition === "full" ? "Full" : "Lite"
  ]);
} else {
  run("/bin/sh", [path.join(buildDirectory, "macos-tools.sh"), edition]);
}

const rustTarget = target === "windows" ? "x86_64-pc-windows-msvc" : "aarch64-apple-darwin";
run("cargo", ["check", "--manifest-path", "src-tauri/Cargo.toml", "--target", rustTarget]);

if (target === "windows") {
  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(buildDirectory, "windows.ps1"),
    "-Edition",
    edition === "full" ? "Full" : "Lite",
    "-TauriArgsJson",
    JSON.stringify(passthrough)
  ]);
} else {
  run("/bin/sh", [path.join(buildDirectory, "macos.sh"), edition, ...passthrough]);
}
