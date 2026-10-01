/**
 * Shared fetching for the build scripts that read open data: Wikidata,
 * Wikimedia Commons and OpenStreetMap. Every request identifies the project,
 * retries throttling and dropped connections, and big query results are cached
 * so a rerun after a failure starts where it stopped.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

export const USER_AGENT = "MehReanDataBuilder/1.0 (https://github.com/NuonVannsonleng/Meh-Rean; build script)";
export const CACHE_DIR = "scripts/.logo-cache";
const CACHE_MS = 24 * 60 * 60 * 1000;

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetches and reads a whole body, retrying 429s, 5xx and dropped connections. */
export async function request(url, init = {}, attempt = 1) {
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

async function cached(key, produce) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = `${CACHE_DIR}/${key}.json`;
  if (existsSync(file) && Date.now() - (await stat(file)).mtimeMs < CACHE_MS) {
    return JSON.parse(await readFile(file, "utf8"));
  }
  const value = await produce();
  await writeFile(file, JSON.stringify(value));
  return value;
}

function hash(text) {
  return createHash("sha1").update(text).digest("hex");
}

/** Runs a Wikidata SPARQL query; results are cached for a day. */
export function sparql(query) {
  return cached(`query-${hash(query)}`, async () => {
    const response = await request("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query }),
    });
    if (!response.ok) {
      const error = new Error(`Wikidata query failed: ${response.status} ${response.body.toString().slice(0, 200)}`);
      error.status = response.status;
      throw error;
    }
    return JSON.parse(response.body.toString()).results.bindings;
  });
}

/** The main Overpass server is often busy; these mirrors are listed by the OSM wiki. */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Runs an OpenStreetMap Overpass query, trying each mirror in turn; cached for a day. */
export function overpass(query) {
  return cached(`overpass-${hash(query)}`, async () => {
    let last = "";
    for (const endpoint of OVERPASS) {
      const response = await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) return JSON.parse(response.body.toString()).elements;
      last = `${endpoint}: ${response.status}`;
    }
    throw new Error(`OpenStreetMap query failed on every mirror (last ${last})`);
  });
}

/** A bare hostname, or null for anything that is not a usable site of its own. */
const SHARED_HOSTS = /(^|\.)(google|facebook|wikipedia|blogspot|wordpress|wix|github|linkedin|twitter|instagram|youtube|weebly|sites)\./;
export const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** A bare government or education registry ("gob.pe", "gov.uk"): never one school's. */
const REGISTRY_HOST = /^(gov|gob|go|govt|gouv|government|edu|ac|sch|k12|mil|org|com|net)\.[a-z]{2,3}$/;

export function hostOf(raw) {
  try {
    const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`;
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\d*\./, "").replace(/\.$/, "");
    return DOMAIN.test(host) && !SHARED_HOSTS.test(host) && !REGISTRY_HOST.test(host) ? host : null;
  } catch {
    return null;
  }
}

export function normalizeName(name) {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^the /, "")
    .trim();
}
