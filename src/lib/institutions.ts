import { t } from "../i18n/en";
import type { InstitutionKind } from "../types";

/**
 * The university list behind the sign-up and settings pickers.
 *
 * `public/data/institutions.json` is ~10k universities (rebuilt by
 * `scripts/build-institutions.mjs`), so it is fetched on first use instead of
 * being bundled, and kept in a module-level promise for the rest of the session.
 */

const DATA_URL = `${import.meta.env.BASE_URL}data/institutions.json`;

/** Most people find their school in the first few rows; the list is huge. */
export const MAX_RESULTS = 40;

export interface Institution {
  name: string;
  country: string;
  /** Domain of the institution's site, which is also its logo key. */
  domain: string;
  /** Name and country, normalized once so typing stays cheap. */
  haystack: string;
}

export interface InstitutionData {
  institutions: Institution[];
  /** Country names, sorted, for the manual-entry form. */
  countries: string[];
}

/** What a picker hands back: a listed university or a typed-in school. */
export interface InstitutionSelection {
  name: string;
  /** null for manual entries — no domain means no logo. */
  domain: string | null;
  country: string | null;
  kind: InstitutionKind;
}

/** The compact shape written by scripts/build-institutions.mjs. */
interface InstitutionFile {
  codes: string[];
  countries: Record<string, string>;
  rows: [name: string, codeIndex: number, domain: string][];
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function parse(file: InstitutionFile): InstitutionData {
  const countries = file.codes.map((code) => file.countries[code] ?? code);
  const institutions = file.rows.map(([name, codeIndex, domain]) => {
    const country = countries[codeIndex] ?? "";
    return { name, country, domain, haystack: normalizeText(`${name} ${country}`) };
  });
  return { institutions, countries: [...countries].sort((a, b) => a.localeCompare(b)) };
}

let pending: Promise<InstitutionData> | null = null;

/** Downloads the list once per session; a failed attempt can be retried. */
export function loadInstitutions(): Promise<InstitutionData> {
  pending ??= fetch(DATA_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`institutions: ${response.status}`);
      return parse((await response.json()) as InstitutionFile);
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

export interface InstitutionResults {
  matches: Institution[];
  /** How many rows matched in total, which is usually more than `matches`. */
  total: number;
}

/** Accent-insensitive: every term must appear in the name or the country. */
export function searchInstitutions(
  data: InstitutionData,
  query: string,
  limit = MAX_RESULTS,
): InstitutionResults {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return { matches: [], total: 0 };

  const matches: Institution[] = [];
  let total = 0;
  for (const institution of data.institutions) {
    if (!terms.every((term) => institution.haystack.includes(term))) continue;
    total += 1;
    if (matches.length < limit) matches.push(institution);
  }
  return { matches, total };
}

/** University years run past school grades, so the two lists differ. */
export function gradeOptions(kind: InstitutionKind): string[] {
  return kind === "high-school" ? t.institution.highSchoolGrades : t.institution.universityGrades;
}

/**
 * Profiles store the grade, not the kind of school, so the kind is read back
 * from what was saved: listed institutions are universities, and everyone else
 * is placed by the grade they picked.
 */
export function kindFromProfile(profile: { schoolDomain: string | null; grade: string | null }): InstitutionKind {
  if (profile.schoolDomain) return "university";
  const grade = profile.grade ?? "";
  return t.institution.highSchoolGrades.includes(grade) ? "high-school" : "university";
}

/** The picker's value for a profile that already has a school saved. */
export function selectionFromProfile(profile: {
  school: string;
  schoolDomain: string | null;
  schoolCountry: string | null;
  grade: string | null;
}): InstitutionSelection | null {
  if (!profile.school.trim()) return null;
  return {
    name: profile.school,
    domain: profile.schoolDomain,
    country: profile.schoolCountry,
    kind: kindFromProfile(profile),
  };
}
