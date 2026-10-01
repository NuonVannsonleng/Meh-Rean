/**
 * Downloads university logos into public/logos/ for the institution pickers
 * and profiles.
 *
 *   node scripts/build-logos.mjs
 *
 * Source: Wikidata links institutions to their logo, seal or icon on Wikimedia
 * Commons. Commons only hosts files that are freely licensed or too simple to
 * be copyrighted, and records each file's licence, so every logo here can be
 * redistributed; credits.json keeps the licence and author for each one.
 * Logos from elsewhere (university websites, English Wikipedia's "fair use"
 * uploads) are deliberately not used.
 *
 * Institutions are matched to public/data/institutions.json by official
 * website, then by exact name within the same country. Thailand is excluded,
 * as it is from the institution list itself.
 *
 * Downloads are cached in scripts/.logo-cache/, so a rerun only fetches what
 * changed. Logos are written as 96×96 WebP: they are shown at 32px at most.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";

const USER_AGENT = "MehReanLogoBuilder/1.0 (https://github.com/NuonVannsonleng/Meh-Rean; build script)";
const INSTITUTIONS = "public/data/institutions.json";
const OUT_DIR = "public/logos";
const CACHE_DIR = "scripts/.logo-cache";
const EXCLUDED_CODES = new Set(["TH"]);
/** Files reviewed by hand and found not to be logos. */
const EXCLUSIONS = "scripts/logo-exclusions.json";
/** Pixels on each side of the written logo. */
const SIZE = 96;
/** A standard Commons thumbnail width; non-standard widths are throttled. */
const THUMB_WIDTH = 250;
const DOWNLOADS_AT_ONCE = 4;
/** Subdomains that are just another door to the same university's site. */
const SAME_SITE_PREFIXES = new Set(["web", "www2", "www3", "home", "portal", "en", "english", "int", "international", "main"]);
/** Hosts shared by unrelated organisations, which never identify one. */
const SHARED_HOSTS = /(^|\.)(google|facebook|wikipedia|blogspot|wordpress|wix|github|linkedin|twitter|instagram|youtube)\./;
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

// ---------------------------------------------------------------- helpers --

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches and reads a whole body, retrying throttling, server errors and
 * dropped connections (a 50 MB query result can be cut off halfway).
 */
async function request(url, init = {}, attempt = 1) {
  try {
    const response = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init.headers } });
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await pause(Number(response.headers.get("retry-after")) * 1000 || 2000 * attempt);
      return request(url, init, attempt + 1);
    }
    return { ok: response.ok, status: response.status, body: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    if (attempt >= 6) throw error;
    await pause(3000 * attempt);
    return request(url, init, attempt + 1);
  }
}

/** Query results are cached for a day, so a rerun after a failure starts where it stopped. */
async function sparql(query) {
  const cached = `${CACHE_DIR}/query-${createHash("sha1").update(query).digest("hex")}.json`;
  if (existsSync(cached) && Date.now() - (await stat(cached)).mtimeMs < 86_400_000) {
    return JSON.parse(await readFile(cached, "utf8")).results.bindings;
  }
  const response = await request("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query }),
  });
  if (!response.ok) throw new Error(`Wikidata query failed: ${response.status} ${response.body.toString().slice(0, 200)}`);
  const parsed = JSON.parse(response.body.toString());
  await writeFile(cached, response.body);
  return parsed.results.bindings;
}

function hostOf(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\d*\./, "").replace(/\.$/, "");
    return host.includes(".") && !SHARED_HOSTS.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** "Special:FilePath/Seal%20of%20X.svg" → "File:Seal of X.svg" */
function fileTitle(filePathUrl) {
  return `File:${decodeURIComponent(filePathUrl.split("/").pop()).replace(/_/g, " ")}`;
}

function normalizeName(name) {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^the /, "")
    .trim();
}

function stripHtml(html = "") {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  // Commons often renders the author twice ("Unknown author Unknown author").
  return text.replace(/^(.+?) \1$/, "$1").slice(0, 200);
}

// ---------------------------------------------------------------- Wikidata --

