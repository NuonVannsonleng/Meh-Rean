import { detectAttachmentKind, matchesMediaFilter, MAX_FILE_BYTES, MAX_FILES_PER_POST } from "../lib/attachments";
import {
  ApiError,
  REACTION_TYPES,
  type Attachment,
  type ChangePasswordInput,
  type CommentView,
  type FeedQuery,
  type NewPostInput,
  type Post,
  type PostView,
  type ProfileView,
  type PublicUser,
  type ReactionType,
  type SchoolSummary,
  type SearchScope,
  type SearchSuggestions,
  type SignInInput,
  type Subject,
  type SubjectSummary,
  type TagSummary,
  type SignUpInput,
  type UpdateProfileInput,
  type User,
} from "../types";
import {
  createId,
  createSalt,
  getSessionUserId,
  hashPassword,
  loadDb,
  persist,
  setSessionUserId,
  type DbState,
  type UserRecord,
} from "./db";
import { deleteFiles, getFile, putFile } from "./files";

/**
 * The only data access point for the UI. Today it talks to an in-browser
 * store; swapping each body for a `fetch()` call is all a real server needs.
 */

const LOCAL_FILE_PREFIX = "local-file:";

/** Sample credentials shown on the sign-in page while accounts are local. */
export { DEMO_ACCOUNT } from "../data/mock";


function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

// ---- Helpers ----

function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    bio: record.bio,
    school: record.school,
    country: record.country,
    fieldOfStudy: record.fieldOfStudy,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
  };
}

function toUser(record: UserRecord): User {
  return { ...toPublicUser(record), email: record.email };
}

function findUser(db: DbState, id: string): UserRecord {
  const user = db.users.find((item) => item.id === id);
  if (!user) throw new ApiError("NOT_FOUND", 404);
  return user;
}

function viewerId(db: DbState): string | null {
  const id = getSessionUserId();
  return id && db.users.some((user) => user.id === id) ? id : null;
}

function requireViewer(db: DbState): UserRecord {
  const id = viewerId(db);
  if (!id) throw new ApiError("UNAUTHORIZED", 401);
  return findUser(db, id);
}

function findPost(db: DbState, id: string): Post {
  const post = db.posts.find((item) => item.id === id);
  if (!post) throw new ApiError("NOT_FOUND", 404);
  return post;
}

function toPostView(db: DbState, post: Post, viewer: string | null): PostView {
  const counts = Object.fromEntries(REACTION_TYPES.map((type) => [type, 0])) as Record<ReactionType, number>;
  let mineReaction: ReactionType | null = null;
  for (const reaction of db.reactions) {
    if (reaction.postId !== post.id) continue;
    counts[reaction.type] += 1;
    if (reaction.userId === viewer) mineReaction = reaction.type;
  }

  const ratings = db.ratings.filter((rating) => rating.postId === post.id);
  const average = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.value, 0) / ratings.length
    : 0;

  return structuredClone({
    ...post,
    author: toPublicUser(findUser(db, post.authorId)),
    reactions: {
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      mine: mineReaction,
    },
    rating: {
      average,
      count: ratings.length,
      mine: ratings.find((rating) => rating.userId === viewer)?.value ?? null,
    },
    commentCount: db.comments.filter((comment) => comment.postId === post.id).length,
    saved: db.saves.some((save) => save.postId === post.id && save.userId === viewer),
  });
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

function assertUnique(db: DbState, email: string, username: string, exceptId?: string): void {
  const others = db.users.filter((user) => user.id !== exceptId);
  if (others.some((user) => user.email.toLowerCase() === email)) {
    throw new ApiError("EMAIL_TAKEN", 409);
  }
  if (others.some((user) => user.username === username)) {
    throw new ApiError("USERNAME_TAKEN", 409);
  }
}

function localFileIds(post: Post): string[] {
  return post.attachments
    .filter((attachment) => attachment.url.startsWith(LOCAL_FILE_PREFIX))
    .map((attachment) => attachment.url.slice(LOCAL_FILE_PREFIX.length));
}

