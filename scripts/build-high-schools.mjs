/**
 * Rebuilds public/data/schools/ — the high schools the sign-up and settings
 * pickers search, one file per country so a phone only downloads its own.
 *
 *   node scripts/build-high-schools.mjs
 *
 * Sources:
 * - Wikidata (CC0): every secondary school (high school, lycée, gymnasium,
 *   middle school…) with a country, in its English and local names, with the
 *   town it is in and its website. Closed schools are left out.
 * - OpenStreetMap (© OpenStreetMap contributors, ODbL) for countries where
 *   Wikidata knows almost nothing: Cambodia has 1 school there and hundreds on
 *   OpenStreetMap. The ODbL asks for credit, which the app shows next to the
 *   list and on the credits page, and that this derived list stay open.
 *
 * Thailand is excluded, as it is from the university list.
 *
 * Output:
 *   index.json    { sources, countries: { [code]: { name, count } } }
 *   <code>.json   { rows: [[name, otherName, place, domain, aliases]] }  (trailing blanks dropped)
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostOf, normalizeName, overpass, sparql } from "./lib/open-data.mjs";

const OUT_DIR = "public/data/schools";
const UNIVERSITIES = "public/data/institutions.json";
/** Hand-checked OpenStreetMap inclusions and search aliases, per country. */
const EXTRA = "scripts/high-schools-extra.json";
const EXCLUDED_CODES = new Set(["TH"]);
/** Countries whose list comes from OpenStreetMap as well as Wikidata. */
const OPENSTREETMAP_COUNTRIES = ["KH"];
/** Wikidata's "secondary school"; its subclasses cover high schools, lycées, gymnasiums… */
const SECONDARY_SCHOOL = "wd:Q159334";
/** Schools per details query: well under the query service's limits. */
const BATCH = 1500;

// ------------------------------------------------------------- countries --

const countryRows = await sparql(`
SELECT ?code ?country ?label (GROUP_CONCAT(DISTINCT ?lang; separator=",") AS ?langs) WHERE {
  ?country wdt:P297 ?code ; rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER NOT EXISTS { ?country wdt:P576 [] }
  OPTIONAL { ?country wdt:P37/wdt:P424 ?lang }
} GROUP BY ?code ?country ?label`);

// Country names match the university picker's where it has them ("Cambodia").
const universities = JSON.parse(await readFile(UNIVERSITIES, "utf8"));
const countries = new Map();
for (const row of countryRows) {
  const code = row.code.value;
  if (EXCLUDED_CODES.has(code) || countries.has(code)) continue;
  countries.set(code, {
    code,
    name: universities.countries[code] ?? row.label.value,
    // Local names come in the country's official languages; "mul" is
    // Wikidata's label for names written the same in every language.
    langs: [...new Set(["mul", ...(row.langs.value ? row.langs.value.split(",") : [])])].filter((lang) => /^[a-z-]{2,12}$/.test(lang)),
  });
}

// ------------------------------------------------------------- Wikidata --

// Every open secondary school and its country, in one query: walking the tree
// of school types is the slow part, so it is done once rather than per country.
const schoolsByCountry = new Map();
for (const row of await sparql(`
SELECT DISTINCT ?item ?code WHERE {
  ?item wdt:P31/wdt:P279* ${SECONDARY_SCHOOL} ; wdt:P17/wdt:P297 ?code .
  FILTER NOT EXISTS { ?item wdt:P576 [] }
}`)) {
  const code = row.code.value;
  if (!countries.has(code)) continue;
  const ids = schoolsByCountry.get(code) ?? new Set();
  ids.add(row.item.value.split("/").pop());
  schoolsByCountry.set(code, ids);
}

