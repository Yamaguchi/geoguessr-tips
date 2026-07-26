import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tipsDir = path.join(rootDir, "tips");
const categorySubcategories = JSON.parse(
  readFileSync(path.join(rootDir, "src/data/categories.json"), "utf-8"),
);
const categorySet = new Set(Object.keys(categorySubcategories));

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function validateTag(file, category, tag, errors) {
  if (tag === category) return;
  const slashIdx = tag.indexOf("/");
  if (slashIdx === -1) {
    errors.push(`tips/${file}: tag "${tag}" は「カテゴリ/サブカテゴリ」形式ではない`);
    return;
  }
  const prefix = tag.slice(0, slashIdx);
  const subcategory = tag.slice(slashIdx + 1);
  if (!categorySet.has(prefix)) {
    errors.push(`tips/${file}: tag "${tag}" のカテゴリ部分が未定義`);
    return;
  }
  const allowed = categorySubcategories[prefix];
  if (allowed.length > 0 && !allowed.includes(subcategory)) {
    errors.push(
      `tips/${file}: subcategory "${subcategory}"（カテゴリ「${prefix}」）は src/data/categories.json に定義が無い`,
    );
  }
}

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
    continue;
  }
  const errors = [];
  for (const tag of data.tags ?? []) validateTag(file, data.category, tag, errors);
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    hasError = true;
  }
}

if (hasError) {
  console.error("\ntips のカテゴリ/タグ検証に失敗した。src/data/categories.json にサブカテゴリを追加するか、tips 側のタグを修正すること。");
  process.exit(1);
}

console.log("tips のカテゴリ/タグ検証: OK");
