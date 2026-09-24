#!/usr/bin/env node
/**
 * End-to-end harness for accounts, uploads and authorization.
 *
 * It drives a real Supabase instance with nothing but the public anon key,
 * using the same calls the app makes in src/services/supabaseApi.ts. Accounts
 * are always created through supabase.auth — never inserted into the database.
 *
 * Target resolution: the first source that supplies BOTH a URL and a key wins,
 * so the two can never come from different projects.
 *   process.env  →  .env.test  →  .env.local
 *   SUPABASE_URL      | VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY | VITE_SUPABASE_ANON_KEY | VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Safety: this harness writes and deletes real rows, so it refuses to run
 * (exit code 2) unless the target is clearly a throwaway instance. The host is
 * normalized first — brackets stripped, trailing dots dropped, lowercased — and
 * a host containing "%" is refused outright.
 *   - a local host (127.0.0.1, localhost, ::1, *.local) runs with no extra flags
 *   - any other host requires ALLOW_TEST_DATA=1
 *   - a hosted Supabase host (*.supabase.co) is treated as production and needs
 *     ALLOW_TEST_DATA=1 *and* MEH_REAN_TEST_ENV_CONFIRMED set to that host — a
 *     deliberate double opt-in, so a stale ALLOW_TEST_DATA in a shell can never
 *     be enough on its own.
 *   - whatever the host looks like, a non-local target matching the project in
 *     .env.local (the app's own project) is refused, and no flag overrides that.
 *
 * Keys, passwords and tokens are never printed, and no refusal prints a
 * ready-to-paste override with the target host filled in.
 *
 * Exit codes: 0 all required tests passed, 1 a required test failed,
 * 2 the environment was refused.
 *
 * Usage: npm run test:accounts
 */

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attachments";
const DB_CONTAINER = "supabase_db_Meh_Rean";
const REPO_ROOT = new URL("../", import.meta.url);
const CONFIG_PATH = new URL("supabase/config.toml", REPO_ROOT);

// ---- Reporting -------------------------------------------------------------

const SECTIONS = ["Environment", "Authentication", "Uploads", "Authorization", "Roles", "Cleanup"];
const report = new Map(SECTIONS.map((name) => [name, []]));
const tally = { passed: 0, failed: 0, skipped: 0 };

function pass(section, name, detail) {
  tally.passed += 1;
  report.get(section).push({ mark: "✓", name, detail });
}

function skip(section, name, reason) {
  tally.skipped += 1;
  report.get(section).push({ mark: "○", name, detail: reason });
}

function fail(section, name, failure) {
  tally.failed += 1;
  report.get(section).push({ mark: "✗", name, failure });
}

function note(section, text) {
  report.get(section).push({ text });
}

function describe(error) {
  if (!error) return "no error";
  if (typeof error === "string") return error;
  const code = error.code ?? error.statusCode ?? error.status;
  return code ? `${error.message} (${code})` : (error.message ?? String(error));
}

/** Numeric HTTP status carried by a Supabase auth, PostgREST or storage error. */
function errorStatus(error) {
  const raw = error?.statusCode ?? error?.status ?? error?.code;
  const numeric = Number(raw);
  return Number.isInteger(numeric) ? numeric : null;
}

/**
 * True only when an error is the specific refusal a check expects. Without this,
 * "an error happened" passes — and an unapplied schema, a renamed column or an
 * unreachable target would all masquerade as a policy doing its job.
 */
function refusalMatches(error, shape) {
  if (!error) return false;
  const status = errorStatus(error);
  if (status !== null && (shape.statuses ?? []).includes(status)) return true;
  const text = [error.message, error.error, error.details, error.hint, error.code]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return (shape.phrases ?? []).some((phrase) => text.includes(phrase));
}

/** A policy refusal: PostgREST answers 401/403, Postgres raises 42501. */
const RLS_REFUSAL = {
  statuses: [401, 403],
  phrases: ["row-level security", "violates row-level security", "unauthorized", "not authorized", "42501"],
};

/** The storage service refusing an object larger than the bucket's file_size_limit. */
const SIZE_REFUSAL = {
  statuses: [413],
  phrases: ["exceeded the maximum allowed size", "payload too large", "entity too large", "maximum allowed size"],
};

const RLS_SHAPE = "a 401/403 or row-level-security refusal";
const SIZE_SHAPE = "a 413 or “exceeded the maximum allowed size” refusal";

/** Runs one check; anything thrown becomes a failure rather than killing the run. */
async function check(section, name, run) {
  try {
    const outcome = (await run()) ?? { ok: true };
    if (outcome.skipped) skip(section, name, outcome.reason);
    else if (outcome.ok) pass(section, name, outcome.detail);
    else fail(section, name, outcome);
  } catch (error) {
    fail(section, name, {
      expected: "the check to complete",
      actual: `threw ${describe(error)}`,
      cause: "unexpected error in the harness, or the target became unreachable",
      where: "scripts/test-accounts.mjs",
    });
  }
}

function printReport() {
  for (const section of SECTIONS) {
    const lines = report.get(section);
    if (!lines.length) continue;
    console.log(`\n${section}`);
    console.log("=".repeat(section.length));
    for (const line of lines) {
      if (line.text !== undefined) {
        console.log(`  · ${line.text}`);
        continue;
      }
      console.log(`  ${line.mark} ${line.name}${line.detail ? ` — ${line.detail}` : ""}`);
      if (line.failure) {
        console.log(`      Expected:          ${line.failure.expected}`);
        console.log(`      Actual:            ${line.failure.actual}`);
        console.log(`      Likely root cause: ${line.failure.cause}`);
        console.log(`      File or policy:    ${line.failure.where}`);
      }
    }
  }
  console.log(`\nPassed ${tally.passed}   Failed ${tally.failed}   Skipped ${tally.skipped}`);
}

function refuse(reason, hint) {
  console.error(`\nRefusing to run: ${reason}`);
  if (hint) console.error(hint);
  process.exit(2);
}

// ---- Environment -----------------------------------------------------------

/** Minimal KEY=value reader so the harness needs no dotenv dependency. */
function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().replace(/^export\s+/, "");
    let value = line.slice(separator + 1).trim();
    const quoted = value.length > 1 && (value.startsWith('"') || value.startsWith("'"));
    if (quoted && value.endsWith(value[0])) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const envTest = parseEnvFile(new URL(".env.test", REPO_ROOT));
const envLocal = parseEnvFile(new URL(".env.local", REPO_ROOT));

