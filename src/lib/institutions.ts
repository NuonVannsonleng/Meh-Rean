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
  /** Domain of the institution's site, which is also its logo key; "" when unknown. */
  domain: string;
  /** The name in the local language, when it differs (e.g. Khmer). */
  otherName?: string;
  /** Town or province, to tell apart schools with the same name. */
  place?: string;
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

// ---- High schools ----

const SCHOOLS_URL = `${import.meta.env.BASE_URL}data/schools/`;

export interface SchoolCountry {
  code: string;
  name: string;
  count: number;
}

interface SchoolIndexFile {
  countries: Record<string, { name: string; count: number }>;
}

interface SchoolFile {
  /** `aliases` are other spellings: searched, never shown. */
  rows: [name: string, otherName?: string, place?: string, domain?: string, aliases?: string][];
}

let schoolIndex: Promise<SchoolCountry[]> | null = null;
const schoolFiles = new Map<string, Promise<InstitutionData>>();

/**
 * Countries with a high-school list. Written by scripts/build-high-schools.mjs,
 * one file per country, so a phone only ever downloads its own country's.
 */
export function loadSchoolCountries(): Promise<SchoolCountry[]> {
  schoolIndex ??= fetch(`${SCHOOLS_URL}index.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`schools: ${response.status}`);
      const file = (await response.json()) as SchoolIndexFile;
      return Object.entries(file.countries).map(([code, value]) => ({ code, ...value }));
    })
    .catch((error: unknown) => {
      schoolIndex = null;
      throw error;
    });
  return schoolIndex;
}

/** One country's high schools, fetched once per session. */
export function loadSchools(country: SchoolCountry): Promise<InstitutionData> {
  let pending = schoolFiles.get(country.code);
  if (!pending) {
    pending = fetch(`${SCHOOLS_URL}${country.code}.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`schools ${country.code}: ${response.status}`);
        const file = (await response.json()) as SchoolFile;
        const institutions = file.rows.map(([name, otherName = "", place = "", domain = "", aliases = ""]) => ({
          name,
          otherName: otherName || undefined,
          place: place || undefined,
          country: country.name,
          domain,
          haystack: normalizeText(`${name} ${otherName} ${aliases} ${place} ${country.name}`),
        }));
        return { institutions, countries: [country.name] };
      })
      .catch((error: unknown) => {
        schoolFiles.delete(country.code);
        throw error;
      });
    schoolFiles.set(country.code, pending);
  }
  return pending;
}

const COUNTRY_KEY = "meh-rean:school-country";

/**
 * Which country's schools to show first: the last one picked, else Cambodia
 * for anyone on Phnom Penh time, else the region in the browser's language.
 */
export function guessSchoolCountry(countries: SchoolCountry[]): SchoolCountry | null {
  const known = (code: string | undefined) => countries.find((country) => country.code === code?.toUpperCase()) ?? null;
  try {
    const saved = known(localStorage.getItem(COUNTRY_KEY) ?? undefined);
    if (saved) return saved;
  } catch {
    // Storage blocked: fall through to the guesses.
  }
  if (Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Phnom_Penh") return known("KH");
  for (const language of navigator.languages ?? [navigator.language]) {
    const region = /^[a-z]{2,3}-([A-Za-z]{2})/.exec(language)?.[1];
    const match = known(region);
    if (match) return match;
  }
  return known("KH") ?? countries[0] ?? null;
}

export function rememberSchoolCountry(code: string): void {
  try {
    localStorage.setItem(COUNTRY_KEY, code);
  } catch {
    // Only a convenience.
  }
}

/** University students have a major; high-school students a track or a favourite subject. */
export function studyField(kind: InstitutionKind): { label: string; placeholder: string; suggestions: string[] } {
  return kind === "high-school"
    ? { label: t.institution.trackLabel, placeholder: t.institution.trackPlaceholder, suggestions: t.institution.trackSuggestions }
    : { label: t.institution.majorLabel, placeholder: t.institution.majorPlaceholder, suggestions: t.institution.majorSuggestions };
}

/** University years run past school grades, so the two lists differ. */
export function gradeOptions(kind: InstitutionKind): string[] {
  return kind === "high-school" ? t.institution.highSchoolGrades : t.institution.universityGrades;
}

/**
 * Profiles store the grade, not the kind of school, so the kind is read back
 * from the grade that was picked. High schools can have a website (and so a
 * domain) too, so the domain says nothing about the kind.
 */
export function kindFromProfile(profile: { schoolDomain: string | null; grade: string | null }): InstitutionKind {
  return t.institution.highSchoolGrades.includes(profile.grade ?? "") ? "high-school" : "university";
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
