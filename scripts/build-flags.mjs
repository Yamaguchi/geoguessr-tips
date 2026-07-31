// 地図データ(src/data/world-50m.json)の全地域について、flag-iconsから国旗SVGを
// public/flags/ へコピーし、src/data/flags/manifest.json を生成する。
//
// 使い方: node scripts/build-flags.mjs
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SRC_DIR = join(root, "node_modules/flag-icons/flags/4x3");
const OUT_DIR = join(root, "public/flags");
const MANIFEST = join(root, "src/data/flags/manifest.json");

// Natural Earthが独自コードを振る地域を、flag-icons側のコードへ読み替える
const FLAG_CODE_OVERRIDES = { "CN-TW": "tw" };

const world = JSON.parse(await readFile(join(root, "src/data/world-50m.json"), "utf8"));
await mkdir(OUT_DIR, { recursive: true });

const entries = [];
for (const feature of world.features) {
  const { name, name_ja, iso_a2 } = feature.properties;
  const code = (FLAG_CODE_OVERRIDES[iso_a2] ?? iso_a2 ?? "").toLowerCase();
  let flag = null;
  if (code && code !== "-99") {
    const file = `${code}.svg`;
    try {
      await copyFile(join(SRC_DIR, file), join(OUT_DIR, file));
      flag = file;
    } catch {
      // flag-iconsに該当コードが無い地域（南極、係争地等）は国旗なしとして扱う
    }
  }
  entries.push({ name_ja, name, iso_a2, flag });
}

entries.sort((a, b) => a.name_ja.localeCompare(b.name_ja, "ja"));
await writeFile(MANIFEST, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`wrote ${entries.length} entries (${entries.filter((e) => e.flag).length} flags)`);