const URL_NAMES = ["SUPABASE_URL", "VITE_SUPABASE_URL"];
const KEY_NAMES = ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"];

function pick(source, names) {
  for (const name of names) {
    const value = source[name]?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * URL and key are resolved together, from one source, in priority order. Picking
 * them independently would let a URL from .env.test be paired with a key from
 * .env.local — the harness would then aim at one project holding another
 * project's credentials.
 */
const CANDIDATE_SOURCES = [
  { name: "process.env", values: process.env },
  { name: ".env.test", values: envTest },
  { name: ".env.local", values: envLocal },
];

let targetUrl = "";
let anonKey = "";
let configSource = "";
for (const candidate of CANDIDATE_SOURCES) {
  const url = pick(candidate.values, URL_NAMES);
  const key = pick(candidate.values, KEY_NAMES);
  if (url && key) {
    targetUrl = url;
    anonKey = key;
    configSource = candidate.name;
    break;
  }
}

if (!targetUrl || !anonKey) {
  refuse(
    "no Supabase target is configured.",
    "One source must supply BOTH a URL and a key. Set SUPABASE_URL and SUPABASE_ANON_KEY,\n" +
      "or put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.test (preferred for\n" +
      "tests) or .env.local.",
  );
}

/**
 * Hostnames are compared, never pattern-matched loosely: an IPv6 literal keeps
 * its brackets, a fully qualified name keeps its trailing root dot, and case is
 * arbitrary — so "https://abc.supabase.co." must classify as hosted, not remote.
 */
function hostOf(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  let value = parsed.hostname.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  value = value.replace(/\.+$/, "");
  return value || null;
}

const host = hostOf(targetUrl);
if (!host) refuse("the configured Supabase URL is not a valid URL.", `It came from ${configSource}.`);
if (host.includes("%")) {
  refuse(
    "the configured Supabase host contains a percent-encoded character.",
    "Percent-encoding can hide the real host from these checks, so the target is refused outright.\n" +
      `Fix the URL in ${configSource}.`,
  );
}

const isLoopback = host === "127.0.0.1" || host === "localhost" || host === "::1";
const isLocal = isLoopback || host.endsWith(".local");
const isHosted = host === "supabase.co" || host.endsWith(".supabase.co");

/**
 * Identity guard: whatever the host looks like, never touch the project the app
 * itself is configured against. This compares hosts rather than string patterns,
 * so no flag and no creative URL spelling can get past it.
 */
const appHost = hostOf(pick(envLocal, ["VITE_SUPABASE_URL"]));
if (appHost && appHost === host && !isLocal) {
  refuse(
    "the target is the same Supabase project the app is configured to use in .env.local.",
    "This harness creates and deletes real accounts, posts and files, so it never runs\n" +
      "against the app's own project. No environment variable overrides this.\n" +
      "Point .env.test at a throwaway instance (`npx supabase start`) instead.",
  );
}

if (isHosted) {
  const allowed = process.env.ALLOW_TEST_DATA === "1";
  const confirmed = process.env.MEH_REAN_TEST_ENV_CONFIRMED === host;
  if (!allowed || !confirmed) {
    refuse(
      `${host} is a hosted Supabase project, which this harness treats as production.`,
      "It creates and deletes real accounts, posts and files. Running it anyway needs BOTH of\n" +
        "these environment variables, set deliberately:\n" +
        "  ALLOW_TEST_DATA=1\n" +
        "  MEH_REAN_TEST_ENV_CONFIRMED  — the target host exactly as it appears in that\n" +
        "                                 project's Supabase URL, typed out by you.\n" +
        "Point .env.test at a local `npx supabase start` instance instead if you can.",
    );
  }
}

if (!isLocal && process.env.ALLOW_TEST_DATA !== "1") {
  refuse(`${host} is not a local Supabase instance.`, "Set ALLOW_TEST_DATA=1 to allow a remote target.");
}

/** The storage service limit, which is smaller than the app's own check. */
function bucketLimitBytes() {
  if (!existsSync(CONFIG_PATH)) return null;
  const match = readFileSync(CONFIG_PATH, "utf8").match(/^\s*file_size_limit\s*=\s*"([^"]+)"/m);
  if (!match) return null;
  const parts = match[1].trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|KiB|MiB|GiB)?$/i);
  if (!parts) return null;
  const units = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3 };
  return Math.round(Number(parts[1]) * units[(parts[2] ?? "B").toLowerCase()]);
}

const APP_MAX_FILE_BYTES = 50 * 1024 * 1024; // mirrors MAX_FILE_BYTES in src/lib/attachments.ts
const APP_MAX_FILES_PER_POST = 10; // mirrors MAX_FILES_PER_POST in src/lib/attachments.ts
const storageLimit = bucketLimitBytes();

const runId = randomBytes(3).toString("hex");
const marker = `e2e-${runId}`;
const password = `Pw-${randomBytes(12).toString("hex")}`;

note("Environment", `Host: ${host} (${isLocal ? "local" : "remote"})`);
note("Environment", `URL and key both read from: ${configSource}`);
note("Environment", `Run marker: ${marker}`);
note("Environment", `Storage limit from supabase/config.toml: ${storageLimit ? `${storageLimit} bytes` : "unknown"}`);
note("Environment", `App limits: ${APP_MAX_FILE_BYTES} bytes per file, ${APP_MAX_FILES_PER_POST} files per post (the per-file limit is also set on the bucket)`);
pass("Environment", "target accepted", isLocal ? "local instance" : "remote instance with ALLOW_TEST_DATA=1");

// ---- Clients and fixtures --------------------------------------------------

