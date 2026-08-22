/**
 * i18n 健康检查（前端 src/locale 与后端 src-tauri/locales）：
 * 1. 每对字典键集合一致（缺失/多余均报错；比较前归一化复数后缀 _one/_other 等，
 *    允许 zh 只存基础键而 en 存 _one/_other）
 * 2. 单文件内重复键（JSON.parse 会静默保留最后一个，需在文本层检测）
 * 3. 未引用键（警告）：前端扫描 TS 字符串字面量（t("x") 与作为数据传递的键），
 *    后端扫描 t!("x")；动态拼键会误报，仅提示
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const normalize = (key) => key.replace(PLURAL_SUFFIX, "");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function findDuplicateKeys(path) {
  const text = readFileSync(path, "utf8");
  const seen = new Set();
  const duplicates = [];
  for (const match of text.matchAll(/^\s{2}"((?:[^"\\]|\\.)*)":/gm)) {
    const key = match[1];
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  return duplicates;
}

function checkDictionaryPair(label, zhPath, enPath) {
  const zh = readJson(zhPath);
  const en = readJson(enPath);
  const zhKeys = new Set(Object.keys(zh));
  const enKeys = new Set(Object.keys(en));
  const zhBase = new Set([...zhKeys].map(normalize));
  const enBase = new Set([...enKeys].map(normalize));

  let failed = false;
  for (const key of zhBase) {
    if (!enBase.has(key)) {
      console.error(`[缺失] ${label} en 缺少键: ${key}`);
      failed = true;
    }
  }
  for (const key of enBase) {
    if (!zhBase.has(key)) {
      console.error(`[多余] ${label} en 独有键: ${key}`);
      failed = true;
    }
  }
  for (const path of [zhPath, enPath]) {
    const duplicates = findDuplicateKeys(path);
    if (duplicates.length > 0) {
      console.error(`[重复] ${path} 内重复键: ${duplicates.join(", ")}`);
      failed = true;
    }
  }
  return { failed, zhKeys };
}

function collectFiles(dir, extension, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      collectFiles(path, extension, files);
    } else if (entry.endsWith(extension)) {
      files.push(path);
    }
  }
  return files;
}

let failed = false;

// ── 前端字典 ──────────────────────────────────────────────────────────────
const frontend = checkDictionaryPair(
  "前端",
  join(root, "src", "locale", "zh.json"),
  join(root, "src", "locale", "en.json")
);
failed ||= frontend.failed;

// ── 后端字典（rust-i18n）─────────────────────────────────────────────────
const backendLocaleDir = join(root, "src-tauri", "locales");
if (existsSync(backendLocaleDir)) {
  const backend = checkDictionaryPair(
    "后端",
    join(backendLocaleDir, "zh-CN.json"),
    join(backendLocaleDir, "en.json")
  );
  failed ||= backend.failed;
}

// ── 引用扫描：字面量等于已知键（原始或归一化后）即视为已引用 ────────────
const referenced = new Set();
// 内容允许为空（""）：否则空字符串会吞掉相邻字面量的起始引号，打乱配对
const stringLiteral = /"((?:[^"\\\r\n]|\\.)*)"/g;
for (const file of [
  ...collectFiles(join(root, "src"), ".ts"),
  ...collectFiles(join(root, "src"), ".tsx")
]) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(stringLiteral)) referenced.add(normalize(match[1]));
}
for (const file of collectFiles(join(root, "src-tauri", "src"), ".rs")) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/t!\(\s*"((?:[^"\\])+)"/g)) referenced.add(normalize(match[1]));
}

const frontendKeys = readJson(join(root, "src", "locale", "zh.json"));
const unused = Object.keys(frontendKeys)
  .map(normalize)
  .filter((key, index, all) => all.indexOf(key) === index)
  .filter((key) => !referenced.has(key));
if (unused.length > 0) {
  console.warn(`[提示] 前端以下键未被字面量引用（动态拼键会误报，请人工确认）:`);
  for (const key of unused) console.warn(`  - ${key}`);
}

if (failed) {
  console.error("i18n 检查未通过");
  process.exit(1);
}
console.log(
  `i18n 检查通过：前端 ${Object.keys(frontendKeys).length} 个键（复数后缀已归一），无重复键`
);
