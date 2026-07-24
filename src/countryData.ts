import flagManifest from "./data/flags/manifest.json";
import domainsData from "./data/domains.json";

interface FlagManifestEntry {
  name_ja: string;
  name: string;
  iso_a2: string;
  flag: string | null;
}

interface DomainEntry {
  name_ja: string;
  name: string;
  iso_a2: string;
  tld: string[];
}

const flagUrlByCountry = new Map<string, string>();
for (const entry of flagManifest as FlagManifestEntry[]) {
  if (!entry.flag) continue;
  flagUrlByCountry.set(entry.name_ja, `${import.meta.env.BASE_URL}flags/${entry.flag}`);
}

const tldsByCountry = new Map<string, string[]>((domainsData as DomainEntry[]).map((entry) => [entry.name_ja, entry.tld]));

export function flagUrlForCountry(nameJa: string): string | undefined {
  return flagUrlByCountry.get(nameJa);
}

export function tldsForCountry(nameJa: string): string[] {
  return tldsByCountry.get(nameJa) ?? [];
}