function makeClient() {
  return createClient(targetUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const anon = makeClient();

const accounts = {
  a: { letter: "a", label: "A (student, uploads)" },
  b: { letter: "b", label: "B (student, uploads)" },
  c: { letter: "c", label: "C (student, no uploads)" },
  d: { letter: "d", label: "D (admin)" },
};

for (const account of Object.values(accounts)) {
  account.email = `test-${marker}-${account.letter}@example.invalid`;
  account.username = `e2e${runId}${account.letter}`;
  account.displayName = `E2E ${account.letter.toUpperCase()} ${runId}`;
  account.client = makeClient();
  account.id = null;
}

const createdPaths = [];
const createdPosts = [];

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const TINY_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

/** Mirrors detectAttachmentKind in src/lib/attachments.ts for the kinds used here. */
function attachmentKind(mimeType, name) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const byExtension = { pdf: "pdf", txt: "document", md: "document", zip: "archive", csv: "spreadsheet" };
  return byExtension[extension] ?? "other";
}

function publicUrl(client, path) {
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Same upload-then-insert sequence, and the same path format, as createPost(). */
async function createPostAs(account, title, files) {
  const postId = randomUUID();
  const attachments = [];

  for (const [index, file] of files.entries()) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${account.id}/${postId}/${index}-${safeName}`;
    const contentType = file.type || "application/octet-stream";
    const upload = await account.client.storage
      .from(BUCKET)
      .upload(path, new Blob([file.bytes], { type: contentType }), { contentType, upsert: false });
    if (upload.error) return { error: upload.error, attachments };
    createdPaths.push({ path, account });
    attachments.push({
      id: path,
      name: file.name,
      mimeType: contentType,
      size: file.bytes.byteLength,
      kind: attachmentKind(contentType, file.name),
      url: publicUrl(account.client, path),
    });
  }

  const insert = await account.client.from("posts").insert({
    id: postId,
    author_id: account.id,
    title,
    body: `Created by the Meh Rean end-to-end harness (${marker}).`,
    subject: "computer-science",
    level: "university",
    tags: [marker],
    attachments,
  });
  if (insert.error) return { error: insert.error, attachments };

  createdPosts.push({ id: postId, account });
  return { postId, attachments };
}

async function listFolder(client, prefix) {
  const { data, error } = await client.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) return [];
  const paths = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) paths.push(...(await listFolder(client, path)));
    else paths.push(path);
  }
  return paths;
}

async function headStatus(url) {
  const response = await fetch(url);
  const bytes = await response.arrayBuffer();
  return { status: response.status, size: bytes.byteLength };
}

// ---- Authentication --------------------------------------------------------

async function signUpAndIn(account) {
  const available = await account.client.rpc("username_available", { name: account.username });
  if (available.error) {
    return {
      ok: false,
      expected: "username_available() to answer",
      actual: describe(available.error),
      cause: "the schema has not been applied to this instance",
      where: "supabase/schema.sql — username_available()",
    };
  }
  if (available.data === false) {
    return {
      ok: false,
      expected: `${account.username} to be free`,
      actual: "the username is already taken",
      cause: "leftovers from an earlier run, or a run id collision",
      where: "public.profiles",
    };
  }

  const signUp = await account.client.auth.signUp({
    email: account.email,
    password,
    options: { data: { username: account.username, display_name: account.displayName } },
  });
  if (signUp.error) {
    return {
      ok: false,
      expected: "sign up to succeed",
      actual: describe(signUp.error),
      cause: "auth sign-ups disabled, rate limited, or the profile trigger rejected the metadata",
      where: "supabase/schema.sql — handle_new_user(), supabase/config.toml [auth]",
    };
  }
  if (!signUp.data.session) {
    return {
      ok: false,
      expected: "a session straight after sign up",
      actual: "no session: this instance requires email confirmation",
      cause: "auth.email.enable_confirmations is on, so the harness cannot sign in",
      where: "supabase/config.toml — [auth.email] enable_confirmations",
    };
  }

  await account.client.auth.signOut();
  const signIn = await account.client.auth.signInWithPassword({ email: account.email, password });
  if (signIn.error) {
    return {
      ok: false,
      expected: "sign in with the just-created password to succeed",
      actual: describe(signIn.error),
      cause: "password sign-in disabled, or the sign-up did not persist",
      where: "supabase/config.toml — [auth]",
    };
  }

  account.id = signIn.data.user.id;
  const profile = await account.client.from("profiles").select("id, username, is_admin").eq("id", account.id).single();
  if (profile.error || profile.data.username !== account.username) {
    return {
      ok: false,
      expected: `a profile row with username ${account.username}`,
      actual: profile.error ? describe(profile.error) : `username ${profile.data.username}`,
      cause: "the new-user trigger did not copy the sign-up metadata",
      where: "supabase/schema.sql — handle_new_user()",
    };
  }
  return { ok: true, detail: `signed up and signed in, profile ${account.username}` };
}

async function setUpAccounts() {
  for (const key of ["a", "b", "c"]) {
    const account = accounts[key];
    await check("Authentication", `sign up and sign in ${account.label}`, () => signUpAndIn(account));
  }

  if (!isLocal) {
    skip(
      "Authentication",
      `sign up and sign in ${accounts.d.label}`,
      "admin account skipped: promoting an admin needs a privileged SQL statement, which the harness only runs against a local instance",
    );
    return;
  }
  await check("Authentication", `sign up and sign in ${accounts.d.label}`, () => signUpAndIn(accounts.d));
}

async function promoteAdmin() {
  // The privileged statement goes through docker exec into the local Supabase
  // container, so it is restricted to a loopback target — never a *.local or
  // remote database the harness does not own.
  if (!isLoopback) {
    skip(
      "Roles",
      "promote D to admin",
      isLocal
        ? "granting is_admin needs a privileged SQL statement, which the harness only runs against a Supabase container on 127.0.0.1, localhost or ::1"
        : "remote target: profiles.is_admin can only be granted by a privileged SQL statement, and the harness refuses to run one against a database it does not own",
    );
    return;
  }
  if (!accounts.d.id) {
    skip("Roles", "promote D to admin", "account D was not created, so there is nothing to promote");
    return;
  }

  await check("Roles", "promote D to admin (one privileged SQL statement, local only)", async () => {
    // The username is bound with psql -v, never interpolated into the statement.
    // The statement goes in over stdin (-f -) because psql only interpolates
    // :'variables' in scripts it reads — with -c the :'uname' would reach the
    // server verbatim and fail with a syntax error.
    const sql = "update public.profiles set is_admin = true where username = :'uname';";
    let output = "";
    try {
      output = execFileSync(
        "docker",
        [
          "exec",
          "-i",
          DB_CONTAINER,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-v",
          `uname=${accounts.d.username}`,
          "-f",
          "-",
        ],
        { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch (error) {
      const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
      return {
        ok: false,
        expected: `docker exec ${DB_CONTAINER} psql to apply the update`,
        actual: stderr || describe(error),
        cause:
          "psql rejected the statement, docker is unavailable, or the local Supabase container is not running under this name — read the psql output above before assuming it is the containers",
        where: "scripts/test-accounts.mjs — promoteAdmin(); supabase/config.toml — project_id",
      };
    }

    if (!/UPDATE\s+1\b/.test(output)) {
      return {
        ok: false,
        expected: "psql to report UPDATE 1",
        actual: output.trim() || "no output from psql",
        cause: "the statement ran but matched no profile row for D",
        where: "supabase/schema.sql — handle_new_user(); public.profiles",
      };
    }

    // psql exiting 0 only means the statement ran; confirm through the app path
    // that the flag is actually readable as true before relying on it below.
    const row = await accounts.d.client.from("profiles").select("is_admin").eq("id", accounts.d.id).maybeSingle();
    if (row.error || row.data?.is_admin !== true) {
      return {
        ok: false,
        expected: "profiles.is_admin to read back as true for D",
        actual: row.error ? describe(row.error) : `is_admin is ${JSON.stringify(row.data?.is_admin ?? null)}`,
        cause: "the update matched no rows, or a trigger reverted the flag",
        where: "supabase/schema.sql — protect_profile_flags()",
      };
    }

    accounts.d.isAdmin = true;
    return { ok: true, detail: "granted and read back through the client; there is deliberately no app path to grant is_admin" };
  });
}

async function runSavesIsolation(state) {
  const { a, b, c } = accounts;

  /** Both A and B hold a save, so the negative assertions below cannot pass vacuously. */
  const saveAPost = async (account, postId) => {
    if (!account.id || !postId) return { skipped: true, reason: "the account or the post to save is missing" };
    const insert = await account.client.from("saves").insert({ post_id: postId, user_id: account.id });
    if (insert.error) {
      return {
        ok: false,
        expected: `${account.letter.toUpperCase()} to save a post`,
        actual: describe(insert.error),
        cause: "the saves insert policy rejected the row",
        where: 'supabase/schema.sql — "write own saves"',
      };
    }
    account.savedPostId = postId;
    return { ok: true, detail: "1 row inserted" };
  };

  await check("Authentication", "A can save a post", () => saveAPost(a, state.postOfB));
  await check("Authentication", "B can save a post", () => saveAPost(b, state.postOfA));

  /**
   * Positive and negative halves of the same fact, measured in one run: the owner
   * must get exactly its own row, and another account running the *identical*
   * query must get none. An error on either side is a failure — a query that is
   * simply refused would otherwise look indistinguishable from a working policy.
   */
  const isolated = async (owner, other) => {
    const ownerName = owner.letter.toUpperCase();
    const otherName = other.letter.toUpperCase();
    if (!owner.id || !other.id) return { skipped: true, reason: "one of the accounts is missing" };
    if (!owner.savedPostId) return { skipped: true, reason: `${ownerName} has no save, so there is nothing to isolate` };

    const mine = await owner.client.from("saves").select("post_id, user_id").eq("user_id", owner.id);
    if (mine.error) {
      return {
        ok: false,
        expected: `${ownerName} to read its own saves`,
        actual: `the query failed: ${describe(mine.error)}`,
        cause: "the select policy on saves no longer lets the owner read its own rows",
        where: 'supabase/schema.sql — "read own saves"',
      };
    }
    const rows = mine.data ?? [];
    if (rows.length !== 1 || rows[0].user_id !== owner.id || rows[0].post_id !== owner.savedPostId) {
      return {
        ok: false,
        expected: `exactly 1 save row for ${ownerName}, on post ${owner.savedPostId}`,
        actual: `${rows.length} row(s): ${JSON.stringify(rows)}`,
        cause: "the select policy on saves is not scoped to auth.uid()",
        where: 'supabase/schema.sql — "read own saves"',
      };
    }

    const theirs = await other.client.from("saves").select("post_id, user_id").eq("user_id", owner.id);
    if (theirs.error) {
      return {
        ok: false,
        expected: `the identical query from ${otherName} to return 0 rows`,
        actual: `it failed instead: ${describe(theirs.error)}`,
        cause: "an unexpected error, which must not be mistaken for the policy working",
        where: 'supabase/schema.sql — "read own saves"',
      };
    }
    const leaked = theirs.data ?? [];
    return leaked.length === 0
      ? { ok: true, detail: `${ownerName} sees its 1 row, ${otherName} sees 0 from the same query` }
      : {
          ok: false,
          expected: `no rows when ${otherName} reads ${ownerName}'s saves`,
          actual: `${leaked.length} row(s) leaked`,
          cause: "the saves select policy is not restricted to the owner",
          where: 'supabase/schema.sql — "read own saves"',
        };
  };

  await check("Authentication", "A's saves are visible to A and not to B", () => isolated(a, b));
  await check("Authentication", "B's saves are visible to B and not to A", () => isolated(b, a));
  await check("Authentication", "A's saves are not visible to C", () => isolated(a, c));

  await check("Authentication", "a signed-out client cannot insert a post as A", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    const result = await anon.from("posts").insert({
      author_id: a.id,
      title: `[${marker}] forged by anon`,
      body: "",
      subject: "other",
      level: "university",
      tags: [marker],
      attachments: [],
    });
    if (!result.error) {
      return {
        ok: false,
        expected: "the insert to be rejected",
        actual: "the anonymous client created a post owned by A",
        cause: "posts allow inserts without an authenticated author check",
        where: 'supabase/schema.sql — "insert own posts"',
      };
    }
    return refusalMatches(result.error, RLS_REFUSAL)
      ? { ok: true, detail: describe(result.error) }
      : {
          ok: false,
          expected: `the insert to be refused with ${RLS_SHAPE}`,
          actual: `a different error: ${describe(result.error)}`,
          cause: "the insert failed for some other reason, so this proves nothing about the policy",
          where: 'supabase/schema.sql — "insert own posts"',
        };
  });
}

