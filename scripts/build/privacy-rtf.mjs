// Generates the NSIS installer privacy-policy RTFs (src-tauri/windows/licenses/)
// from the canonical bilingual source in the website repository. ASCII-only
// output: every non-ASCII char is escaped as \uN? so no codepage issues.
//
// Run from the repo root after changing the policy on the website:
//   node scripts/build/privacy-rtf.mjs [privacy.ts path] [output dir]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const srcPath = process.argv[2] ?? "../madtool-box-site/src/data/privacy.ts";
const outDir = process.argv[3] ?? "src-tauri/windows/licenses";

const source = fs.readFileSync(path.resolve(srcPath), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
const exports_ = {};
new Function("exports", "module", js)(exports_, { exports: exports_ });
const { PRIVACY_SUMMARY, PRIVACY_SECTIONS } = exports_;

// RTF \uN takes a signed 16-bit code unit.
const esc = (text) =>
  text.replace(/[\\{}]/g, "\\$&").replace(/[\u0080-\uFFFF]/g, (ch) => {
    const cp = ch.codePointAt(0);
    return `\\u${cp > 32767 ? cp - 65536 : cp}?`;
  });

const meta = {
  en: { file: "privacy-en.rtf", title: "MAD Toolbox Privacy Policy" },
  "zh-CN": { file: "privacy-zh.rtf", title: "MAD Toolbox 隐私政策" }
};

for (const [lang, info] of Object.entries(meta)) {
  const parts = [];
  parts.push(`{\\b\\fs22 ${esc(info.title)}}\\par\\par`);
  for (const line of PRIVACY_SUMMARY[lang]) {
    parts.push(`\\pard\\fi-180\\li360\\bullet\\tab ${esc(line)}\\par\\pard`);
  }
  parts.push("\\par");
  for (const section of PRIVACY_SECTIONS) {
    parts.push(`{\\b\\fs20 ${esc(section.title[lang])}}\\par`);
    for (const block of section.blocks) {
      if (block.type === "p") {
        parts.push(
          block.rich[lang]
            .map((seg) => (seg.href ? `${seg.text} (${seg.href})` : seg.text))
            .map(esc)
            .join("") + "\\par"
        );
      } else {
        for (const item of block.items) {
          parts.push(
            `\\pard\\fi-180\\li360\\bullet\\tab ${esc(
              item[lang].map((seg) => (seg.href ? `${seg.text} (${seg.href})` : seg.text)).join("")
            )}\\par\\pard`
          );
        }
      }
    }
    parts.push("\\par");
  }
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fnil Segoe UI;}}\\fs18\n${parts.join("\n")}}\n`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, info.file), rtf, "latin1");
  console.log(`wrote ${path.join(outDir, info.file)} (${rtf.length} bytes)`);
}
