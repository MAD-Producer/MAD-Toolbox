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

Install Node.js 22 and Rust stable, then run:

```bash
npm install
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

Use `npm run tauri:dev` for interactive testing. Platform packaging
requirements and commands are documented in `README.md` and `docs/`.

## Code formatting

The repository uses `.editorconfig` for editor-independent whitespace settings
and `.prettierrc` for TypeScript, TSX, CSS, JSON and other supported text files.
The Prettier rules preserve the existing two-space indentation, double quotes,
semicolons and no-trailing-comma style.

Run `npm run format` to format supported files changed relative to `HEAD`, or
`npm run format:check` to check them without writing changes. CI applies the
same check to files changed by a pull request or push. Rust code continues to
use `cargo fmt`.

## Pull requests

Keep changes focused and explain:

- what changed and why;
- which platforms and distribution modes are affected;
- how the change was tested;
- whether third-party licenses, sources or checksums changed.

User-facing options should be available through the GUI. Commands must be
constructed as argument arrays and should not invoke a shell for media paths
or user-provided values.