// ---- Uploads ---------------------------------------------------------------

async function verifyPost(account, postId, expected) {
  const row = await anon.from("posts").select("id, author_id, title, attachments").eq("id", postId).maybeSingle();
  if (row.error || !row.data) {
    return {
      ok: false,
      expected: "the post row to exist",
      actual: row.error ? describe(row.error) : "no row",
      cause: "the insert after the upload did not land",
      where: "src/services/supabaseApi.ts — createPost()",
    };
  }
  if (row.data.author_id !== account.id) {
    return {
      ok: false,
      expected: `author ${account.username}`,
      actual: `author_id ${row.data.author_id}`,
      cause: "the insert policy allowed a mismatched author",
      where: 'supabase/schema.sql — "insert own posts"',
    };
  }

  const attachment = row.data.attachments?.[0];
  if (!attachment || attachment.name !== expected.name || attachment.mimeType !== expected.type || attachment.size !== expected.bytes.byteLength || attachment.kind !== expected.kind) {
    return {
      ok: false,
      expected: `attachment ${expected.name} / ${expected.type} / ${expected.bytes.byteLength} bytes / kind ${expected.kind}`,
      actual: attachment ? `${attachment.name} / ${attachment.mimeType} / ${attachment.size} bytes / kind ${attachment.kind}` : "no attachment stored",
      cause: "attachment metadata is built incorrectly before the insert",
      where: "src/services/supabaseApi.ts — createPost()",
    };
  }
  if (!attachment.id.startsWith(`${account.id}/${postId}/0-`)) {
    return {
      ok: false,
      expected: `storage path ${account.id}/${postId}/0-<name>`,
      actual: attachment.id,
      cause: "the storage path format changed and no longer matches the upload policy",
      where: 'supabase/schema.sql — "upload own attachments"',
    };
  }

  const download = await headStatus(attachment.url);
  if (download.status !== 200 || download.size !== expected.bytes.byteLength) {
    return {
      ok: false,
      expected: `the public URL to return 200 and ${expected.bytes.byteLength} bytes`,
      actual: `status ${download.status}, ${download.size} bytes`,
      cause: "the object was not stored, or the bucket is no longer public",
      where: 'supabase/schema.sql — the attachments bucket is created public',
    };
  }
  return { ok: true, detail: `post row, ownership, metadata and ${download.size}-byte download all verified` };
}