function removePosts(db: DbState, postIds: Set<string>): string[] {
  const fileIds = db.posts.filter((post) => postIds.has(post.id)).flatMap(localFileIds);
  db.posts = db.posts.filter((post) => !postIds.has(post.id));
  db.comments = db.comments.filter((comment) => !postIds.has(comment.postId));
  db.reactions = db.reactions.filter((reaction) => !postIds.has(reaction.postId));
  db.ratings = db.ratings.filter((rating) => !postIds.has(rating.postId));
  db.saves = db.saves.filter((save) => !postIds.has(save.postId));
  return fileIds;
}

// ---- Auth ----

export async function getCurrentUser(): Promise<User | null> {
  const db = await loadDb();
  const id = viewerId(db);
  return id ? toUser(findUser(db, id)) : null;
}

export async function signUp(input: SignUpInput): Promise<User> {
  await delay(500);
  const db = await loadDb();
  const email = input.email.trim().toLowerCase();
  const username = normalizeUsername(input.username);
  assertUnique(db, email, username);

  const salt = createSalt();
  const record: UserRecord = {
    id: createId("u"),
    username,
    displayName: input.displayName.trim(),
    email,
    bio: "",
    school: "",
    country: "",
    fieldOfStudy: "",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: await hashPassword(input.password, salt),
  };
  db.users.push(record);
  persist();
  setSessionUserId(record.id);
  return toUser(record);
}

export async function signIn(input: SignInInput): Promise<User> {
  await delay(500);
  const db = await loadDb();
  const identifier = input.email.trim().toLowerCase();
  const record = db.users.find(
    (user) => user.email.toLowerCase() === identifier || user.username === normalizeUsername(identifier),
  );
  if (!record || !record.passwordHash) throw new ApiError("INVALID_CREDENTIALS", 401);

  const hash = await hashPassword(input.password, record.salt);
  if (hash !== record.passwordHash) throw new ApiError("INVALID_CREDENTIALS", 401);

  setSessionUserId(record.id);
  return toUser(record);
}

export async function signOut(): Promise<void> {
  await delay(150);
  setSessionUserId(null);
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  await delay(400);
  const db = await loadDb();
  const record = requireViewer(db);
  const email = input.email.trim().toLowerCase();
  const username = normalizeUsername(input.username);
  assertUnique(db, email, username, record.id);

  Object.assign(record, {
    displayName: input.displayName.trim(),
    username,
    email,
    bio: input.bio.trim(),
    school: input.school.trim(),
    country: input.country.trim(),
    fieldOfStudy: input.fieldOfStudy.trim(),
    avatarUrl: input.avatarUrl,
  });
  persist();
  return toUser(record);
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await delay(400);
  const db = await loadDb();
  const record = requireViewer(db);
  const current = await hashPassword(input.currentPassword, record.salt);
  if (!record.passwordHash || current !== record.passwordHash) {
    throw new ApiError("WRONG_PASSWORD", 403);
  }
  record.salt = createSalt();
  record.passwordHash = await hashPassword(input.newPassword, record.salt);
  persist();
}

export async function deleteAccount(password: string): Promise<void> {
  await delay(500);
  const db = await loadDb();
  const record = requireViewer(db);
  const hash = await hashPassword(password, record.salt);
  if (!record.passwordHash || hash !== record.passwordHash) {
    throw new ApiError("WRONG_PASSWORD", 403);
  }

  const ownPosts = new Set(db.posts.filter((post) => post.authorId === record.id).map((post) => post.id));
  const fileIds = removePosts(db, ownPosts);
  db.comments = db.comments.filter((comment) => comment.authorId !== record.id);
  db.reactions = db.reactions.filter((reaction) => reaction.userId !== record.id);
  db.ratings = db.ratings.filter((rating) => rating.userId !== record.id);
  db.saves = db.saves.filter((save) => save.userId !== record.id);
  db.users = db.users.filter((user) => user.id !== record.id);
  persist();
  setSessionUserId(null);
  await deleteFiles(fileIds);
}

