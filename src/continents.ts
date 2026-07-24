export interface ContinentStyle {
  ja: string;
  light: string;
  dark: string;
}

// 7つの大陸カテゴリ用の配色。dataviz検証スクリプトでALL-PAIRS(全組み合わせ)の
// CVD分離・通常視力分離・輝度帯域・彩度下限をすべてPASSする組み合わせを
// OKLCH空間上のfarthest-point探索で選定している（デフォルトの8色カテゴリカル
// パレットは7色版でもALL-PAIRSを通過できなかったため、大陸専用に新規に導出した）。
export const CONTINENT_STYLES: Record<string, ContinentStyle> = {
  Africa: { ja: "アフリカ", light: "#540adb", dark: "#7304db" },
  Antarctica: { ja: "南極", light: "#00cd00", dark: "#00b500" },
  Asia: { ja: "アジア", light: "#c50000", dark: "#9b3f00" },
  Europe: { ja: "ヨーロッパ", light: "#ed65fb", dark: "#ef45a0" },
  "North America": { ja: "北アメリカ", light: "#008a9c", dark: "#009ee6" },
  Oceania: { ja: "オセアニア", light: "#723f71", dark: "#a90092" },
  "South America": { ja: "南アメリカ", light: "#ab821e", dark: "#008368" },
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