async function runUploads(state) {
  const { a, b, c } = accounts;

  const pdf = { name: "midterm-notes.pdf", type: "application/pdf", bytes: TINY_PDF, kind: "pdf" };
  await check("Uploads", "A uploads a small PDF", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    const created = await createPostAs(a, `[${marker}] PDF upload`, [pdf]);
    if (created.error) {
      return {
        ok: false,
        expected: "the PDF to be accepted",
        actual: describe(created.error),
        cause: "the storage insert policy or the posts insert policy rejected it",
        where: 'supabase/schema.sql — "upload own attachments"',
      };
    }
    state.postOfA = created.postId;
    state.attachmentOfA = created.attachments[0];
    return verifyPost(a, created.postId, pdf);
  });

  const png = { name: "diagram.png", type: "image/png", bytes: PNG_1X1, kind: "image" };
  await check("Uploads", "A uploads a small PNG", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    const created = await createPostAs(a, `[${marker}] PNG upload`, [png]);
    if (created.error) {
      return {
        ok: false,
        expected: "the PNG to be accepted",
        actual: describe(created.error),
        cause: "the storage insert policy or the posts insert policy rejected it",
        where: 'supabase/schema.sql — "upload own attachments"',
      };
    }
    return verifyPost(a, created.postId, png);
  });

  await check("Uploads", "B uploads a small text file", async () => {
    if (!b.id) return { skipped: true, reason: "account B is missing" };
    const text = { name: "week-6.txt", type: "text/plain", bytes: Buffer.from(`Notes for ${marker}\n`), kind: "document" };
    const created = await createPostAs(b, `[${marker}] text upload`, [text]);
    if (created.error) {
      return {
        ok: false,
        expected: "the text file to be accepted",
        actual: describe(created.error),
        cause: "the storage insert policy or the posts insert policy rejected it",
        where: 'supabase/schema.sql — "upload own attachments"',
      };
    }
    state.postOfB = created.postId;
    return verifyPost(b, created.postId, text);
  });

  await check("Uploads", "C (no uploads) has an empty author feed", async () => {
    if (!c.id) return { skipped: true, reason: "account C is missing" };
    const result = await anon.from("posts").select("id").eq("author_id", c.id);
    const rows = result.data ?? [];
    return rows.length === 0
      ? { ok: true, detail: "0 posts, so the empty state is reachable" }
      : {
          ok: false,
          expected: "0 posts for C",
          actual: `${rows.length} posts`,
          cause: "posts were attributed to the wrong account",
          where: "src/services/supabaseApi.ts — createPost()",
        };
  });

  await check("Uploads", "unsupported file type (.exe)", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    const binary = { name: "installer.exe", type: "application/x-msdownload", bytes: Buffer.from("MZ\x00\x00 not a real executable"), kind: "other" };
    const created = await createPostAs(a, `[${marker}] unsupported type`, [binary]);
    const observed = created.error ? `rejected: ${describe(created.error)}` : "accepted and stored";
    return {
      skipped: true,
      reason: `no server-side type restriction exists — the app accepts every type by design and the bucket sets no allowed_mime_types (createPost only downgrades browser-renderable types such as text/html and image/svg+xml to application/octet-stream), so this is documented, not asserted. Observed: ${observed}`,
    };
  });

  await check("Uploads", "oversized file is rejected by storage", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    if (!storageLimit) return { skipped: true, reason: "no file_size_limit found in supabase/config.toml" };
    if (storageLimit > 200 * 1024 * 1024) {
      return { skipped: true, reason: `the configured limit (${storageLimit} bytes) is too large to probe safely` };
    }

    const size = storageLimit + 1;
    const path = `${a.id}/oversize-${runId}/0-oversize.bin`;
    const upload = await a.client.storage
      .from(BUCKET)
      .upload(path, new Blob([Buffer.alloc(size, 0x41)], { type: "application/octet-stream" }), {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (!upload.error) {
      createdPaths.push({ path, account: a });
      return {
        ok: false,
        expected: `storage to reject ${size} bytes (limit ${storageLimit})`,
        actual: "the upload was accepted",
        cause: "the storage service limit is higher than supabase/config.toml claims",
        where: "supabase/config.toml — [storage] file_size_limit",
      };
    }
    return refusalMatches(upload.error, SIZE_REFUSAL)
      ? { ok: true, detail: `${size} bytes refused: ${describe(upload.error)}` }
      : {
          ok: false,
          expected: `${size} bytes to be refused with ${SIZE_SHAPE}`,
          actual: `a different error: ${describe(upload.error)}`,
          cause: "the upload failed for some other reason, so the size limit itself is unproven",
          where: "supabase/config.toml — [storage] file_size_limit, and the bucket's file_size_limit in supabase/schema.sql",
        };
  });

  note(
    "Uploads",
    storageLimit === APP_MAX_FILE_BYTES
      ? `MAX_FILE_BYTES in src/lib/attachments.ts (${APP_MAX_FILE_BYTES} bytes) matches the storage limit, so the client check and the server check agree`
      : `MAX_FILE_BYTES in src/lib/attachments.ts is ${APP_MAX_FILE_BYTES} bytes but the storage limit is ${storageLimit ?? "unknown"} bytes — the two should be kept in step (supabase/schema.sql sets file_size_limit on the bucket)`,
  );

  await check("Uploads", "a declared text/html upload is stored without client coercion", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    const path = `${a.id}/coercion-${runId}/0-probe.html`;
    const upload = await a.client.storage
      .from(BUCKET)
      .upload(path, new Blob([Buffer.from(`<h1>${marker}</h1>`)], { type: "text/html" }), {
        contentType: "text/html",
        upsert: false,
      });
    if (upload.error) {
      return { skipped: true, reason: `the probe could not be stored, so nothing was observed: ${describe(upload.error)}` };
    }
    createdPaths.push({ path, account: a });

    const response = await fetch(publicUrl(a.client, path));
    await response.arrayBuffer();
    const served = response.headers.get("content-type") ?? "not reported";

    return {
      skipped: true,
      reason:
        "documented, not asserted. The text/html → application/octet-stream coercion lives in the client: " +
        "safeContentType() in src/lib/attachments.ts, applied by createPost() in src/services/supabaseApi.ts and " +
        "src/services/localApi.ts. It protects every file uploaded through the app, but this harness calls storage " +
        "directly — as a hostile client could — and the bucket sets no allowed_mime_types, so a renderable declared " +
        `type is still stored and served as declared. Served Content-Type: ${served}`,
    };
  });

  await check("Uploads", "misleading extension (.pdf holding PNG bytes)", async () => {
    if (!a.id) return { skipped: true, reason: "account A is missing" };
    const spoofed = { name: "syllabus.pdf", type: "application/pdf", bytes: PNG_1X1, kind: "pdf" };
    const created = await createPostAs(a, `[${marker}] misleading extension`, [spoofed]);
    const observed = created.error ? `rejected: ${describe(created.error)}` : "accepted and stored as application/pdf";
    return {
      skipped: true,
      reason: `no content sniffing exists anywhere in the stack, so the declared type is trusted — documented, not asserted. Observed: ${observed}`,
    };
  });
}

