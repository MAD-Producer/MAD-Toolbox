// Cross-platform packaging: npm run tauri:build -- [win|mac] [tauri arguments].
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
  const options = { target: undefined, passthrough: [] };

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
    if (argument === "--target") {
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

  return { target: options.target, passthrough: options.passthrough };
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

const { target: requestedTarget, passthrough } = parseArguments(process.argv.slice(2));

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

console.log(`Packaging MAD Toolbox for ${target}...`);

runNpm(["run", "check"]);

const rustTarget = target === "windows" ? "x86_64-pc-windows-msvc" : "aarch64-apple-darwin";
run("cargo", ["check", "--manifest-path", "src-tauri/Cargo.toml", "--target", rustTarget]);

if (target === "windows") {
  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(buildDirectory, "windows.ps1"),
    "-TauriArgsJson",
    JSON.stringify(passthrough)
  ]);
} else {
  run("/bin/sh", [path.join(buildDirectory, "macos.sh"), ...passthrough]);
}