/** Universities and colleges, with every image that could serve as a logo. */
const HIGHER_EDUCATION = `
SELECT ?item ?site ?icon ?logo ?seal ?label ?code WHERE {
  ?item wdt:P31/wdt:P279* wd:Q38723 .
  OPTIONAL { ?item wdt:P856 ?site }
  OPTIONAL { ?item wdt:P8972 ?icon }
  OPTIONAL { ?item wdt:P154 ?logo }
  OPTIONAL { ?item wdt:P158 ?seal }
  FILTER(BOUND(?icon) || BOUND(?logo) || BOUND(?seal))
  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item wdt:P17/wdt:P297 ?code }
}`;

/** Anything with a logo and a website: catches universities typed as something else. */
const ANY_ORGANISATION = `
SELECT ?item ?site ?logo WHERE { ?item wdt:P154 ?logo ; wdt:P856 ?site . }`;

function collect(rows) {
  const items = new Map();
  for (const row of rows) {
    const id = row.item.value.split("/").pop();
    const entry = items.get(id) ?? { id, hosts: new Set(), icon: new Set(), logo: new Set(), seal: new Set(), labels: new Set(), codes: new Set() };
    const host = row.site && hostOf(row.site.value);
    if (host) entry.hosts.add(host);
    for (const kind of ["icon", "logo", "seal"]) if (row[kind]) entry[kind].add(fileTitle(row[kind].value));
    if (row.label) entry.labels.add(normalizeName(row.label.value));
    if (row.code) entry.codes.add(row.code.value);
    items.set(id, entry);
  }
  return items;
}

function indexBy(items, keysOf) {
  const index = new Map();
  for (const item of items.values()) {
    for (const key of keysOf(item)) index.set(key, [...(index.get(key) ?? []), item]);
  }
  return index;
}

/** One item, or none when several different items claim the same key. */
function only(candidates) {
  return candidates?.length === 1 ? candidates[0] : null;
}