// ---- Authorization ---------------------------------------------------------

async function runAuthorization(state) {
  const { a, b } = accounts;

  await check("Authorization", "owner lists and downloads its own attachment", async () => {
    if (!a.id || !state.attachmentOfA) return { skipped: true, reason: "A's post is missing" };
    const listed = await listFolder(a.client, `${a.id}/${state.postOfA}`);
    if (!listed.includes(state.attachmentOfA.id)) {
      return {
        ok: false,
        expected: `the folder listing to contain ${state.attachmentOfA.id}`,
        actual: listed.length ? listed.join(", ") : "empty listing",
        cause: "the object was stored under a different path",
        where: "src/services/supabaseApi.ts — createPost()",
      };
    }
    const download = await a.client.storage.from(BUCKET).download(state.attachmentOfA.id);
    return download.error
      ? {
          ok: false,
          expected: "the owner to download its own attachment",
          actual: describe(download.error),
          cause: "the storage select policy no longer covers the owner's own folder",
          where: 'supabase/schema.sql — "list own attachments"',
        }
      : { ok: true, detail: `${listed.length} object(s) listed, download ok` };
  });

  await check("Authorization", "a signed-out client cannot enumerate A's storage folder", async () => {
    if (!a.id || !state.attachmentOfA) return { skipped: true, reason: "A's post is missing" };
    const listed = await listFolder(anon, a.id);
    return listed.length === 0
      ? { ok: true, detail: "listing returns nothing while signed out; public downloads are unaffected" }
      : {
          ok: false,
          expected: "an anonymous storage listing of another user's folder to return nothing",
          actual: `${listed.length} object path(s) enumerated`,
          cause: "the storage select policy is not scoped to the owner's own folder",
          where: 'supabase/schema.sql — "list own attachments"',
        };
  });

  await check("Authorization", "B cannot delete A's post", async () => {
    if (!b.id || !state.postOfA) return { skipped: true, reason: "A's post is missing" };
    await b.client.from("posts").delete().eq("id", state.postOfA);
    // PostgREST answers 204 for a delete that matched no rows, so re-read instead.
    const row = await anon.from("posts").select("id").eq("id", state.postOfA).maybeSingle();
    return row.data
      ? { ok: true, detail: "row still present after the delete attempt" }
      : {
          ok: false,
          expected: "A's post to survive",
          actual: "the row is gone",
          cause: "the delete policy on posts is not restricted to the author",
          where: 'supabase/schema.sql — "delete own posts"',
        };
  });

  await check("Authorization", "B cannot update A's post", async () => {
    if (!b.id || !state.postOfA) return { skipped: true, reason: "A's post is missing" };
    await b.client.from("posts").update({ title: `[${marker}] hijacked` }).eq("id", state.postOfA);
    const row = await anon.from("posts").select("title").eq("id", state.postOfA).maybeSingle();
    return row.data?.title === `[${marker}] PDF upload`
      ? { ok: true, detail: "title unchanged after the update attempt" }
      : {
          ok: false,
          expected: `the title to stay "[${marker}] PDF upload"`,
          actual: `title is now "${row.data?.title ?? "row missing"}"`,
          cause: "the update policy on posts is not restricted to the author",
          where: 'supabase/schema.sql — "update own posts"',
        };
  });

  await check("Authorization", "B cannot write into A's storage folder", async () => {
    if (!a.id || !b.id) return { skipped: true, reason: "account A or B is missing" };
    const path = `${a.id}/intruder-${runId}/0-intruder.txt`;
    const upload = await b.client.storage
      .from(BUCKET)
      .upload(path, new Blob([Buffer.from("intruder")], { type: "text/plain" }), { contentType: "text/plain" });
    if (!upload.error) {
      createdPaths.push({ path, account: a });
      return {
        ok: false,
        expected: "the upload into another user's folder to be rejected",
        actual: "the object was written",
        cause: "the storage insert policy no longer compares the first folder to auth.uid()",
        where: 'supabase/schema.sql — "upload own attachments"',
      };
    }
    return refusalMatches(upload.error, RLS_REFUSAL)
      ? { ok: true, detail: describe(upload.error) }
      : {
          ok: false,
          expected: `the upload to be refused with ${RLS_SHAPE}`,
          actual: `a different error: ${describe(upload.error)}`,
          cause: "the upload failed for some other reason, so the folder policy is unproven",
          where: 'supabase/schema.sql — "upload own attachments"',
        };
  });

  await check("Authorization", "B cannot delete A's attachment", async () => {
    if (!b.id || !state.attachmentOfA) return { skipped: true, reason: "A's post is missing" };
    await b.client.storage.from(BUCKET).remove([state.attachmentOfA.id]);
    const download = await headStatus(state.attachmentOfA.url);
    return download.status === 200
      ? { ok: true, detail: "the object is still downloadable" }
      : {
          ok: false,
          expected: "A's attachment to survive",
          actual: `the public URL now returns ${download.status}`,
          cause: "the storage delete policy no longer compares the folder to auth.uid()",
          where: 'supabase/schema.sql — "delete own attachments"',
        };
  });

  await check("Authorization", "attachments are downloadable while signed out (intended sharing model)", async () => {
    if (!state.attachmentOfA) return { skipped: true, reason: "A's post is missing" };
    const download = await headStatus(state.attachmentOfA.url);
    return download.status === 200
      ? { ok: true, detail: "public bucket by design, so a shared link works for anyone" }
      : {
          ok: false,
          expected: "a signed-out download to return 200",
          actual: `status ${download.status}`,
          cause: "the bucket stopped being public, which breaks sharing links",
          where: 'supabase/schema.sql — the attachments bucket is created public',
        };
  });

  await check("Authorization", "id enumeration: B reads A's post but cannot mutate it", async () => {
    if (!b.id || !state.postOfA) return { skipped: true, reason: "A's post is missing" };
    const read = await b.client.from("posts").select("id, title, author_id").eq("id", state.postOfA).maybeSingle();
    if (!read.data) {
      return {
        ok: false,
        expected: "posts to stay publicly readable",
        actual: read.error ? describe(read.error) : "no row",
        cause: "the public select policy on posts changed",
        where: 'supabase/schema.sql — "posts are public"',
      };
    }
    await b.client.from("posts").update({ body: "mutated by id" }).eq("id", state.postOfA);
    const after = await anon.from("posts").select("body").eq("id", state.postOfA).maybeSingle();
    return after.data?.body?.includes(marker)
      ? { ok: true, detail: "readable by design, unchanged after the write attempt" }
      : {
          ok: false,
          expected: "the body to stay unchanged",
          actual: `body is now "${after.data?.body ?? "row missing"}"`,
          cause: "knowing a post id is enough to write to it",
          where: 'supabase/schema.sql — "update own posts"',
        };
  });
}