/** Names, town and website for a batch of schools, by id: no type tree to walk. */
function detailsQuery(ids, langs) {
  const languages = langs.map((lang) => `"${lang}"`).join(", ");
  return `
SELECT ?item (SAMPLE(?en) AS ?enName) (SAMPLE(?local) AS ?localName)
       (SAMPLE(?placeEn) AS ?placeEnName) (SAMPLE(?placeLocal) AS ?placeLocalName) (SAMPLE(?site) AS ?website)
WHERE {
  VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?local . FILTER(LANG(?local) IN (${languages})) }
  OPTIONAL {
    ?item wdt:P131 ?place .
    OPTIONAL { ?place rdfs:label ?placeEn . FILTER(LANG(?placeEn) = "en") }
    OPTIONAL { ?place rdfs:label ?placeLocal . FILTER(LANG(?placeLocal) IN (${languages})) }
  }
  OPTIONAL { ?item wdt:P856 ?site }
} GROUP BY ?item`;
}

async function wikidataSchools(country) {
  const ids = [...(schoolsByCountry.get(country.code) ?? [])].sort();
  const rows = [];
  for (let start = 0; start < ids.length; start += BATCH) {
    rows.push(...(await sparql(detailsQuery(ids.slice(start, start + BATCH), country.langs))));
  }
  return rows.map((row) => ({
    en: row.enName?.value ?? "",
    local: row.localName?.value ?? "",
    place: row.placeEnName?.value ?? row.placeLocalName?.value ?? "",
    domain: row.website ? hostOf(row.website.value) : null,
  }));
}

// -------------------------------------------------------- OpenStreetMap --

/** A secondary school by its name: high school, secondary, lycée, international school. */
const SECONDARY_NAME = /វិទ្យាល័យ|high\s*school|sen?con?dary|lyc[ée]e|international school|\bk-?12\b/i;
/** "University" in Khmer is សាកលវិទ្យាល័យ, which contains the word for high school. */
const NOT_SECONDARY = /សាកលវិទ្យាល័យ|universit|kindergarten|មត្តេយ្យ|pre-?school|driving|language (school|center|centre)/i;
const PRIMARY_ONLY = /(primary|បឋមសិក្សា)/i;
/** Things mapped as part of a school that are not one. */
const NOT_A_SCHOOL = /latrine|toilet|playground|canteen|dormitor|library|parking|football field|basketball court/i;
/** Names that are only the type of school, with nothing to tell it apart. */
const GENERIC = /^(high school|secondary school|school|វិទ្យាល័យ|អនុវិទ្យាល័យ|សាលា)$/i;

function osmTags(element) {
  const tags = element.tags ?? {};
  return {
    name: (tags.name ?? "").trim(),
    en: (tags["name:en"] ?? "").trim(),
    local: (tags["name:km"] ?? "").trim(),
    place: (tags["addr:city"] ?? tags["addr:province"] ?? tags["is_in:province"] ?? "").trim(),
    website: tags.website ?? tags["contact:website"] ?? tags.url ?? "",
    level: `${tags["isced:level"] ?? ""} ${tags["school:level"] ?? ""} ${tags.school ?? ""}`,
  };
}

async function openStreetMapSchools(code, include) {
  const elements = await overpass(`
[out:json][timeout:180];
area["ISO3166-1"="${code}"][admin_level=2]->.country;
nwr["amenity"="school"](area.country);
out tags;`);
  const schools = [];
  for (const element of elements) {
    const tags = osmTags(element);
    const names = `${tags.name} ${tags.en} ${tags.local}`;
    const taggedSecondary = /secondary|high|\b[23]\b/i.test(tags.level);
    if (!names.trim() || NOT_A_SCHOOL.test(names)) continue;
    const included = [tags.name, tags.en].some((name) => include.has(name));
    if (!included) {
      if (NOT_SECONDARY.test(names)) continue;
      if (!SECONDARY_NAME.test(names) && !taggedSecondary) continue;
      if (PRIMARY_ONLY.test(names) && !/sen?con?dary|high|វិទ្យាល័យ/i.test(names)) continue;
    }

    // English first; the Khmer (or other local) name goes alongside for search.
    const latin = (value) => /[a-z]/i.test(value) && !/[ក-៿]/.test(value);
    const en = tags.en || (latin(tags.name) ? tags.name : "");
    const local = tags.local || (!latin(tags.name) ? tags.name : "");
    schools.push({ en: en.replace(/\.$/, ""), local, place: tags.place, domain: tags.website ? hostOf(tags.website) : null });
  }
  return schools;
}

