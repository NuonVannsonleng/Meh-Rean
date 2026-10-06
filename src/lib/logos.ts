/**
 * University logos downloaded by `scripts/build-logos.mjs` into public/logos/,
 * one `<domain>.webp` each. `index.json` lists which domains have one, so the
 * app never asks for a logo that is not there.
 */

const BASE = `${import.meta.env.BASE_URL}logos/`;

let pending: Promise<Set<string>> | null = null;

/** The domains with a downloaded logo; fetched once per session. */
export function loadLogoIndex(): Promise<Set<string>> {
  pending ??= fetch(`${BASE}index.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`logos: ${response.status}`);
      return new Set((await response.json()) as string[]);
    })
    .catch(() => {
      // Without the index, fall back to website icons; try again next time.
      pending = null;
      return new Set<string>();
    });
  return pending;
}

export function logoUrl(domain: string): string {
  return `${BASE}${domain}.webp`;
}

let pendingOfficial: Promise<Map<string, string>> | null = null;

/**
 * Hand-checked logos on schools' own websites (public/logos/official.json),
 * by domain, for schools Commons has no free logo for. Fetched once per session.
 */
export function loadOfficialLogos(): Promise<Map<string, string>> {
  pendingOfficial ??= fetch(`${BASE}official.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`official logos: ${response.status}`);
      const { links } = (await response.json()) as { links: Record<string, string> };
      return new Map(Object.entries(links));
    })
    .catch(() => {
      pendingOfficial = null;
      return new Map<string, string>();
    });
  return pendingOfficial;
}

/**
 * An official logo, shrunk to a small square by the wsrv.nl image CDN: school
 * sites are often slow, or serve a 3000px file for a 32px tile. Like the
 * favicon service, it is fetched by the viewer and nothing is stored here.
 */
export function officialLogoUrl(source: string): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(source)}&w=96&h=96&fit=contain&cbg=white&output=webp&default=404`;
}

export interface LogoCredit {
  /** The school or university the logo belongs to. */
  name?: string;
  /** The Commons file, e.g. "File:Seal of X.svg". */
  file: string;
  page: string;
  license: string;
  author: string;
  wikidata: string;
}

export async function loadLogoCredits(): Promise<Record<string, LogoCredit>> {
  const response = await fetch(`${BASE}credits.json`);
  if (!response.ok) throw new Error(`credits: ${response.status}`);
  return (await response.json()) as Record<string, LogoCredit>;
}
