export interface ContinentStyle {
  ja: string;
  light: string;
  dark: string;
}

// 7つの大陸カテゴリ用の配色。ユーザー指定の配色（北アメリカ=薄い青、ヨーロッパ=薄緑、
// アフリカ=黄、南アメリカ=薄い紫、アジア=オレンジ、オセアニア=薄い茶色、南極=灰色）に
// 基づく。ハイライトは別途赤で統一するため、赤と混同しないようこの7色には使わない。
export const CONTINENT_STYLES: Record<string, ContinentStyle> = {
  Africa: { ja: "アフリカ", light: "#f0d030", dark: "#e0c020" },
  Antarctica: { ja: "南極", light: "#b5b5b0", dark: "#8a8a85" },
  Asia: { ja: "アジア", light: "#f2994a", dark: "#e88a3a" },
  Europe: { ja: "ヨーロッパ", light: "#8fd3a0", dark: "#6bc47f" },
  "North America": { ja: "北アメリカ", light: "#8ec5e8", dark: "#6fb3e0" },
  Oceania: { ja: "オセアニア", light: "#c9a577", dark: "#b58a5a" },
  "South America": { ja: "南アメリカ", light: "#c8a2e0", dark: "#b98ce0" },
};

// Natural Earthデータ上の希少カテゴリ(仏領南方・南極地域のみ)は南極に統合する。
const CONTINENT_ALIAS: Record<string, string> = {
  "Seven seas (open ocean)": "Antarctica",
};

export function resolveContinent(rawContinent: string): string {
  return CONTINENT_ALIAS[rawContinent] ?? rawContinent;
}

export function continentSlug(continent: string): string {
  return continent.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