// ------------------------------------------------------------------ main --

/** One row per school; the same school from two sources (or twice in one) is kept once. */
function toRows(schools, aliases = {}) {
  const seen = new Map();
  for (const school of schools) {
    const name = (school.en || school.local).replace(/\s+/g, " ").trim();
    if (!name || GENERIC.test(name) || name.length > 150) continue;
    const other = school.local && school.local !== name ? school.local.replace(/\s+/g, " ").trim() : "";
    const key = `${normalizeName(name)}|${normalizeName(school.place)}`;
    const existing = seen.get(key);
    if (existing) {
      // Fill gaps from the duplicate rather than dropping what it knew.
      existing[1] ||= other;
      existing[3] ||= school.domain ?? "";
      continue;
    }
    // A fifth field holds other spellings: searched, never shown.
    seen.set(key, [name, other, school.place.slice(0, 80), school.domain ?? "", (aliases[name] ?? []).join(" · ")]);
  }
  return [...seen.values()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((row) => {
      while (row.length && !row[row.length - 1]) row.pop();
      return row;
    });
}

const extras = JSON.parse(await readFile(EXTRA, "utf8"));

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const index = {
  sources: {
    wikidata: "Wikidata (CC0)",
    openstreetmap: { attribution: "© OpenStreetMap contributors", license: "ODbL 1.0", countries: OPENSTREETMAP_COUNTRIES },
  },
  countries: {},
};

/** Wikidata's query service allows a few queries at once per client. */
const QUERIES_AT_ONCE = 3;

let total = 0;
let done = 0;
const todo = [...countries.values()].filter((country) => schoolsByCountry.has(country.code) || OPENSTREETMAP_COUNTRIES.includes(country.code));
const queue = [...todo];

async function worker() {
  while (queue.length) {
    const country = queue.shift();
    const schools = await wikidataSchools(country);
    const extra = extras[country.code] ?? {};
    if (OPENSTREETMAP_COUNTRIES.includes(country.code)) {
      schools.push(...(await openStreetMapSchools(country.code, new Set(extra.include ?? []))));
    }
    const rows = toRows(schools, extra.aliases);
    done += 1;
    process.stdout.write(`\r  ${done}/${todo.length} countries   `);
    if (rows.length) built.set(country.code, { country, rows });
  }
}

const built = new Map();
await Promise.all(Array.from({ length: QUERIES_AT_ONCE }, worker));
process.stdout.write("\n");

// A website that several schools list is a school board's or a government
// portal (tcdsb.org, gob.pe…), not any one school's, so it is dropped: as a
// logo key it would hand every one of those schools the same wrong logo.
const domainUses = new Map();
for (const { rows } of built.values()) {
  for (const row of rows) if (row[3]) domainUses.set(row[3], (domainUses.get(row[3]) ?? 0) + 1);
}
let sharedDropped = 0;
for (const { country, rows } of built.values()) {
  for (const row of rows) {
    if (row[3] && domainUses.get(row[3]) > 1) {
      row[3] = "";
      sharedDropped += 1;
    }
    while (row.length && !row[row.length - 1]) row.pop();
  }
  await writeFile(`${OUT_DIR}/${country.code}.json`, JSON.stringify({ rows }));
  index.countries[country.code] = { name: country.name, count: rows.length };
  total += rows.length;
}
console.log(`  dropped ${sharedDropped} websites shared by more than one school`);

index.countries = Object.fromEntries(
  Object.entries(index.countries).sort((a, b) => a[1].name.localeCompare(b[1].name)),
);
await writeFile(`${OUT_DIR}/index.json`, JSON.stringify(index));

const listed = Object.keys(index.countries);
console.log(`Wrote ${total} high schools in ${listed.length} countries to ${OUT_DIR}/`);
console.log(`  Cambodia: ${index.countries.KH?.count ?? 0}; Thailand: ${index.countries.TH ? "PRESENT (bug)" : "excluded"}`);
const largest = Object.entries(index.countries).sort((a, b) => b[1].count - a[1].count).slice(0, 8);
console.log(`  largest: ${largest.map(([code, value]) => `${code} ${value.count}`).join(", ")}`);