// ---- Roles -----------------------------------------------------------------

async function runRoles(state) {
  const { a, b, c, d } = accounts;

  await check("Roles", "B can file a verification request", async () => {
    if (!b.id) return { skipped: true, reason: "account B is missing" };
    const result = await b.client
      .from("verification_requests")
      .insert({ user_id: b.id, reason: `End-to-end harness request for run ${marker}`, link: "" })
      .select("id, status")
      .single();
    if (result.error) {
      return {
        ok: false,
        expected: "a pending request to be created",
        actual: describe(result.error),
        cause: "the insert policy or the one-pending-request index rejected it",
        where: 'supabase/schema.sql — "request own verification"',
      };
    }
    state.requestOfB = result.data.id;
    return { ok: true, detail: `status ${result.data.status}` };
  });

  await check("Roles", "a non-admin cannot read the verification queue", async () => {
    if (!c.id || !state.requestOfB) return { skipped: true, reason: "no pending request to look for" };
    const result = await c.client.from("verification_requests").select("id, user_id").eq("status", "pending");
    if (result.error) {
      // A select under RLS normally filters silently, so an error here must at
      // least be a policy refusal — anything else is a broken query, not a proof.
      return refusalMatches(result.error, RLS_REFUSAL)
        ? { ok: true, detail: `denied: ${describe(result.error)}` }
        : {
            ok: false,
            expected: `0 other people's rows, or ${RLS_SHAPE}`,
            actual: `a different error: ${describe(result.error)}`,
            cause: "the query failed for some other reason, so the policy is unproven",
            where: 'supabase/schema.sql — "read own or all as admin"',
          };
    }
    const rows = result.data ?? [];
    const leaked = rows.filter((row) => row.user_id !== c.id);
    return leaked.length === 0
      ? { ok: true, detail: "only C's own rows are visible" }
      : {
          ok: false,
          expected: "C to see only its own requests",
          actual: `${leaked.length} other people's requests returned`,
          cause: "the select policy no longer checks is_admin() or the owner",
          where: 'supabase/schema.sql — "read own or all as admin"',
        };
  });

  await check("Roles", "a non-admin cannot verify another profile", async () => {
    if (!a.id || !b.id) return { skipped: true, reason: "account A or B is missing" };
    await b.client.from("profiles").update({ verified: true }).eq("id", a.id);
    const row = await anon.from("profiles").select("verified").eq("id", a.id).maybeSingle();
    return row.data?.verified === false
      ? { ok: true, detail: "A is still unverified" }
      : {
          ok: false,
          expected: "A.verified to stay false",
          actual: `verified is ${row.data?.verified}`,
          cause: "the update policy or the flag trigger let a non-admin grant a badge",
          where: "supabase/schema.sql — protect_profile_flags()",
        };
  });

  await check("Roles", "a non-admin cannot verify or promote itself", async () => {
    if (!b.id) return { skipped: true, reason: "account B is missing" };
    const verify = await b.client.from("profiles").update({ verified: true }).eq("id", b.id);
    const promote = await b.client.from("profiles").update({ is_admin: true }).eq("id", b.id);
    const row = await anon.from("profiles").select("verified, is_admin").eq("id", b.id).maybeSingle();
    // A missing row is a failure: "no row" must never read as "the flags are off".
    if (row.error || !row.data) {
      return {
        ok: false,
        expected: "B's profile row to still be readable, with both flags false",
        actual: row.error ? describe(row.error) : "no profile row for B",
        cause: "the profile disappeared or became unreadable, so the flags cannot be verified",
        where: "supabase/schema.sql — public.profiles",
      };
    }
    if (row.data.verified !== false || row.data.is_admin !== false) {
      return {
        ok: false,
        expected: "verified === false and is_admin === false after both self-grants",
        actual: `verified ${JSON.stringify(row.data.verified)}, is_admin ${JSON.stringify(row.data.is_admin)}`,
        cause: "the trigger that blocks self-promotion is missing on this instance",
        where: "supabase/schema.sql — profiles_protect_flags",
      };
    }
    return { ok: true, detail: `refused: ${describe(verify.error ?? promote.error ?? { message: "no rows changed" })}` };
  });

  if (!d.isAdmin) {
    skip("Roles", "admin reads the verification queue", "no admin account on this target");
    skip("Roles", "admin approves a pending request", "no admin account on this target");
    return;
  }

  await check("Roles", "admin reads the verification queue", async () => {
    if (!state.requestOfB) return { skipped: true, reason: "B has no pending request" };
    const result = await d.client.from("verification_requests").select("id, user_id, status").eq("status", "pending");
    if (result.error) {
      return {
        ok: false,
        expected: "the admin to read pending requests",
        actual: describe(result.error),
        cause: "is_admin() did not resolve for the signed-in admin",
        where: "supabase/schema.sql — is_admin()",
      };
    }
    const found = (result.data ?? []).some((row) => row.id === state.requestOfB);
    return found
      ? { ok: true, detail: `${result.data.length} pending request(s) visible` }
      : {
          ok: false,
          expected: "B's pending request in the queue",
          actual: `${result.data.length} rows, none of them B's`,
          cause: "the admin branch of the select policy is not matching",
          where: 'supabase/schema.sql — "read own or all as admin"',
        };
  });

  await check("Roles", "admin approves a pending request", async () => {
    if (!state.requestOfB || !accounts.b.id) return { skipped: true, reason: "B has no pending request" };
    const decided = await d.client
      .from("verification_requests")
      .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: d.id })
      .eq("id", state.requestOfB)
      .select("id, status");
    if (decided.error || !decided.data?.length) {
      return {
        ok: false,
        expected: "the request to be marked approved",
        actual: decided.error ? describe(decided.error) : "0 rows updated",
        cause: "the admin update policy did not match",
        where: 'supabase/schema.sql — "admins decide requests"',
      };
    }
    const badge = await d.client.from("profiles").update({ verified: true }).eq("id", accounts.b.id);
    if (badge.error) {
      return {
        ok: false,
        expected: "the admin to set the badge on B",
        actual: describe(badge.error),
        cause: "the admin profile update policy or the flag trigger rejected it",
        where: 'supabase/schema.sql — "admins update any profile"',
      };
    }
    const row = await anon.from("profiles").select("verified").eq("id", accounts.b.id).maybeSingle();
    return row.data?.verified === true
      ? { ok: true, detail: "request approved and B is verified" }
      : {
          ok: false,
          expected: "B.verified to be true",
          actual: `verified is ${row.data?.verified}`,
          cause: "the badge update silently matched no rows",
          where: 'supabase/schema.sql — "admins update any profile"',
        };
  });
}

