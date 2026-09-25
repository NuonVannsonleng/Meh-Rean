/**
 * Rebuilds public/data/institutions.json — the university list the sign-up and
 * settings pickers search.
 *
 *   node scripts/build-institutions.mjs
 *
 * Source: Hipo/university-domains-list (CC0), ~10k universities in 200+
 * countries, each with a domain. The domain is what gives us a logo, so rows
 * without one are dropped.
 *
 * Thailand is excluded on purpose — a product decision, not a data limitation.
 *
 * The file is written compactly (a country lookup plus [name, countryIndex,
 * domain] rows) because the browser fetches it whole when a picker opens.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const OUTPUT = "public/data/institutions.json";
const EXTRA = "scripts/institutions-extra.json";
const EXCLUDED_COUNTRIES = new Set(["Thailand"]);
const EXCLUDED_CODES = new Set(["TH"]);
/** A bare hostname: a typo here silently shows another organisation's logo. */
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`Could not download the source list: ${response.status} ${response.statusText}`);
  process.exitCode = 1;
} else {
  const source = await response.json();

  const kept = source.filter(
    (row) =>
      row.name &&
      row.alpha_two_code &&
      row.domains?.[0] &&
      !EXCLUDED_COUNTRIES.has(row.country) &&
      !EXCLUDED_CODES.has(row.alpha_two_code),
  );

  // Counted before the supplement is merged in, so it describes the upstream
  // list only and can never go negative.
  const excluded = source.length - kept.length;

  // Institutions the upstream list is missing, with hand-checked domains.
  const { institutions: extra } = JSON.parse(await readFile(EXTRA, "utf8"));
  const known = new Set(kept.map((row) => row.domains[0].toLowerCase()));

  // Every supplement row states its own country: inheriting the label from
  // whichever upstream row shares its code would hide a mistake here, and the
  // country is also what the Thailand exclusion is applied to.
  const invalid = extra.filter((row) => !row.country || !HOSTNAME.test(row.domain.toLowerCase()));
  if (invalid.length) {
    for (const row of invalid) {
      console.error(
        !row.country
          ? `${EXTRA}: "${row.name}" is missing a country`
          : `${EXTRA}: "${row.name}" has an invalid domain "${row.domain}" (expected a bare hostname)`,
      );
    }
    process.exitCode = 1;
    process.exit();
  }

  const added = extra
    .filter(
      (row) =>
        !EXCLUDED_CODES.has(row.code) &&
        !EXCLUDED_COUNTRIES.has(row.country) &&
        !known.has(row.domain.toLowerCase()),
    )
    .map((row) => ({ name: row.name, alpha_two_code: row.code, country: row.country, domains: [row.domain] }));
  kept.push(...added);

  const codes = [...new Set(kept.map((row) => row.alpha_two_code))].sort();
  const countries = Object.fromEntries(
    codes.map((code) => [code, kept.find((row) => row.alpha_two_code === code && row.country)?.country ?? code]),
  );

  const rows = kept
    .map((row) => [row.name.trim(), codes.indexOf(row.alpha_two_code), row.domains[0].toLowerCase()])
    .sort((a, b) => a[0].localeCompare(b[0]));

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify({ codes, countries, rows }));

  console.log(`Wrote ${OUTPUT}: ${rows.length} universities, ${codes.length} countries`);
  console.log(`Excluded ${excluded} upstream rows (Thailand, or missing a name/domain)`);
  console.log(`Added ${added.length} from ${EXTRA}`);
}
