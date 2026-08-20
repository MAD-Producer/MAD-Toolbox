# Contributing to MAD Toolbox

Thank you for helping improve MAD Toolbox.

## Before opening a change

- Search existing issues and describe the user-facing problem or proposed
  workflow.
- Do not add download-site bypasses, DRM circumvention or default behavior that
  violates a media service's terms.
- Do not bundle a new third-party binary until its redistribution terms,
  attribution, exact version, source URL and SHA-256 have been documented.
- Never include cookies, login sessions, tokens, private media or unredacted
  diagnostic archives in an issue or commit.

## Local development

Install Node.js 22 and Rust stable. On Windows, also install Visual Studio 2022
Build Tools with the **Desktop development with C++** workload; the Windows
packaging flow runs on Windows PowerShell 5.1, which ships with Windows, so
PowerShell 7 is not required.

Fetch the pinned sidecars once; tauri's build script validates
`bundle.externalBin` paths on every cargo invocation, so this must happen
before `cargo check`:

```bash
# macOS (Apple Silicon)
sh scripts/build/macos-tools.sh lite
# Windows x64 (PowerShell)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build/windows-tools.ps1 -Edition Lite
```

then:

```bash
npm ci
npm run check
cargo check --manifest-path src-tauri/Cargo.toml --all-targets
```

Use `npm run tauri:dev` for interactive testing.

## Packaging

Both platforms share the same entry command, which selects the native flow for
the current host automatically:

```bash
npm run tauri:build:lite    # or tauri:build:full
```

Pass an explicit target to skip host detection. The target must match the host;
cross-building is not supported:

```bash
npm run tauri:build:lite -- win
npm run tauri:build:full -- mac --ci
```

Any arguments after the target are passed through to `tauri build`. Both
commands first run the TypeScript and `cargo check` preflights, then verify the
pinned sidecar binaries (downloading missing ones) and produce the platform
installer. CI tag builds use the same commands with an explicit target.

The automation lives in `scripts/`, split by responsibility:

```text
scripts/
├── build/          # build.js entry, windows.ps1 + windows-tools.ps1,
│                   # macos.sh + macos-tools.sh
└── version/        # bump.js, check.js
```

## Version management

The version is tracked in `package.json`, `package-lock.json`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`
and `docs/WINDOWS.md`. Bump all of them at once:

```bash
npm run version:bump -- patch   # or minor / major / x.y.z
```

Then add the `CHANGELOG.md` entry. `npm run version:check` verifies that every
reference matches `package.json` and runs in CI.

## Code formatting

The repository uses `.editorconfig` for editor-independent whitespace settings
and `.prettierrc` for TypeScript, TSX, CSS, JSON and other supported text files.
The Prettier rules preserve the existing two-space indentation, double quotes,
semicolons and no-trailing-comma style.

Run `npm run format` to format all supported files, or `npm run format:check`
to check them without writing changes. Both operate on the whole repository,
and CI checks the whole repository too. Rust code continues to use `cargo fmt`.

## Pull requests

Keep changes focused and explain:

- what changed and why;
- which platforms and distribution modes are affected;
- how the change was tested;
- whether third-party licenses, sources or checksums changed.

User-facing options should be available through the GUI. Commands must be
constructed as argument arrays and should not invoke a shell for media paths
or user-provided values.