// ---- Posts ----

export async function getFeed(query: FeedQuery = {}): Promise<PostView[]> {
  await delay();
  const db = await loadDb();
  const viewer = viewerId(db);
  const terms = (query.search ?? "").toLowerCase().split(/\s+/).filter(Boolean);

  let posts = db.posts;

  if (query.authorUsername) {
    const author = db.users.find((user) => user.username === normalizeUsername(query.authorUsername ?? ""));
    posts = author ? posts.filter((post) => post.authorId === author.id) : [];
  }
  if (query.school) {
    const school = query.school.toLowerCase();
    const authors = new Set(db.users.filter((user) => user.school.toLowerCase() === school).map((user) => user.id));
    posts = posts.filter((post) => authors.has(post.authorId));
  }
  if (query.savedOnly) {
    const saved = new Set(db.saves.filter((save) => save.userId === viewer).map((save) => save.postId));
    posts = posts.filter((post) => saved.has(post.id));
  }
  if (query.subject && query.subject !== "all") {
    posts = posts.filter((post) => post.subject === query.subject);
  }
  if (query.level && query.level !== "all") {
    posts = posts.filter((post) => post.level === query.level);
  }
  if (query.media && query.media !== "all") {
    const media = query.media;
    posts = posts.filter((post) => matchesMediaFilter(post.attachments.map((item) => item.kind), media));
  }
  if (terms.length) {
    posts = posts.filter((post) => {
      const author = findUser(db, post.authorId);
      const haystack = [
        post.title,
        post.body,
        post.subject.replace("-", " "),
        post.tags.join(" "),
        author.displayName,
        author.username,
        author.school,
        author.country,
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }

  const views = posts.map((post) => toPostView(db, post, viewer));
  const byDate = (a: PostView, b: PostView) => b.createdAt.localeCompare(a.createdAt);

  switch (query.sort ?? "latest") {
    case "top":
      return views.sort(
        (a, b) =>
          b.reactions.total + b.rating.average * b.rating.count -
            (a.reactions.total + a.rating.average * a.rating.count) || byDate(a, b),
      );
    case "discussed":
      return views.sort((a, b) => b.commentCount - a.commentCount || byDate(a, b));
    default:
      return views.sort(byDate);
  }
}

export async function getPost(id: string): Promise<PostView> {
  await delay();
  const db = await loadDb();
  return toPostView(db, findPost(db, id), viewerId(db));
}

export async function createPost(input: NewPostInput): Promise<PostView> {
  const db = await loadDb();
  const viewer = requireViewer(db);
  if (input.files.length > MAX_FILES_PER_POST) throw new ApiError("TOO_MANY_FILES", 413);
  if (input.files.some((file) => file.size > MAX_FILE_BYTES)) throw new ApiError("FILE_TOO_LARGE", 413);

  const attachments: Attachment[] = [];
  try {
    for (const file of input.files) {
      const id = createId("f");
      await putFile(id, file);
      attachments.push({
        id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        kind: detectAttachmentKind(file.type, file.name),
        url: `${LOCAL_FILE_PREFIX}${id}`,
      });
    }
  } catch {
    await deleteFiles(attachments.map((attachment) => attachment.id));
    throw new ApiError("STORAGE_FULL", 507);
  }

  const post: Post = {
    id: createId("p"),
    authorId: viewer.id,
    title: input.title.trim(),
    body: input.body.trim(),
    subject: input.subject,
    level: input.level,
    tags: input.tags,
    attachments,
    createdAt: new Date().toISOString(),
  };
  db.posts.push(post);
  persist();
  await delay(250);
  return toPostView(db, post, viewer.id);
}

export async function deletePost(id: string): Promise<void> {
  await delay(250);
  const db = await loadDb();
  const viewer = requireViewer(db);
  if (findPost(db, id).authorId !== viewer.id) throw new ApiError("FORBIDDEN", 403);
  const fileIds = removePosts(db, new Set([id]));
  persist();
  await deleteFiles(fileIds);
}

export async function reactToPost(postId: string, type: ReactionType | null): Promise<PostView> {
  await delay(120);
  const db = await loadDb();
  const viewer = requireViewer(db);
  const post = findPost(db, postId);
  db.reactions = db.reactions.filter((item) => !(item.postId === postId && item.userId === viewer.id));
  if (type) db.reactions.push({ postId, userId: viewer.id, type });
  persist();
  return toPostView(db, post, viewer.id);
}

export async function ratePost(postId: string, value: number | null): Promise<PostView> {
  await delay(120);
  const db = await loadDb();
  const viewer = requireViewer(db);
  const post = findPost(db, postId);
  if (post.authorId === viewer.id) throw new ApiError("FORBIDDEN", 403);
  db.ratings = db.ratings.filter((item) => !(item.postId === postId && item.userId === viewer.id));
  if (value !== null) {
    db.ratings.push({ postId, userId: viewer.id, value: Math.min(5, Math.max(1, Math.round(value))) });
  }
  persist();
  return toPostView(db, post, viewer.id);
}

export async function toggleSavePost(postId: string): Promise<PostView> {
  await delay(120);
  const db = await loadDb();
  const viewer = requireViewer(db);
  const post = findPost(db, postId);
  const isSaved = db.saves.some((save) => save.postId === postId && save.userId === viewer.id);
  db.saves = isSaved
    ? db.saves.filter((save) => !(save.postId === postId && save.userId === viewer.id))
    : [...db.saves, { postId, userId: viewer.id }];
  persist();
  return toPostView(db, post, viewer.id);
}

// ---- Comments ----

export async function getComments(postId: string): Promise<CommentView[]> {
  await delay(250);
  const db = await loadDb();
  findPost(db, postId);
  return db.comments
    .filter((comment) => comment.postId === postId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((comment) => structuredClone({ ...comment, author: toPublicUser(findUser(db, comment.authorId)) }));
}

export async function addComment(postId: string, body: string): Promise<CommentView> {
  await delay(200);
  const db = await loadDb();
  const viewer = requireViewer(db);
  findPost(db, postId);
  const comment = {
    id: createId("c"),
    postId,
    authorId: viewer.id,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  db.comments.push(comment);
  persist();
  return { ...comment, author: toPublicUser(viewer) };
}

export async function deleteComment(commentId: string): Promise<void> {
  await delay(150);
  const db = await loadDb();
  const viewer = requireViewer(db);
  const comment = db.comments.find((item) => item.id === commentId);
  if (!comment) throw new ApiError("NOT_FOUND", 404);
  const postAuthor = findPost(db, comment.postId).authorId;
  if (comment.authorId !== viewer.id && postAuthor !== viewer.id) {
    throw new ApiError("FORBIDDEN", 403);
  }
  db.comments = db.comments.filter((item) => item.id !== commentId);
  persist();
}

// ---- Profiles ----

export async function getProfile(username: string): Promise<ProfileView> {
  await delay();
  const db = await loadDb();
  const record = db.users.find((user) => user.username === normalizeUsername(username));
  if (!record) throw new ApiError("NOT_FOUND", 404);

  const postIds = new Set(db.posts.filter((post) => post.authorId === record.id).map((post) => post.id));
  const ratings = db.ratings.filter((rating) => postIds.has(rating.postId));

  return {
    user: toPublicUser(record),
    stats: {
      posts: postIds.size,
      reactions: db.reactions.filter((reaction) => postIds.has(reaction.postId)).length,
      averageRating: ratings.length
        ? ratings.reduce((sum, rating) => sum + rating.value, 0) / ratings.length
        : null,
    },
  };
}

// ---- Search & discovery ----

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Every term must appear somewhere in the fields (accent-insensitive). */
function matches(terms: string[], ...fields: string[]): boolean {
  const haystack = normalize(fields.join(" "));
  return terms.every((term) => haystack.includes(term));
}

function summarize(db: DbState) {
  const postsByAuthor = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const subjectCounts = new Map<Subject, number>();
  for (const post of db.posts) {
    postsByAuthor.set(post.authorId, (postsByAuthor.get(post.authorId) ?? 0) + 1);
    subjectCounts.set(post.subject, (subjectCounts.get(post.subject) ?? 0) + 1);
    for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const schoolMap = new Map<string, SchoolSummary>();
  for (const user of db.users) {
    if (!user.school.trim()) continue;
    const key = user.school.trim().toLowerCase();
    const entry = schoolMap.get(key) ?? { name: user.school.trim(), country: user.country, students: 0, posts: 0 };
    entry.students += 1;
    entry.posts += postsByAuthor.get(user.id) ?? 0;
    if (!entry.country) entry.country = user.country;
    schoolMap.set(key, entry);
  }

  const schools = [...schoolMap.values()].sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name));
  const tags: TagSummary[] = [...tagCounts]
    .map(([tag, posts]) => ({ tag, posts }))
    .sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag));
  const subjects: SubjectSummary[] = [...subjectCounts]
    .map(([subject, posts]) => ({ subject, posts }))
    .sort((a, b) => b.posts - a.posts);
  const people = [...db.users].sort(
    (a, b) => (postsByAuthor.get(b.id) ?? 0) - (postsByAuthor.get(a.id) ?? 0) || a.displayName.localeCompare(b.displayName),
  );

  return { schools, tags, subjects, people };
}

/**
 * Typeahead results across people, schools & universities, subjects and tags.
 * `subjectLabels` lets the caller match localized subject names.
 */
export async function searchSuggestions(
  query: string,
  scope: SearchScope = "all",
  subjectLabels: Record<Subject, string>,
): Promise<SearchSuggestions> {
  await delay(120);
  const db = await loadDb();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const { schools, tags, subjects, people } = summarize(db);
  const limit = scope === "all" ? 4 : 12;
  const wants = (kind: SearchScope) => scope === "all" || scope === kind;

  return structuredClone({
    people: wants("people")
      ? people
          .filter((user) =>
            matches(terms, user.displayName, user.username, user.school, user.country, user.fieldOfStudy),
          )
          .slice(0, limit)
          .map(toPublicUser)
      : [],
    schools: wants("schools") ? schools.filter((school) => matches(terms, school.name, school.country)).slice(0, limit) : [],
    subjects: wants("subjects")
      ? subjects
          .filter((item) => matches(terms, subjectLabels[item.subject], item.subject.replace("-", " ")))
          .slice(0, limit)
      : [],
    tags: wants("tags") ? tags.filter((item) => matches(terms, item.tag.replace(/-/g, " "), item.tag)).slice(0, limit) : [],
  });
}

export interface TrendingView {
  tags: TagSummary[];
  schools: SchoolSummary[];
  people: PublicUser[];
}

export async function getTrending(): Promise<TrendingView> {
  await delay(200);
  const db = await loadDb();
  const { schools, tags, people } = summarize(db);
  return structuredClone({
    tags: tags.slice(0, 8),
    schools: schools.slice(0, 5),
    people: people.slice(0, 4).map(toPublicUser),
  });
}

/** No sessions to watch in browser-only mode. */
export function subscribeToAuth(_callback: (user: User | null) => void): () => void {
  return () => {};
}

// ---- Files ----

const objectUrls = new Map<string, string>();

/** Resolves an attachment to a URL the browser can display or download. */
export async function getAttachmentUrl(attachment: Attachment): Promise<string> {
  if (!attachment.url.startsWith(LOCAL_FILE_PREFIX)) return attachment.url;
  const id = attachment.url.slice(LOCAL_FILE_PREFIX.length);
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const blob = await getFile(id);
  if (!blob) throw new ApiError("NOT_FOUND", 404);
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}
