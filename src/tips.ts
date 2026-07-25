import { load as loadYaml } from "js-yaml";

export interface TipLocation {
  continent?: string;
  country?: string;
  area?: string;
}

export interface Tip {
  title: string;
  category: string;
  locations: TipLocation[];
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

  return {
    title: data.title,
    category: data.category,
    locations: data.locations,
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