/** English (or any) labels for Wikidata items, 50 per request. */
async function entityLabels(ids) {
  const labels = new Map();
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const response = await request(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&languagefallback=1&ids=${batch.join("|")}`,
    );
    if (!response.ok) throw new Error(`Wikidata labels failed: ${response.status}`);
    for (const [id, entity] of Object.entries(JSON.parse(response.body.toString()).entities ?? {})) {
      const label = entity.labels?.en?.value ?? Object.values(entity.labels ?? {})[0]?.value;
      if (label) labels.set(id, label);
    }
  }
  return labels;
}

const STOP_WORDS = new Set(["the", "of", "and", "de", "la", "del", "da", "do", "di", "du", "des", "et", "y", "e", "für", "fur", "at", "in"]);
const SCHOOL_WORDS = /\b(universit\w*|univ|college|colegio|colegiul|institut\w*|school|ecole|escuela|escola|academ\w*|akadem\w*|hochschule|fachhochschule|polytechni\w*|politecni\w*|seminar\w*|daigaku|faculty|faculdade|facultad)\b/;

function words(name) {
  return new Set(normalizeName(name).split(" ").filter((word) => word.length > 1 && !STOP_WORDS.has(word)));
}

/** Whether an organisation's label plausibly names this university. */
function sameInstitution(name, label) {
  if (!label) return false;
  const a = words(name);
  const b = words(label);
  const shared = [...a].filter((word) => b.has(word)).length;
  // Most words in common, or a school-like name sharing at least one distinctive word.
  return shared / Math.max(1, Math.min(a.size, b.size)) >= 0.6 || (SCHOOL_WORDS.test(normalizeName(label)) && shared >= 1);
}

// ----------------------------------------------------------------- Commons --

async function imageInfo(titles) {
  const info = new Map();
  for (let start = 0; start < titles.length; start += 50) {
    const batch = titles.slice(start, start + 50);
    const response = await request("https://commons.wikimedia.org/w/api.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        maxlag: "5",
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: String(THUMB_WIDTH),
        iiextmetadatafilter: "LicenseShortName|Artist|AttributionRequired|NonFree",
        titles: batch.join("|"),
      }),
    });
    if (!response.ok) throw new Error(`Commons API failed: ${response.status}`);
    const body = JSON.parse(response.body.toString());
    const renamed = new Map((body.query?.normalized ?? []).map((item) => [item.to, item.from]));
    for (const page of body.query?.pages ?? []) {
      const image = page.imageinfo?.[0];
      if (!image || page.missing) continue;
      const meta = image.extmetadata ?? {};
      info.set(renamed.get(page.title) ?? page.title, {
        title: page.title,
        thumb: image.thumburl ?? image.url,
        page: image.descriptionurl,
        width: image.width,
        height: image.height,
        mime: image.mime ?? "",
        license: meta.LicenseShortName?.value ?? "",
        artist: stripHtml(meta.Artist?.value),
        attributionRequired: meta.AttributionRequired?.value === "true",
        nonFree: Boolean(meta.NonFree?.value),
      });
    }
    process.stdout.write(`\r  file details ${Math.min(start + 50, titles.length)}/${titles.length}`);
  }
  process.stdout.write("\n");
  return info;
}

/** The best image to show in a small square: an icon, else the squarest of logo and seal. */
function pickImage(item, info) {
  const usable = (title) => {
    const file = info.get(title);
    return file && !file.nonFree && !excluded.has(file.title) && file.width >= 32 && file.height >= 32 ? file : null;
  };
  for (const title of item.icon) {
    const file = usable(title);
    if (file) return file;
  }
  const squareness = (file) => Math.min(file.width, file.height) / Math.max(file.width, file.height);
  const options = [...item.logo, ...item.seal].map(usable).filter(Boolean);
  // Drawn files first: a JPEG "logo" is sometimes a photo of a building or a
  // statue. Then a wide wordmark, unreadable at 32px, loses to a squarer seal.
  return options.sort((a, b) => isPhotoFormat(a) - isPhotoFormat(b) || squareness(b) - squareness(a))[0] ?? null;
}

/** Formats that photos come in; drawn logos are SVG, PNG or GIF. */
function isPhotoFormat(file) {
  return /^image\/(jpeg|tiff)$/.test(file.mime) ? 1 : 0;
}

/**
 * Busy images are photos; logos are a few flat colours. Measured on the
 * grayscale thumbnail, so colour noise in a scan does not count.
 */
// Set by reviewing every JPEG logo sorted by this score: below it they are
// logos, above it mostly photos of campuses, buildings and photographed seals.
const PHOTO_ENTROPY = Number(process.env.PHOTO_ENTROPY ?? 6.5);

async function entropyOf(source) {
  return (await sharp(source).grayscale().stats()).entropy;
}

async function download(url) {
  const cached = `${CACHE_DIR}/${createHash("sha1").update(url).digest("hex")}`;
  if (existsSync(cached)) return readFile(cached);
  const response = await request(url);
  if (!response.ok) throw new Error(`${response.status}`);
  await writeFile(cached, response.body);
  return response.body;
}

// -------------------------------------------------------------------- main --

const data = JSON.parse(await readFile(INSTITUTIONS, "utf8"));
const excluded = new Set(Object.keys(JSON.parse(await readFile(EXCLUSIONS, "utf8")).files));
const institutions = data.rows
  .map(([name, codeIndex, domain]) => ({ name, code: data.codes[codeIndex], domain: domain.toLowerCase().replace(/^www\d*\./, "") }))
  .filter((row) => !EXCLUDED_CODES.has(row.code) && DOMAIN.test(row.domain));

await mkdir(CACHE_DIR, { recursive: true });
console.log("Querying Wikidata…");
const higherEducation = collect(await sparql(HIGHER_EDUCATION));
const organisations = collect(await sparql(ANY_ORGANISATION));
for (const items of [higherEducation, organisations]) {
  for (const [id, item] of items) if ([...item.codes].some((code) => EXCLUDED_CODES.has(code))) items.delete(id);
}
console.log(`  ${higherEducation.size} universities and colleges, ${organisations.size} organisations with a logo`);

const byHost = indexBy(higherEducation, (item) => item.hosts);
const anyByHost = indexBy(organisations, (item) => item.hosts);
const byName = indexBy(higherEducation, (item) => [...item.labels].flatMap((label) => [...item.codes].map((code) => `${code}|${label}`)));

const matches = new Map();
const how = { website: 0, subdomain: 0, other: 0, name: 0 };
/** Matched only through some organisation sharing the website; checked by name below. */
const otherCandidates = [];
for (const row of institutions) {
  let item = only(byHost.get(row.domain));
  let method = "website";
  if (!item) {
    // "web.uni.edu" on Wikidata for "uni.edu" here, but never "law.uni.edu".
    const prefixed = [...SAME_SITE_PREFIXES].map((prefix) => only(byHost.get(`${prefix}.${row.domain}`))).find(Boolean);
    if (prefixed) [item, method] = [prefixed, "subdomain"];
  }
  if (!item) {
    const other = only(anyByHost.get(row.domain));
    if (other) {
      otherCandidates.push({ row, other });
      continue;
    }
  }
  if (!item) {
    const named = only(byName.get(`${row.code}|${normalizeName(row.name)}`));
    if (named) [item, method] = [named, "name"];
  }
  if (!item) continue;
  how[method] += 1;
  matches.set(row.domain, item);
}
// Another organisation can share a university's website (a domain registry run
// from the campus, a hospital…), so its name has to look like the university's.
const labels = await entityLabels(otherCandidates.map(({ other }) => other.id));
for (const { row, other } of otherCandidates) {
  const label = labels.get(other.id) ?? "";
  if (sameInstitution(row.name, label)) {
    how.other += 1;
    matches.set(row.domain, other);
  } else if (!matches.has(row.domain)) {
    const named = only(byName.get(`${row.code}|${normalizeName(row.name)}`));
    if (named) {
      how.name += 1;
      matches.set(row.domain, named);
    }
  }
}
console.log(`  matched ${matches.size} of ${institutions.length}: ${JSON.stringify(how)}`);
console.log(`  rejected ${otherCandidates.length - how.other} organisations that only shared a website`);

console.log("Reading licences from Commons…");
const titles = [...new Set([...matches.values()].flatMap((item) => [...item.icon, ...item.logo, ...item.seal]))];
const info = await imageInfo(titles);

await mkdir(CACHE_DIR, { recursive: true });
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const credits = {};
const failed = [];
const photoChecks = [];
let skippedPhotos = 0;
const queue = [...matches.entries()];
let done = 0;

async function worker() {
  while (queue.length) {
    const [domain, item] = queue.shift();
    const file = pickImage(item, info);
    done += 1;
    if (!file) continue;
    try {
      const source = await download(file.thumb);
      const entropy = await entropyOf(source);
      photoChecks.push({ domain, entropy: Math.round(entropy * 100) / 100, file: file.title, mime: file.mime });
      if (isPhotoFormat(file)) {
        if (entropy > PHOTO_ENTROPY) {
          skippedPhotos += 1;
          continue;
        }
      }
      await sharp(source, { failOn: "none" })
        .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 82, alphaQuality: 90, effort: 5 })
        .toFile(`${OUT_DIR}/${domain}.webp`);
      credits[domain] = { file: file.title, page: file.page, license: file.license, author: file.artist, wikidata: item.id };
    } catch (error) {
      failed.push(`${domain}: ${error.message}`);
    }
    if (done % 50 === 0) process.stdout.write(`\r  logos ${done}/${matches.size}`);
  }
}

console.log("Downloading logos…");
await Promise.all(Array.from({ length: DOWNLOADS_AT_ONCE }, worker));
process.stdout.write(`\r  logos ${matches.size}/${matches.size}\n`);

const domains = Object.keys(credits).sort();
const sortedCredits = Object.fromEntries(domains.map((domain) => [domain, credits[domain]]));
await writeFile(`${OUT_DIR}/index.json`, JSON.stringify(domains));
await writeFile(`${OUT_DIR}/credits.json`, JSON.stringify(sortedCredits));

// Kept for reviewing the threshold: every logo with its score, calmest first.
await writeFile(`${CACHE_DIR}/photo-checks.json`, JSON.stringify(photoChecks.sort((a, b) => a.entropy - b.entropy), null, 1));
console.log(`  ${photoChecks.filter(isPhotoFormat).length} JPEG/TIFF logos checked, ${skippedPhotos} skipped as photos (entropy > ${PHOTO_ENTROPY})`);
const files = await readdir(OUT_DIR);
console.log(`Wrote ${domains.length} logos to ${OUT_DIR}/ (${files.length - 2} files), with index.json and credits.json`);
if (failed.length) console.log(`${failed.length} could not be processed:\n  ${failed.slice(0, 20).join("\n  ")}`);
