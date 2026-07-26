import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tipsDir = path.join(rootDir, "tips");
const categories = JSON.parse(readFileSync(path.join(rootDir, "src/data/categories.json"), "utf-8"));
const categorySet = new Set(categories);

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

let hasError = false;
for (const file of readdirSync(tipsDir)) {
  if (!file.endsWith(".md")) continue;
  const raw = readFileSync(path.join(tipsDir, file), "utf-8");
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    console.error(`tips/${file}: frontmatter が見つからない`);
    hasError = true;
    continue;
  }
  const data = loadYaml(match[1]);
  if (!data?.category) {
    console.error(`tips/${file}: category が無い`);
    hasError = true;
    continue;
  }
  if (!categorySet.has(data.category)) {
    console.error(`tips/${file}: category "${data.category}" は src/data/categories.json に定義が無い`);
    hasError = true;
  }
}

if (hasError) {
  console.error("\ntips のカテゴリ検証に失敗した。src/data/categories.json にカテゴリを追加するか、tips 側の category を修正すること。");
  process.exit(1);
}

console.log("tips のカテゴリ検証: OK");
