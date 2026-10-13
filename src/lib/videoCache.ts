// Recent video lookups, kept on this phone (roadmap 4.1). Looking up the
// same exercise again shows the earlier result at once and spends neither a
// daily lookup nor YouTube quota. Stored per account; photos are kept only
// as a fingerprint, never the picture itself.

import type { VideoLookup } from "./bacii";

const KEY = (userId: string) => `meh-rean:video-lookups:${userId}`;
const MAX_ENTRIES = 10;
const MAX_AGE_MS = 7 * 86_400_000;

export interface SavedLookup {
  key: string;
  savedAt: string;
  /** The typed text (shortened), or empty when it was a photo only. */
  label: string;
  hasPhoto: boolean;
  result: VideoLookup;
}

/** A fingerprint of what was asked: the same text, subject and photo give the same key. */
export async function lookupKey(input: { text: string; subject: string; image: { data: string } | null }): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const text = input.text.toLowerCase().replace(/\s+/g, " ").trim();
  const bytes = new TextEncoder().encode(JSON.stringify([text, input.subject, input.image?.data ?? ""]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readAll(userId: string): SavedLookup[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY(userId)) ?? "[]") as SavedLookup[];
    const fresh = Date.now() - MAX_AGE_MS;
    return Array.isArray(list) ? list.filter((entry) => entry?.key && Date.parse(entry.savedAt) > fresh && entry.result?.videos) : [];
  } catch {
    return [];
  }
}

export function recentLookups(userId: string): SavedLookup[] {
  return readAll(userId);
}

export function findLookup(userId: string, key: string): SavedLookup | null {
  return readAll(userId).find((entry) => entry.key === key) ?? null;
}

export function saveLookup(userId: string, entry: Omit<SavedLookup, "savedAt">): void {
  const list = [{ ...entry, savedAt: new Date().toISOString() }, ...readAll(userId).filter((item) => item.key !== entry.key)].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(list));
  } catch {
    // Storage full or blocked: the lookup still worked, it just is not kept.
  }
}
