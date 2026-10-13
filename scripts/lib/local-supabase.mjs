/**
 * Shared by the BacII test scripts: find a LOCAL Supabase to test against,
 * make throwaway accounts, and run SQL in the local database container.
 * Hosted projects are never used: these tests write and delete rows.
 */

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT = new URL("../../", import.meta.url);
const DB_CONTAINER = "supabase_db_Meh_Rean";

/** { url, key } of a local Supabase from SUPABASE_URL or .env.test, or null. */
export function localTarget() {
  let target = null;
  if (process.env.SUPABASE_URL) {
    target = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  } else {
    const file = new URL(".env.test", ROOT);
    if (existsSync(file)) {
      const env = Object.fromEntries(
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
          .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
      );
      target = {
        url: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
        key: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
    }
  }
  try {
    const host = new URL(target?.url ?? "").hostname;
    return target?.key && ["127.0.0.1", "localhost"].includes(host) ? target : null;
  } catch {
    return null;
  }
}

/** Runs one SQL statement as the database owner in the local container. */
export function sql(statement) {
  // docker could be talking to another machine; these tests stay on this one.
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) {
    throw new Error("refusing: DOCKER_HOST or DOCKER_CONTEXT is set; these tests only use the local Docker");
  }
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", statement],
    // A refused statement can be the expected result; keep psql quiet.
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

/** Creates accounts for one test run and removes them afterwards. */
export function accounts(target, prefix) {
  const run = randomBytes(4).toString("hex");
  const password = `Pw-${run}-${randomBytes(6).toString("hex")}`;
  const made = [];
  return {
    run,
    anon: createClient(target.url, target.key, { auth: { persistSession: false, autoRefreshToken: false } }),
    async create(label, { admin = false } = {}) {
      const client = createClient(target.url, target.key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.signUp({
        email: `${prefix}-${run}-${label}@example.invalid`,
        password,
        options: { data: { username: `${prefix.slice(0, 6)}${run}${label}`, display_name: `${prefix} ${label}` } },
      });
      if (error) throw error;
      if (!data.session) throw new Error("sign-up needs email confirmation; turn it off for the local project");
      if (admin) sql(`update public.profiles set is_admin = true where id = '${data.user.id}'`);
      made.push(client);
      return { client, id: data.user.id };
    },
    async cleanUp() {
      // The same call the app's Delete account uses.
      for (const client of made) await client.rpc("delete_own_account");
    },
  };
}

/** A tiny reporter shared by the scripts. */
export function reporter() {
  const results = [];
  return {
    async check(name, fn) {
      try {
        results.push(["✓", name, (await fn()) ?? ""]);
      } catch (error) {
        results.push(["✗", name, String(error?.message ?? error).split("\n").slice(0, 3).join(" | ")]);
      }
    },
    skip(name, reason) {
      results.push(["○", name, reason]);
    },
    finish() {
      for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
      const count = (mark) => results.filter(([m]) => m === mark).length;
      console.log(`\nPassed ${count("✓")}   Failed ${count("✗")}   Skipped ${count("○")}`);
      process.exit(count("✗") ? 1 : 0);
    },
  };
}

export const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
