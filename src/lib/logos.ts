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
