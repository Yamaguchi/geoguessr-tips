import { load as loadYaml } from "js-yaml";
import categoriesData from "./data/categories.json";

const CATEGORY_SUBCATEGORIES: Record<string, string[]> = categoriesData;
export const CATEGORY_ORDER: readonly string[] = Object.keys(CATEGORY_SUBCATEGORIES);
export const SUBCATEGORY_ORDER: Readonly<Record<string, readonly string[]>> = CATEGORY_SUBCATEGORIES;
const CATEGORY_SET = new Set(CATEGORY_ORDER);

function validateTag(file: string, category: string, tag: string) {
  if (tag === category) return;
  const [prefix, ...rest] = tag.split("/");
  const subcategory = rest.join("/");
  if (!subcategory) {
    throw new Error(`${file}: tag "${tag}" is not in "カテゴリ/サブカテゴリ" form`);
  }
  if (!CATEGORY_SET.has(prefix)) {
    throw new Error(`${file}: tag "${tag}" has an unknown category prefix`);
  }
  const allowed = CATEGORY_SUBCATEGORIES[prefix];
  if (allowed.length > 0 && !allowed.includes(subcategory)) {
    throw new Error(
      `${file}: subcategory "${subcategory}" is not defined for category "${prefix}" in src/data/categories.json`,
    );
  }
}

export interface TipLocation {
  continent?: string;
  country?: string;
  area?: string;
}

export interface Tip {
  title: string;
  category: string;
  locations: TipLocation[];
  tags?: string[];
  body: string;
  file: string;
  image?: string;
  imageCredit?: string;
  streetView?: string;
}

interface TipFrontmatter {
  title?: string;
  category?: string;
  locations?: TipLocation[];
  tags?: string[];
  image?: string;
  image_credit?: string;
  street_view?: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const rawTipFiles = import.meta.glob("/tips/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseTip(file: string, raw: string): Tip | null {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return null;

  const [, frontmatterYaml, body] = match;
  const data = loadYaml(frontmatterYaml) as TipFrontmatter | undefined;
  if (!data?.title || !data.category || !Array.isArray(data.locations)) return null;

  if (!CATEGORY_SET.has(data.category)) {
    throw new Error(
      `${file}: category "${data.category}" is not defined in src/data/categories.json`,
    );
  }

  for (const tag of data.tags ?? []) validateTag(file, data.category, tag);

  return {
    title: data.title,
    category: data.category,
    locations: data.locations,
    tags: data.tags ?? [],
    body: body.trim(),
    file,
    image: data.image,
    imageCredit: data.image_credit,
    streetView: data.street_view,
  };
}

export const tips: Tip[] = Object.entries(rawTipFiles)
  .map(([file, raw]) => parseTip(file, raw))
  .filter((tip): tip is Tip => tip !== null);

export function tipsForCountry(continent: string, country: string): Tip[] {
  return tips.filter((tip) =>
    tip.locations.some(
      (loc) => loc.country === country || (!loc.country && loc.continent === continent),
    ),
  );
}

export function allTags(): string[] {
  const unique = new Set<string>();
  for (const tip of tips) {
    for (const tag of tip.tags ?? []) unique.add(tag);
  }
  return [...unique].sort((a, b) => a.localeCompare(b, "ja"));
}

export interface CountryTagMatch {
  country: string;
  tips: Tip[];
}

export function countriesForTagSelection(selectedTags: string[]): CountryTagMatch[] {
  if (selectedTags.length === 0) return [];

  const tagsByCategory = new Map<string, string[]>();
  for (const tag of selectedTags) {
    const category = tag.split("/")[0];
    const list = tagsByCategory.get(category) ?? [];
    list.push(tag);
    tagsByCategory.set(category, list);
  }

  const tipsByCountry = new Map<string, Tip[]>();
  for (const tip of tips) {
    for (const loc of tip.locations) {
      if (!loc.country) continue;
      const list = tipsByCountry.get(loc.country) ?? [];
      list.push(tip);
      tipsByCountry.set(loc.country, list);
    }
  }

  const results: CountryTagMatch[] = [];
  for (const [country, countryTips] of tipsByCountry) {
    const matchesAllCategories = [...tagsByCategory.values()].every((categoryTags) =>
      countryTips.some((tip) => categoryTags.some((tag) => tip.tags?.includes(tag))),
    );
    if (!matchesAllCategories) continue;
    const matchingTips = countryTips.filter((tip) => selectedTags.some((tag) => tip.tags?.includes(tag)));
    results.push({ country, tips: matchingTips });
  }
  return results;
}
