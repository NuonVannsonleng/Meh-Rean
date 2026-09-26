import {
  DEMO_ACCOUNT,
  DEMO_USER_ID,
  seedComments,
  seedEmails,
  seedFollows,
  seedMessages,
  seedPosts,
  seedRatings,
  seedReactions,
  seedSaves,
  seedUsers,
} from "../data/mock";
import {
  ApiError,
  type Comment,
  type MessageAttachment,
  type MessageKind,
  type Post,
  type ReactionType,
  type User,
  type VerificationStatus,
} from "../types";

/**
 * A tiny in-browser "database" persisted to localStorage. It stands in for the
 * future server so accounts, posts and interactions survive a refresh.
 */

export interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

export interface FollowRecord {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface VerificationRecord {
  id: string;
  userId: string;
  reason: string;
  link: string;
  status: Exclude<VerificationStatus, "none">;
  createdAt: string;
  decidedAt: string | null;
}

export interface ReactionRecord {
  postId: string;
  userId: string;
  type: ReactionType;
}

export interface RatingRecord {
  postId: string;
  userId: string;
  value: number;
}

export interface SaveRecord {
  postId: string;
  userId: string;
}

export interface ConversationRecord {
  id: string;
  /** The two members, in no particular order. */
  userIds: [string, string];
  lastMessageAt: string;
  /** userId → when they last opened the thread. */
  readAt: Record<string, string>;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body: string;
  /** The file itself is in IndexedDB under `path`; urls are made on read. */
  attachment: Omit<MessageAttachment, "url" | "downloadUrl"> | null;
  sticker: string | null;
  replyToId: string | null;
  reactions: Record<string, ReactionType>;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface DbState {
  version: 3;
  users: UserRecord[];
  posts: Post[];
  comments: Comment[];
  reactions: ReactionRecord[];
  ratings: RatingRecord[];
  saves: SaveRecord[];
  follows: FollowRecord[];
  verifications: VerificationRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
}

const DB_KEY = "meh-rean:db:v3";
const SESSION_KEY = "meh-rean:session";

// ---- Password hashing (PBKDF2 via Web Crypto) ----

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function createSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Fallback for insecure origins (e.g. testing over a LAN IP) where Web Crypto is missing. */
function weakHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let round = 0; round < 1000; round += 1) {
    for (let index = 0; index < input.length; index += 1) {
      hash = Math.imul(hash ^ input.charCodeAt(index), 0x01000193) >>> 0;
    }
  }
  return hash.toString(16);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  if (!crypto.subtle) return weakHash(`${salt}:${password}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

// ---- Load / save ----

let cache: DbState | null = null;
let loading: Promise<DbState> | null = null;

async function createSeedState(): Promise<DbState> {
  const salt = createSalt();
  const demoHash = await hashPassword(DEMO_ACCOUNT.password, salt);

  const users: UserRecord[] = seedUsers.map((user) => ({
    ...user,
    email: seedEmails[user.id],
    // The demo account reviews verification requests in browser-only mode.
    isAdmin: user.id === DEMO_USER_ID,
    // Only the demo account can sign in; other seed users are sample authors.
    passwordHash: user.id === DEMO_USER_ID ? demoHash : "",
    salt: user.id === DEMO_USER_ID ? salt : "",
  }));

  const reactions = Object.entries(seedReactions).flatMap(([postId, items]) =>
    items.map(([userId, type]) => ({ postId, userId, type })),
  );
  const ratings = Object.entries(seedRatings).flatMap(([postId, items]) =>
    items.map(([userId, value]) => ({ postId, userId, value })),
  );
  const saves = Object.entries(seedSaves).flatMap(([userId, postIds]) =>
    postIds.map((postId) => ({ postId, userId })),
  );

  const follows = Object.entries(seedFollows).flatMap(([followerId, ids]) =>
    ids.map((followingId) => ({ followerId, followingId, createdAt: "2026-09-01T00:00:00Z" })),
  );

  const { conversations, messages } = seedInbox();

  return {
    version: 3,
    users,
    posts: structuredClone(seedPosts),
    comments: structuredClone(seedComments),
    reactions,
    ratings,
    saves,
    follows,
    verifications: [],
    conversations,
    messages,
  };
}

function seedInbox(): Pick<DbState, "conversations" | "messages"> {
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const conversations = new Map<string, ConversationRecord>();
  const messages: MessageRecord[] = [];

  seedMessages.forEach(([otherId, fromDemo, body, minutesAgo], index) => {
    let conversation = conversations.get(otherId);
    if (!conversation) {
      conversation = {
        id: `c-${otherId}`,
        userIds: [DEMO_USER_ID, otherId],
        lastMessageAt: at(minutesAgo),
        // The other side has read everything; the demo account's latest
        // messages from them arrive unread so the badge shows.
        readAt: { [DEMO_USER_ID]: at(minutesAgo), [otherId]: at(0) },
      };
      conversations.set(otherId, conversation);
    }
    const createdAt = at(minutesAgo);
    conversation.lastMessageAt = createdAt;
    if (fromDemo) conversation.readAt[DEMO_USER_ID] = createdAt;
    messages.push({
      id: `m-seed-${index}`,
      conversationId: conversation.id,
      senderId: fromDemo ? DEMO_USER_ID : otherId,
      kind: body.startsWith("sticker:") ? "sticker" : "text",
      body: body.startsWith("sticker:") ? "" : body,
      attachment: null,
      sticker: body.startsWith("sticker:") ? body.slice("sticker:".length) : null,
      replyToId: null,
      reactions: {},
      editedAt: null,
      deletedAt: null,
      createdAt,
    });
  });

  // Only the Priya thread is fully read in the demo.
  const priya = conversations.get("u4");
  if (priya) priya.readAt[DEMO_USER_ID] = priya.lastMessageAt;

  return { conversations: [...conversations.values()], messages };
}

/** Messages stored before photos, stickers and reactions existed. */
function upgradeMessage(record: Partial<MessageRecord> & Pick<MessageRecord, "id" | "conversationId" | "senderId" | "createdAt">): MessageRecord {
  return {
    ...record,
    kind: record.kind ?? "text",
    body: record.body ?? "",
    attachment: record.attachment ?? null,
    sticker: record.sticker ?? null,
    replyToId: record.replyToId ?? null,
    reactions: record.reactions ?? {},
    editedAt: record.editedAt ?? null,
    deletedAt: record.deletedAt ?? null,
  };
}

function readStored(): DbState | null {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DbState;
    if (parsed.version !== 3) return null;
    // Stores written before direct messages existed: add them without
    // discarding the accounts and posts already there.
    parsed.conversations ??= [];
    parsed.messages = (parsed.messages ?? []).map(upgradeMessage);
    return parsed;
  } catch {
    return null;
  }
}

export async function loadDb(): Promise<DbState> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const state = readStored() ?? (await createSeedState());
      cache = state;
      try {
        persist();
      } catch {
        // Storage is blocked or full; the app still works for this session.
      }
      return state;
    })();
  }
  return loading;
}

export function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch {
    throw new ApiError("STORAGE_FULL", 507);
  }
}

// ---- Session ----

export function getSessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionUserId(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Session simply won't persist when storage is blocked.
  }
}

export function createId(prefix: string): string {
  const random =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : toHex(crypto.getRandomValues(new Uint8Array(12)));
  return `${prefix}-${random}`;
}