// ---- Cleanup ---------------------------------------------------------------

async function cleanUp() {
  for (const account of Object.values(accounts)) {
    if (!account.id) continue;

    const paths = await listFolder(account.client, account.id);
    if (paths.length) {
      const removed = await account.client.storage.from(BUCKET).remove(paths);
      if (removed.error) {
        fail("Cleanup", `remove ${account.letter.toUpperCase()}'s storage objects`, {
          expected: `${paths.length} object(s) removed`,
          actual: describe(removed.error),
          cause: "the storage delete policy rejected the owner",
          where: 'supabase/schema.sql — "delete own attachments"',
        });
      } else {
        pass("Cleanup", `removed ${paths.length} storage object(s) for ${account.letter.toUpperCase()}`);
      }
    }

    // Scoped to this account *and* the run marker, so nothing else can be hit.
    const posts = await account.client.from("posts").delete().eq("author_id", account.id).ilike("title", `%${marker}%`);
    if (posts.error) {
      fail("Cleanup", `delete ${account.letter.toUpperCase()}'s posts`, {
        expected: "the author's own marked posts to be deleted",
        actual: describe(posts.error),
        cause: "the delete policy on posts rejected the author",
        where: 'supabase/schema.sql — "delete own posts"',
      });
    }

    const deleted = await account.client.rpc("delete_own_account");
    if (deleted.error) {
      fail("Cleanup", `delete account ${account.letter.toUpperCase()}`, {
        expected: "delete_own_account() to remove the auth user",
        actual: describe(deleted.error),
        cause: "the RPC is missing, or execute was not granted to authenticated",
        where: "supabase/schema.sql — delete_own_account()",
      });
    } else {
      pass("Cleanup", `deleted account ${account.letter.toUpperCase()} via delete_own_account()`);
    }
  }

  const leftovers = [];

  const profiles = await anon.from("profiles").select("id, username").like("username", `e2e${runId}%`);
  for (const row of profiles.data ?? []) leftovers.push(`profile ${row.username} (${row.id})`);

  const posts = await anon.from("posts").select("id, title").ilike("title", `%${marker}%`);
  for (const row of posts.data ?? []) leftovers.push(`post ${row.id} — ${row.title}`);

  for (const { path } of createdPaths) {
    const download = await headStatus(publicUrl(anon, path));
    if (download.status === 200) leftovers.push(`storage object ${path}`);
  }

  if (!leftovers.length) {
    pass("Cleanup", "no rows or objects carrying the run marker remain");
    return;
  }

  fail("Cleanup", "leftover data carrying the run marker", {
    expected: "nothing left behind",
    actual: `${leftovers.length} item(s): ${leftovers.join("; ")}`,
    cause: "a delete was rejected, or the run ended before cleanup reached it",
    where: "scripts/test-accounts.mjs — cleanUp()",
  });
  note("Cleanup", "copy-pasteable cleanup SQL (run against the target database):");
  for (const account of Object.values(accounts)) {
    if (account.id) note("Cleanup", `delete from storage.objects where bucket_id = '${BUCKET}' and name like '${account.id}/%';`);
  }
  note("Cleanup", `delete from public.posts where title like '%${marker}%';`);
  note("Cleanup", `delete from auth.users where email like 'test-${marker}-%@example.invalid';`);
}

// ---- Run -------------------------------------------------------------------

const state = { postOfA: null, postOfB: null, attachmentOfA: null, requestOfB: null };

try {
  await setUpAccounts();
  await promoteAdmin();
  await runUploads(state);
  await runSavesIsolation(state);
  await runAuthorization(state);
  await runRoles(state);
} catch (error) {
  fail("Environment", "the run finished early", {
    expected: "every section to run",
    actual: describe(error),
    cause: "an unexpected error escaped a check",
    where: "scripts/test-accounts.mjs",
  });
} finally {
  try {
    await cleanUp();
  } catch (error) {
    fail("Cleanup", "cleanup did not finish", {
      expected: "storage, posts and accounts to be removed",
      actual: describe(error),
      cause: "the target became unreachable during cleanup",
      where: "scripts/test-accounts.mjs — cleanUp()",
    });
  }
  printReport();
}

// Set rather than process.exit(): exiting here truncates the report on Windows pipes.
process.exitCode = tally.failed > 0 ? 1 : 0;
