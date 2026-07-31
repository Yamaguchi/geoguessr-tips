// Natural Earthのデータから src/data/world-50m.json を生成する。
//
// 1:110mのデータにはマルタ・モナコ・シンガポール等の小さな国が収録されておらず、
// これらのTipに地図から到達できなかったため1:50mへ引き上げた。
// 1:50mにも無いジブラルタルは1:10m、クリスマス島は1:10mのmap_unitsから補う。
//
// 使い方: node scripts/build-map-data.mjs
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const OUT = new URL("../src/data/world-50m.json", import.meta.url);

// 座標の丸め桁数。世界地図の縮尺では2桁(約1km)で十分だが、それでは
// モナコやジブラルタルのような小さな地域が潰れるため、小さい地域だけ3桁で残す。
const COORD_DIGITS_DEFAULT = 2;
const COORD_DIGITS_SMALL = 3;
// 経緯度の幅がこれ未満なら「小さい地域」とみなす（度）
const SMALL_EXTENT_DEG = 3;

/** 1:50mに含まれない地域を、より詳細なデータセットから名前で補完する。 */
const SUPPLEMENTS = [
  { file: "ne_10m_admin_0_countries.geojson", nameJa: ["ジブラルタル"] },
  { file: "ne_10m_admin_0_map_units.geojson", nameJa: ["クリスマス島"] },
];

async function fetchGeoJson(cacheDir, file) {
  const cached = join(cacheDir, file);
  try {
    return JSON.parse(await readFile(cached, "utf8"));
  } catch {
    // 未取得なら落としてキャッシュする
  }
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(cached, text);
  return JSON.parse(text);
}

function lonLatExtent(node, box = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (typeof node[0] === "number") {
    box[0] = Math.min(box[0], node[0]);
    box[1] = Math.min(box[1], node[1]);
    box[2] = Math.max(box[2], node[0]);
    box[3] = Math.max(box[3], node[1]);
    return box;
  }
  for (const child of node) lonLatExtent(child, box);
  return box;
}

function roundCoords(node, digits) {
  if (typeof node[0] === "number") {
    return [Number(node[0].toFixed(digits)), Number(node[1].toFixed(digits))];
  }
  const rounded = node.map((child) => roundCoords(child, digits));
  // 丸めで重なった連続点を落とす。リング（座標の配列）のみが対象で、
  // 環を閉じるための終点は残す。
  if (typeof rounded[0]?.[0] !== "number") return rounded;
  const deduped = rounded.filter(
    (point, i) => i === 0 || point[0] !== rounded[i - 1][0] || point[1] !== rounded[i - 1][1],
  );
  return deduped.length >= 4 ? deduped : rounded;
}

function toFeature(source) {
  const p = source.properties;
  const [lon0, lat0, lon1, lat1] = lonLatExtent(source.geometry.coordinates);
  const small = Math.max(lon1 - lon0, lat1 - lat0) < SMALL_EXTENT_DEG;
  const digits = small ? COORD_DIGITS_SMALL : COORD_DIGITS_DEFAULT;
  return {
    type: "Feature",
    properties: {
      name: p.NAME,
      name_ja: p.NAME_JA || p.NAME,
      // Natural EarthはフランスやノルウェーのISO_A2を-99として持つため、補正版を優先する
      iso_a2: p.ISO_A2 && p.ISO_A2 !== "-99" ? p.ISO_A2 : p.ISO_A2_EH,
      iso_a3: p.ISO_A3,
      continent: p.CONTINENT,
    },
    geometry: { type: source.geometry.type, coordinates: roundCoords(source.geometry.coordinates, digits) },
  };
}

const cacheDir = await mkdtemp(join(tmpdir(), "ne-"));
const base = await fetchGeoJson(cacheDir, "ne_50m_admin_0_countries.geojson");
const features = base.features.map(toFeature);
const known = new Set(features.map((f) => f.properties.name_ja));

for (const { file, nameJa } of SUPPLEMENTS) {
  const data = await fetchGeoJson(cacheDir, file);
  for (const target of nameJa) {
    if (known.has(target)) continue;
    const found = data.features.find((f) => f.properties.NAME_JA === target);
    if (!found) throw new Error(`${file}: ${target} が見つからない`);
    features.push(toFeature(found));
    known.add(target);
  }
}

features.sort((a, b) => a.properties.name_ja.localeCompare(b.properties.name_ja, "ja"));
await writeFile(OUT, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`wrote ${features.length} features`);
