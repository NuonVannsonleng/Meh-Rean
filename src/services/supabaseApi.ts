import type { PostgrestError } from "@supabase/supabase-js";
import { MAX_MESSAGE_LENGTH } from "../lib/chat";
import { subjectLabel, subjectMembers } from "../lib/subjects";
import {
  MAX_QUESTION_IMAGE_BYTES,
  QUESTION_SELECT,
  questionImageExtension,
  toQuestion,
  toSaveQuestionArgs,
  type QuestionRow,
  type QuestionSolutionRow,
} from "../lib/questions";
import { detectAttachmentKind, matchesMediaFilter, safeContentType, MAX_FILE_BYTES, MAX_FILES_PER_POST } from "../lib/attachments";
import {
  ApiError,
  REACTION_TYPES,
  type Attachment,
  type ChangePasswordInput,
  type ChatEvent,
  type ConversationChannel,
  type ConversationSummary,
  type Message,
  type MessageAttachment,
  type MessageKind,
  type OutgoingMessage,
  type ThreadView,
  type CommentView,
  type EducationLevel,
  type FeedQuery,
  type NewPostInput,
  type UpdatePostInput,
  type CurriculumChapter,
  type CurriculumSubject,
  type ExamAnswer,
  type ExamAttempt,
  type Mistake,
  type ExamAttemptDetail,
  type ExamPaper,
  type ExamPaperDetail,
  type ExamStart,
  type PaperFilter,
  type PaperOrigin,
  type Question,
  type QuestionFilter,
  type QuestionImage,
  type QuestionInput,
  type Verification,
  type PostView,
  type ProfileView,
  type PublicUser,
  type ReactionType,
  type SchoolSummary,
  type SearchScope,
  type SearchSuggestions,
  type SignInInput,
  type SignUpInput,
  type SubjectSummary,
  type TagSummary,
  type UpdateProfileInput,
  type User,
  type NewVerificationRequest,
  type ProfileImageKind,
  type VerificationRequest,
  type VerificationStatus,
} from "../types";
import { ATTACHMENTS_BUCKET, supabase } from "./supabase/client";

/**
 * Supabase implementation of the service layer. It mirrors `localApi.ts`
 * exactly, so `api.ts` can swap between them with no page changes.
 */

const FEED_LIMIT = 200;

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  school: string;
  school_domain: string | null;
  school_country: string | null;
  grade: string | null;
  country: string;
  field_of_study: string;
  avatar_url: string | null;
  banner_url: string | null;
  verified: boolean;
  is_admin?: boolean;
  created_at: string;
}

interface PostRow {
  id: string;
  author_id: string;
  title: string;
  body: string;
  subject: string;
  level: EducationLevel;
  /** Absent until schema.sql has been re-run with the note-school columns. */
  school?: string | null;
  school_domain?: string | null;
  tags: string[];
  attachments: Attachment[];
  created_at: string;
  /** Absent until schema.sql has been re-run with note editing. */
  edited_at?: string | null;
  author: ProfileRow | null;
  reactions: { user_id: string; type: ReactionType }[];
  ratings: { user_id: string; value: number }[];
  saves: { user_id: string }[];
  comments: { count: number }[];
}

const PROFILE_COLUMNS =
  "id, username, display_name, bio, school, school_domain, school_country, grade, country, field_of_study, avatar_url, banner_url, verified, created_at";

// "*" rather than a column list, so a database that has not been migrated yet
// (no school columns) still loads notes instead of failing the whole query.
const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey (${PROFILE_COLUMNS}),
  reactions (user_id, type),
  ratings (user_id, value),
  saves (user_id),
  comments (count)
`;

// ---- Errors ----

function fail(error: PostgrestError | { message: string; code?: string } | null): never {
  const message = error?.message ?? "";
  const code = "code" in (error ?? {}) ? (error as PostgrestError).code : undefined;

  if (code === "23505" && message.includes("username")) throw new ApiError("USERNAME_TAKEN", 409);
  if (code === "23505") throw new ApiError("EMAIL_TAKEN", 409);
  if (code === "PGRST116") throw new ApiError("NOT_FOUND", 404);
  if (code === "42501" || message.includes("row-level security")) throw new ApiError("FORBIDDEN", 403);
  if (/invalid login credentials/i.test(message)) throw new ApiError("INVALID_CREDENTIALS", 401);
  if (/email not confirmed|not confirmed/i.test(message)) throw new ApiError("EMAIL_NOT_CONFIRMED", 403);
  if (/already registered|already been registered/i.test(message)) throw new ApiError("EMAIL_TAKEN", 409);
  if (/database error saving new user/i.test(message)) throw new ApiError("USERNAME_TAKEN", 409);
  if (/exceeded the maximum allowed size|payload too large/i.test(message)) throw new ApiError("FILE_TOO_LARGE", 413);
  throw new ApiError("UNKNOWN", 500, message);
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) fail(result.error);
  if (result.data === null) throw new ApiError("NOT_FOUND", 404);
  return result.data;
}

// ---- Mapping ----

function toPublicUser(row: ProfileRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    school: row.school,
    schoolDomain: row.school_domain,
    schoolCountry: row.school_country,
    grade: row.grade,
    country: row.country,
    fieldOfStudy: row.field_of_study,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    verified: row.verified ?? false,
    createdAt: row.created_at,
  };
}

function toPostView(row: PostRow, viewer: string | null): PostView {
  const counts = Object.fromEntries(REACTION_TYPES.map((type) => [type, 0])) as Record<ReactionType, number>;
  let mine: ReactionType | null = null;
  for (const reaction of row.reactions ?? []) {
    counts[reaction.type] += 1;
    if (reaction.user_id === viewer) mine = reaction.type;
  }

  const ratings = row.ratings ?? [];
  const average = ratings.length ? ratings.reduce((sum, item) => sum + item.value, 0) / ratings.length : 0;

  if (!row.author) throw new ApiError("NOT_FOUND", 404);

  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    subject: row.subject,
    level: row.level,
    school: row.school ?? null,
    schoolDomain: row.school_domain ?? null,
    tags: row.tags ?? [],
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    author: toPublicUser(row.author),
    reactions: { counts, total: (row.reactions ?? []).length, mine },
    rating: {
      average,
      count: ratings.length,
      mine: ratings.find((item) => item.user_id === viewer)?.value ?? null,
    },
    commentCount: row.comments?.[0]?.count ?? 0,
    saved: (row.saves ?? []).some((save) => save.user_id === viewer),
  };
}

async function viewerId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function requireViewer(): Promise<string> {
  const id = await viewerId();
  if (!id) throw new ApiError("UNAUTHORIZED", 401);
  return id;
}

async function profileById(id: string): Promise<ProfileRow> {
  return unwrap(await supabase.from("profiles").select("*").eq("id", id).single<ProfileRow>());
}

async function currentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const profile = await profileById(session.user.id);
  return {
    ...toPublicUser(profile),
    email: session.user.email ?? "",
    isAdmin: profile.is_admin ?? false,
  };
}

// ---- Auth ----

export async function getCurrentUser(): Promise<User | null> {
  return currentUser();
}

export async function signUp(input: SignUpInput): Promise<User> {
  const username = input.username.trim().toLowerCase();
  const available = await supabase.rpc("username_available", { name: username });
  if (available.error) fail(available.error);
  if (available.data === false) throw new ApiError("USERNAME_TAKEN", 409);

  const school = {
    school: input.school.trim(),
    school_domain: input.schoolDomain,
    school_country: input.schoolCountry,
    grade: input.grade.trim() || null,
    field_of_study: input.fieldOfStudy.trim(),
  };

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    // handle_new_user() reads these, so the school survives even when email
    // confirmation means the profile row is written without a session.
    options: { data: { username, display_name: input.displayName.trim(), ...school } },
  });
  if (error) fail(error);
  // With "Confirm email" enabled there is no session until the link is clicked.
  if (!data.session) throw new ApiError("EMAIL_CONFIRMATION", 202);

  // With a session, write the row directly too: the trigger only fills in what
  // was in the metadata, and an older database may not read all of it yet.
  const update = await supabase
    .from("profiles")
    .update({ ...school, country: input.schoolCountry ?? "" })
    .eq("id", data.session.user.id);
  if (update.error) fail(update.error);

  const user = await currentUser();
  if (!user) throw new ApiError("UNKNOWN", 500);
  return user;
}

export async function signIn(input: SignInInput): Promise<User> {
  const email = input.email.trim();
  // Emails are never exposed publicly, so signing in by username is not
  // possible against Supabase — the sign-in form asks for an email address.
  if (!email.includes("@")) throw new ApiError("INVALID_CREDENTIALS", 401);

  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (error) fail(error);
  const user = await currentUser();
  if (!user) throw new ApiError("UNKNOWN", 500);
  return user;
}

/** Sends the confirmation link again for an address that signed up but never confirmed. */
export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
  if (error) fail(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) fail(error);
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const id = await requireViewer();
  const { data: session } = await supabase.auth.getSession();
  const currentEmail = session.session?.user.email ?? "";
  const email = input.email.trim().toLowerCase();

  const { error } = await supabase
    .from("profiles")
    .update({
      username: input.username.trim().toLowerCase(),
      display_name: input.displayName.trim(),
      bio: input.bio.trim(),
      school: input.school.trim(),
      school_domain: input.schoolDomain,
      school_country: input.schoolCountry,
      grade: input.grade,
      country: input.country.trim(),
      field_of_study: input.fieldOfStudy.trim(),
      avatar_url: input.avatarUrl,
      banner_url: input.bannerUrl,
    })
    .eq("id", id);
  if (error) fail(error);

  if (email && email !== currentEmail.toLowerCase()) {
    const result = await supabase.auth.updateUser({ email });
    if (result.error) fail(result.error);
  }

  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHORIZED", 401);
  return user;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHORIZED", 401);

  // Supabase does not check the old password, so verify it by signing in.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: input.currentPassword });
  if (check.error) throw new ApiError("WRONG_PASSWORD", 403);

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) fail(error);
}

export async function deleteAccount(password: string): Promise<void> {
  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHORIZED", 401);

  const check = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (check.error) throw new ApiError("WRONG_PASSWORD", 403);

  await removeStorageFolder(user.id);
  await removeStorageFolder(user.id, "chat");
  const { error } = await supabase.rpc("delete_own_account");
  if (error) fail(error);

  // The account is gone, so a server sign-out would be rejected. Drop the
  // stored session instead; the page reloads into a signed-out app.
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: the reload below still lands on a signed-out page.
  }
}

// ---- Posts ----

async function idsForSchool(school: string): Promise<string[]> {
  const rows = unwrap(await supabase.from("profiles").select("id").ilike("school", school));
  return rows.map((row: { id: string }) => row.id);
}

export async function getFeed(query: FeedQuery = {}): Promise<PostView[]> {
  const viewer = await viewerId();
  let builder = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(FEED_LIMIT);

  if (query.authorUsername) {
    const author = await supabase
      .from("profiles")
      .select("id")
      .eq("username", query.authorUsername.trim().toLowerCase())
      .maybeSingle<{ id: string }>();
    if (author.error) fail(author.error);
    if (!author.data) return [];
    builder = builder.eq("author_id", author.data.id);
  }

  if (query.savedOnly) {
    if (!viewer) return [];
    const saved = unwrap(await supabase.from("saves").select("post_id").eq("user_id", viewer));
    const ids = saved.map((row: { post_id: string }) => row.post_id);
    if (!ids.length) return [];
    builder = builder.in("id", ids);
  }

  if (query.school) {
    const ids = await idsForSchool(query.school);
    if (!ids.length) return [];
    builder = builder.in("author_id", ids);
  }

  // A main subject also finds the specific subjects filed under it.
  if (query.subject && query.subject !== "all") builder = builder.in("subject", subjectMembers(query.subject));
  if (query.level && query.level !== "all") builder = builder.eq("level", query.level);

  if (query.search?.trim()) {
    const { data, error } = await supabase.rpc("search_post_ids", { q: query.search.trim() });
    if (error) fail(error);
    const ids = (data ?? []) as string[];
    if (!ids.length) return [];
    builder = builder.in("id", ids);
  }

  const rows = unwrap(await builder.returns<PostRow[]>());
  let views = rows.map((row) => toPostView(row, viewer));

  if (query.media && query.media !== "all") {
    const media = query.media;
    views = views.filter((post) => matchesMediaFilter(post.attachments.map((item) => item.kind), media));
  }

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
  const viewer = await viewerId();
  const row = unwrap(await supabase.from("posts").select(POST_SELECT).eq("id", id).single<PostRow>());
  return toPostView(row, viewer);
}

function storagePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${ATTACHMENTS_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}

/** Storage has no recursive delete, so walk the folders and collect the files. */
async function collectFiles(prefix: string, bucket = ATTACHMENTS_BUCKET): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  const entries = data ?? [];
  const paths: string[] = [];
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) paths.push(...(await collectFiles(path, bucket)));
    else paths.push(path);
  }
  return paths;
}

async function removeStorageFolder(prefix: string, bucket = ATTACHMENTS_BUCKET): Promise<void> {
  const paths = await collectFiles(prefix, bucket);
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}

export async function createPost(input: NewPostInput): Promise<PostView> {
  const viewer = await requireViewer();
  if (input.files.length > MAX_FILES_PER_POST) throw new ApiError("TOO_MANY_FILES", 413);
  if (input.files.some((file) => file.size > MAX_FILE_BYTES)) throw new ApiError("FILE_TOO_LARGE", 413);

  const postId = crypto.randomUUID();
  const attachments: Attachment[] = [];
  const uploaded: string[] = [];

  try {
    for (const [index, file] of input.files.entries()) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${viewer}/${postId}/${index}-${safeName}`;
      // The bucket is public and accepts every type, so a file the browser
      // declares as text/html or image/svg+xml would otherwise be served as a
      // live document on the storage origin — stored XSS. safeContentType()
      // downgrades exactly those to a binary type; the file itself, its name and
      // its size are untouched.
      const contentType = safeContentType(file.type || "application/octet-stream");
      const upload = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType, upsert: false });
      if (upload.error) fail(upload.error);
      uploaded.push(path);
      const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
      attachments.push({
        id: path,
        name: file.name,
        mimeType: contentType,
        size: file.size,
        kind: detectAttachmentKind(contentType, file.name),
        url: data.publicUrl,
      });
    }

    const row = {
      id: postId,
      author_id: viewer,
      title: input.title.trim(),
      body: input.body.trim(),
      subject: input.subject,
      level: input.level,
      tags: input.tags,
      attachments,
    };
    const school = input.school ? { school: input.school.trim().slice(0, 150), school_domain: input.schoolDomain } : {};
    let { error } = await supabase.from("posts").insert({ ...row, ...school });
    // A database from before notes had a school rejects the unknown columns
    // (PGRST204). Save the note without its school rather than not at all;
    // re-running supabase/schema.sql adds them.
    if (error?.code === "PGRST204" && input.school) ({ error } = await supabase.from("posts").insert(row));
    if (error) fail(error);
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(uploaded);
    throw error;
  }

  return getPost(postId);
}

/** Uploads a note's files under the author's folder; see createPost() on content types. */
async function uploadAttachments(viewer: string, postId: string, files: File[], uploaded: string[]): Promise<Attachment[]> {
  const attachments: Attachment[] = [];
  // A timestamp keeps names added in a later edit from colliding with earlier ones.
  const batch = Date.now().toString(36);
  for (const [index, file] of files.entries()) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${viewer}/${postId}/${batch}-${index}-${safeName}`;
    const contentType = safeContentType(file.type || "application/octet-stream");
    const upload = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType, upsert: false });
    if (upload.error) fail(upload.error);
    uploaded.push(path);
    const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
    attachments.push({
      id: path,
      name: file.name,
      mimeType: contentType,
      size: file.size,
      kind: detectAttachmentKind(contentType, file.name),
      url: data.publicUrl,
    });
  }
  return attachments;
}

/**
 * Changes a note: its text and details, which of its files stay, and new
 * files. Only its author may; the database keeps its id, author and first
 * shared date, and stamps edited_at (see guard_post_update in schema.sql).
 */
export async function updatePost(id: string, input: UpdatePostInput): Promise<PostView> {
  const viewer = await requireViewer();
  const current = unwrap(
    await supabase.from("posts").select("author_id, attachments").eq("id", id).single<{ author_id: string; attachments: Attachment[] }>(),
  );
  if (current.author_id !== viewer) throw new ApiError("FORBIDDEN", 403);

  const keep = new Set(input.keepAttachmentIds);
  const kept = (current.attachments ?? []).filter((attachment) => keep.has(attachment.id));
  const dropped = (current.attachments ?? []).filter((attachment) => !keep.has(attachment.id));
  if (kept.length + input.files.length > MAX_FILES_PER_POST) throw new ApiError("TOO_MANY_FILES", 413);
  if (input.files.some((file) => file.size > MAX_FILE_BYTES)) throw new ApiError("FILE_TOO_LARGE", 413);

  const uploaded: string[] = [];
  try {
    const added = await uploadAttachments(viewer, id, input.files, uploaded);
    const changes = {
      title: input.title.trim(),
      body: input.body.trim(),
      subject: input.subject,
      level: input.level,
      tags: input.tags,
      attachments: [...kept, ...added],
    };
    const school = {
      school: input.school ? input.school.trim().slice(0, 150) : null,
      school_domain: input.school ? input.schoolDomain : null,
    };
    let { error } = await supabase.from("posts").update({ ...changes, ...school }).eq("id", id);
    // A database from before notes had a school: save the rest (see createPost).
    if (error?.code === "PGRST204") ({ error } = await supabase.from("posts").update(changes).eq("id", id));
    if (error) fail(error);
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(uploaded);
    throw error;
  }

  // Only once the note no longer points at them: remove the files taken out.
  const paths = dropped.map((attachment) => storagePath(attachment.url)).filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);

  return getPost(id);
}

export async function deletePost(id: string): Promise<void> {
  const viewer = await requireViewer();
  const post = unwrap(
    await supabase.from("posts").select("author_id, attachments").eq("id", id).single<{ author_id: string; attachments: Attachment[] }>(),
  );
  if (post.author_id !== viewer) throw new ApiError("FORBIDDEN", 403);

  const paths = (post.attachments ?? [])
    .map((attachment) => storagePath(attachment.url))
    .filter((path): path is string => Boolean(path));
  if (paths.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) fail(error);
}

export async function reactToPost(postId: string, type: ReactionType | null): Promise<PostView> {
  const viewer = await requireViewer();
  if (type) {
    const { error } = await supabase.from("reactions").upsert({ post_id: postId, user_id: viewer, type });
    if (error) fail(error);
  } else {
    const { error } = await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", viewer);
    if (error) fail(error);
  }
  return getPost(postId);
}

export async function ratePost(postId: string, value: number | null): Promise<PostView> {
  const viewer = await requireViewer();
  if (value !== null) {
    const rating = Math.min(5, Math.max(1, Math.round(value)));
    const { error } = await supabase.from("ratings").upsert({ post_id: postId, user_id: viewer, value: rating });
    if (error) fail(error);
  } else {
    const { error } = await supabase.from("ratings").delete().eq("post_id", postId).eq("user_id", viewer);
    if (error) fail(error);
  }
  return getPost(postId);
}

export async function toggleSavePost(postId: string): Promise<PostView> {
  const viewer = await requireViewer();
  const existing = await supabase
    .from("saves")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewer)
    .maybeSingle();
  if (existing.error) fail(existing.error);

  if (existing.data) {
    const { error } = await supabase.from("saves").delete().eq("post_id", postId).eq("user_id", viewer);
    if (error) fail(error);
  } else {
    const { error } = await supabase.from("saves").insert({ post_id: postId, user_id: viewer });
    if (error) fail(error);
  }
  return getPost(postId);
}

// ---- Comments ----

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: ProfileRow | null;
}

const COMMENT_SELECT = `
  id, post_id, author_id, body, created_at,
  author:profiles!comments_author_id_fkey (${PROFILE_COLUMNS})
`;

function toCommentView(row: CommentRow): CommentView {
  if (!row.author) throw new ApiError("NOT_FOUND", 404);
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    author: toPublicUser(row.author),
  };
}

export async function getComments(postId: string): Promise<CommentView[]> {
  const rows = unwrap(
    await supabase
      .from("comments")
      .select(COMMENT_SELECT)
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .returns<CommentRow[]>(),
  );
  return rows.map(toCommentView);
}

export async function addComment(postId: string, body: string): Promise<CommentView> {
  const viewer = await requireViewer();
  const row = unwrap(
    await supabase
      .from("comments")
      .insert({ post_id: postId, author_id: viewer, body: body.trim() })
      .select(COMMENT_SELECT)
      .single<CommentRow>(),
  );
  return toCommentView(row);
}

export async function deleteComment(commentId: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) fail(error);
}

// ---- Profiles ----

export async function getProfile(username: string): Promise<ProfileView> {
  const profile = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle<ProfileRow>();
  if (profile.error) fail(profile.error);
  if (!profile.data) throw new ApiError("NOT_FOUND", 404);

  const viewer = await viewerId();
  const [stats, following] = await Promise.all([
    supabase
      .from("profile_stats")
      .select("posts, reactions, average_rating, followers, following")
      .eq("id", profile.data.id)
      .maybeSingle<{
        posts: number;
        reactions: number;
        average_rating: number | null;
        followers: number;
        following: number;
      }>(),
    viewer
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewer)
          .eq("following_id", profile.data.id)
          .maybeSingle()
      : null,
  ]);
  if (stats.error) fail(stats.error);

  return {
    user: toPublicUser(profile.data),
    stats: {
      posts: stats.data?.posts ?? 0,
      reactions: stats.data?.reactions ?? 0,
      averageRating: stats.data?.average_rating ?? null,
      followers: stats.data?.followers ?? 0,
      following: stats.data?.following ?? 0,
    },
    isFollowing: Boolean(following?.data),
  };
}

// ---- Follows ----

async function idForUsername(username: string): Promise<string> {
  const row = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle<{ id: string }>();
  if (row.error) fail(row.error);
  if (!row.data) throw new ApiError("NOT_FOUND", 404);
  return row.data.id;
}

export async function followUser(username: string): Promise<ProfileView> {
  const viewer = await requireViewer();
  const target = await idForUsername(username);
  if (target === viewer) throw new ApiError("FORBIDDEN", 403);
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: viewer, following_id: target }, { onConflict: "follower_id,following_id" });
  if (error) fail(error);
  return getProfile(username);
}

export async function unfollowUser(username: string): Promise<ProfileView> {
  const viewer = await requireViewer();
  const target = await idForUsername(username);
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", viewer)
    .eq("following_id", target);
  if (error) fail(error);
  return getProfile(username);
}

async function profilesByIds(ids: string[]): Promise<PublicUser[]> {
  if (!ids.length) return [];
  const rows = unwrap(
    await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", ids).returns<ProfileRow[]>(),
  );
  return rows.map(toPublicUser);
}

export async function getFollowers(username: string): Promise<PublicUser[]> {
  const target = await idForUsername(username);
  const rows = unwrap(
    await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", target)
      .order("created_at", { ascending: false })
      .returns<{ follower_id: string }[]>(),
  );
  return profilesByIds(rows.map((row) => row.follower_id));
}

export async function getFollowing(username: string): Promise<PublicUser[]> {
  const target = await idForUsername(username);
  const rows = unwrap(
    await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", target)
      .order("created_at", { ascending: false })
      .returns<{ following_id: string }[]>(),
  );
  return profilesByIds(rows.map((row) => row.following_id));
}

// ---- Verification ----

interface VerificationRow {
  id: string;
  user_id: string;
  reason: string;
  link: string;
  status: Exclude<VerificationStatus, "none">;
  created_at: string;
  decided_at: string | null;
  user: ProfileRow | null;
}

const VERIFICATION_SELECT = `
  id, user_id, reason, link, status, created_at, decided_at,
  user:profiles!verification_requests_user_id_fkey (${PROFILE_COLUMNS})
`;

function toVerificationRequest(row: VerificationRow): VerificationRequest {
  if (!row.user) throw new ApiError("NOT_FOUND", 404);
  return {
    id: row.id,
    user: toPublicUser(row.user),
    reason: row.reason,
    link: row.link,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

export interface VerificationState {
  status: VerificationStatus;
  request: VerificationRequest | null;
}

export async function getMyVerification(): Promise<VerificationState> {
  const user = await currentUser();
  if (!user) return { status: "none", request: null };
  if (user.verified) return { status: "approved", request: null };

  const rows = unwrap(
    await supabase
      .from("verification_requests")
      .select(VERIFICATION_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<VerificationRow[]>(),
  );
  const latest = rows[0];
  return latest
    ? { status: latest.status, request: toVerificationRequest(latest) }
    : { status: "none", request: null };
}

export async function requestVerification(input: NewVerificationRequest): Promise<VerificationRequest> {
  const viewer = await requireViewer();
  const result = await supabase
    .from("verification_requests")
    .insert({ user_id: viewer, reason: input.reason.trim(), link: input.link.trim() })
    .select(VERIFICATION_SELECT)
    .single<VerificationRow>();
  if (result.error) {
    if (result.error.code === "23505") throw new ApiError("ALREADY_REQUESTED", 409);
    fail(result.error);
  }
  return toVerificationRequest(unwrap(result));
}

/** Admin only: row level security returns nothing for everyone else. */
export async function getVerificationRequests(): Promise<VerificationRequest[]> {
  await requireViewer();
  const rows = unwrap(
    await supabase
      .from("verification_requests")
      .select(VERIFICATION_SELECT)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .returns<VerificationRow[]>(),
  );
  return rows.map(toVerificationRequest);
}

/** Admin only: approving also sets the badge on the profile. */
export async function decideVerification(id: string, approve: boolean): Promise<void> {
  const viewer = await requireViewer();
  const request = unwrap(
    await supabase
      .from("verification_requests")
      .select("user_id")
      .eq("id", id)
      .single<{ user_id: string }>(),
  );

  const decided = await supabase
    .from("verification_requests")
    .update({
      status: approve ? "approved" : "rejected",
      decided_at: new Date().toISOString(),
      decided_by: viewer,
    })
    .eq("id", id)
    .select("id");
  if (decided.error) fail(decided.error);
  if (!decided.data?.length) throw new ApiError("FORBIDDEN", 403);

  if (approve) {
    const { error } = await supabase.from("profiles").update({ verified: true }).eq("id", request.user_id);
    if (error) fail(error);
  }
}

// ---- Profile images ----

/** Stores avatars and banners in the attachments bucket and returns their URL. */
export async function uploadProfileImage(kind: ProfileImageKind, dataUrl: string): Promise<string> {
  const viewer = await requireViewer();
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${viewer}/profile/${kind}-${Date.now()}.jpg`;

  const upload = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (upload.error) fail(upload.error);

  // Drop older files of the same kind so storage does not grow forever.
  const { data: existing } = await supabase.storage.from(ATTACHMENTS_BUCKET).list(`${viewer}/profile`);
  const stale = (existing ?? [])
    .filter((file) => file.name.startsWith(`${kind}-`) && `${viewer}/profile/${file.name}` !== path)
    .map((file) => `${viewer}/profile/${file.name}`);
  if (stale.length) await supabase.storage.from(ATTACHMENTS_BUCKET).remove(stale);

  return supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---- Search & discovery ----

export async function searchSuggestions(
  query: string,
  scope: SearchScope = "all",
): Promise<SearchSuggestions> {
  const term = query.trim();
  if (!term) return { people: [], schools: [], subjects: [], tags: [] };
  const like = `%${term}%`;
  const limit = scope === "all" ? 4 : 12;
  const wants = (kind: SearchScope) => scope === "all" || scope === kind;

  const [people, schools, tags, subjects] = await Promise.all([
    wants("people")
      ? supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .or(
            ["display_name", "username", "school", "country", "field_of_study"]
              .map((column) => `${column}.ilike.${like}`)
              .join(","),
          )
          .limit(limit)
          .returns<ProfileRow[]>()
      : null,
    wants("schools")
      ? supabase
          .from("school_stats")
          .select("*")
          .or(`name.ilike.${like},country.ilike.${like}`)
          .order("posts", { ascending: false })
          .limit(limit)
          .returns<SchoolSummary[]>()
      : null,
    wants("tags")
      ? supabase
          .from("tag_stats")
          .select("*")
          .ilike("tag", like)
          .order("posts", { ascending: false })
          .limit(limit)
          .returns<TagSummary[]>()
      : null,
    wants("subjects") ? supabase.from("subject_stats").select("*").returns<SubjectSummary[]>() : null,
  ]);

  const lower = term.toLowerCase();
  return {
    people: people ? (unwrap(people) ?? []).map(toPublicUser) : [],
    schools: schools ? unwrap(schools) ?? [] : [],
    tags: tags ? unwrap(tags) ?? [] : [],
    subjects: subjects
      ? (unwrap(subjects) ?? [])
          .filter(
            (item) =>
              subjectLabel(item.subject).toLowerCase().includes(lower) ||
              item.subject.replace(/-/g, " ").includes(lower),
          )
          .sort((a, b) => b.posts - a.posts)
          .slice(0, limit)
      : [],
  };
}

export interface TrendingView {
  tags: TagSummary[];
  schools: SchoolSummary[];
  people: PublicUser[];
}

export async function getTrending(): Promise<TrendingView> {
  const [tags, schools, top] = await Promise.all([
    supabase.from("tag_stats").select("*").order("posts", { ascending: false }).limit(8).returns<TagSummary[]>(),
    supabase.from("school_stats").select("*").order("posts", { ascending: false }).limit(5).returns<SchoolSummary[]>(),
    supabase
      .from("profile_stats")
      .select("id, posts")
      .order("posts", { ascending: false })
      .limit(4)
      .returns<{ id: string; posts: number }[]>(),
  ]);

  const ids = (unwrap(top) ?? []).map((row) => row.id);
  const people = ids.length
    ? unwrap(await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", ids).returns<ProfileRow[]>())
    : [];
  const order = new Map(ids.map((id, index) => [id, index]));

  return {
    tags: unwrap(tags) ?? [],
    schools: unwrap(schools) ?? [],
    people: people.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toPublicUser),
  };
}

// ---- Direct messages ----

const THREAD_LIMIT = 200;
/** Private bucket: chat files are shown through signed URLs only. */
const CHAT_BUCKET = "chat";
/** Long enough for a study session with the thread left open. */
const SIGNED_URL_SECONDS = 12 * 60 * 60;
/** Keeps "typing…" to one broadcast every few seconds while someone types. */
const TYPING_THROTTLE_MS = 2500;

type StoredAttachment = Omit<MessageAttachment, "url" | "downloadUrl">;

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string;
  attachment: StoredAttachment | null;
  sticker: string | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  message_reactions?: { user_id: string; type: ReactionType | null }[];
}

interface ConversationRow {
  id: string;
  user_a: string;
  user_b: string;
  a_read_at: string;
  b_read_at: string;
}

interface InboxRow {
  id: string;
  other_id: string;
  last_message_at: string;
  last_body: string;
  last_sender: string;
  last_kind: MessageKind;
  last_attachment_name: string | null;
  last_deleted: boolean;
  unread: number;
}

const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, kind, body, attachment, sticker, reply_to, edited_at, deleted_at, created_at";

/** REST and Realtime format timestamps differently; one shape keeps them comparable. */
function iso(value: string): string {
  return new Date(value).toISOString();
}

function isoOrNull(value: string | null): string | null {
  return value ? iso(value) : null;
}

/** Signed URLs for every file among `rows`, keyed by storage path. */
async function signAttachments(rows: MessageRow[]): Promise<Map<string, string>> {
  const paths = [...new Set(rows.flatMap((row) => (row.attachment?.path ? [row.attachment.path] : [])))];
  if (!paths.length) return new Map();
  const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [])));
}

function toMessage(row: MessageRow, urls: Map<string, string>): Message {
  const signed = row.attachment ? urls.get(row.attachment.path) : undefined;
  const reactions: Record<string, ReactionType> = {};
  for (const reaction of row.message_reactions ?? []) {
    if (reaction.type) reactions[reaction.user_id] = reaction.type;
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    kind: row.kind ?? "text",
    body: row.body ?? "",
    attachment: row.attachment
      ? {
          ...row.attachment,
          url: signed ?? "",
          // Storage serves a signed URL as a download when asked to by name.
          downloadUrl: signed ? `${signed}&download=${encodeURIComponent(row.attachment.name)}` : "",
        }
      : null,
    sticker: row.sticker,
    replyToId: row.reply_to,
    reactions,
    editedAt: isoOrNull(row.edited_at),
    deletedAt: isoOrNull(row.deleted_at),
    createdAt: iso(row.created_at),
  };
}

async function toMessages(rows: MessageRow[]): Promise<Message[]> {
  const urls = await signAttachments(rows);
  return rows.map((row) => toMessage(row, urls));
}

/** The database raises P0002 for "no such message" from its chat functions. */
function failChat(error: PostgrestError): never {
  if (error.code === "P0002") throw new ApiError("NOT_FOUND", 404);
  if (error.code === "23514" || error.code === "22023") throw new ApiError("UNKNOWN", 400, error.message);
  fail(error);
}

export async function getConversations(): Promise<ConversationSummary[]> {
  await requireViewer();
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) fail(error);
  const rows = (data ?? []) as InboxRow[];
  const people = new Map((await profilesByIds(rows.map((row) => row.other_id))).map((user) => [user.id, user]));

  return rows.flatMap((row) => {
    const other = people.get(row.other_id);
    if (!other) return [];
    return [
      {
        id: row.id,
        other,
        lastMessage: {
          body: row.last_body,
          senderId: row.last_sender,
          createdAt: iso(row.last_message_at),
          kind: row.last_kind ?? "text",
          attachmentName: row.last_attachment_name,
          deleted: row.last_deleted,
        },
        unread: row.unread,
      },
    ];
  });
}

export async function getThread(username: string): Promise<ThreadView> {
  const viewer = await requireViewer();
  const profile = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("username", username.trim().toLowerCase())
    .maybeSingle<ProfileRow>();
  if (profile.error) fail(profile.error);
  if (!profile.data) throw new ApiError("NOT_FOUND", 404);
  const other = profile.data;
  if (other.id === viewer) throw new ApiError("FORBIDDEN", 403);

  // RLS already limits this to the viewer's own conversations, so the one that
  // includes the other person is the pair.
  const conversation = await supabase
    .from("conversations")
    .select("id, user_a, user_b, a_read_at, b_read_at")
    .or(`user_a.eq.${other.id},user_b.eq.${other.id}`)
    .maybeSingle<ConversationRow>();
  if (conversation.error) fail(conversation.error);

  let messages: Message[] = [];
  if (conversation.data) {
    const rows = unwrap(
      await supabase
        .from("messages")
        .select(`${MESSAGE_COLUMNS}, message_reactions (user_id, type)`)
        .eq("conversation_id", conversation.data.id)
        .order("created_at", { ascending: false })
        .limit(THREAD_LIMIT)
        .returns<MessageRow[]>(),
    );
    messages = await toMessages(rows.reverse());
  }

  const row = conversation.data;
  return {
    conversationId: row?.id ?? null,
    other: toPublicUser(other),
    messages,
    otherReadAt: row ? iso(row.user_a === other.id ? row.a_read_at : row.b_read_at) : null,
  };
}

function fileExtensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,10})$/i.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export async function sendMessage(username: string, input: OutgoingMessage): Promise<Message> {
  const viewer = await requireViewer();
  const body = input.kind === "sticker" ? "" : (input.body ?? "").trim();
  if (body.length > MAX_MESSAGE_LENGTH) throw new ApiError("MESSAGE_TOO_LONG", 400);
  if (input.kind === "text" && !body) throw new ApiError("UNKNOWN", 400);

  const recipient = await idForUsername(username);
  if (recipient === viewer) throw new ApiError("FORBIDDEN", 403);

  let attachment: Record<string, unknown> | null = null;
  let uploaded: string | null = null;
  if (input.kind !== "text" && input.kind !== "sticker") {
    const { file } = input;
    if (!file) throw new ApiError("UNKNOWN", 400);
    if (file.size > MAX_FILE_BYTES) throw new ApiError("FILE_TOO_LARGE", 413);
    // Only the sender's own folder is writable; the name is random so nothing
    // about the file leaks through its path.
    const path = `${viewer}/${crypto.randomUUID()}${fileExtensionOf(file.name)}`;
    const upload = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
      contentType: safeContentType(file.type || "application/octet-stream"),
      upsert: false,
    });
    if (upload.error) fail(upload.error);
    uploaded = path;
    attachment = { path, name: file.name || "file", ...input.meta };
  }

  const { data, error } = await supabase
    .rpc("send_message", {
      recipient,
      message_body: body,
      message_kind: input.kind,
      message_attachment: attachment,
      message_sticker: input.sticker ?? null,
      reply_to_id: input.replyToId ?? null,
    })
    .single<MessageRow>();
  if (error) {
    // Nothing references the upload now, so it would only take up space.
    if (uploaded) await supabase.storage.from(CHAT_BUCKET).remove([uploaded]);
    failChat(error);
  }
  if (!data) throw new ApiError("UNKNOWN", 500);
  const [message] = await toMessages([data]);
  return message;
}

export async function editMessage(messageId: string, body: string): Promise<Message> {
  await requireViewer();
  const text = body.trim();
  if (!text) throw new ApiError("UNKNOWN", 400);
  if (text.length > MAX_MESSAGE_LENGTH) throw new ApiError("MESSAGE_TOO_LONG", 400);
  const { data, error } = await supabase
    .rpc("edit_message", { message_id: messageId, new_body: text })
    .single<MessageRow>();
  if (error) failChat(error);
  if (!data) throw new ApiError("UNKNOWN", 500);
  const [message] = await toMessages([data]);
  return message;
}

export async function unsendMessage(messageId: string): Promise<void> {
  await requireViewer();
  const { data, error } = await supabase.rpc("unsend_message", { message_id: messageId });
  if (error) failChat(error);
  // The other person can no longer read the file; the sender removes it.
  if (typeof data === "string" && data) await supabase.storage.from(CHAT_BUCKET).remove([data]);
}

export async function reactToMessage(messageId: string, reaction: ReactionType | null): Promise<void> {
  await requireViewer();
  const { error } = await supabase.rpc("react_to_message", { message_id: messageId, reaction });
  if (error) failChat(error);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.rpc("mark_conversation_read", { conv: conversationId });
  if (error) fail(error);
}

export async function getUnreadCount(): Promise<number> {
  if (!(await viewerId())) return 0;
  const { data, error } = await supabase.rpc("unread_message_count");
  if (error) fail(error);
  return typeof data === "number" ? data : 0;
}

/**
 * Live chat updates. Realtime checks each event against the select policies,
 * so a subscriber only hears about their own conversations.
 */
export function subscribeToChat(callback: (event: ChatEvent) => void): () => void {
  const channel = supabase
    .channel(`chat-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      void toMessages([payload.new as MessageRow]).then(([message]) => callback({ type: "message", message }));
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      void toMessages([payload.new as MessageRow]).then(([message]) => callback({ type: "updated", message }));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
      const row = payload.new as Partial<{ message_id: string; user_id: string; type: ReactionType | null }>;
      if (!row.message_id || !row.user_id) return;
      callback({ type: "reaction", messageId: row.message_id, userId: row.user_id, reaction: row.type ?? null });
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
      const row = payload.new as ConversationRow;
      callback({
        type: "read",
        conversationId: row.id,
        reads: { [row.user_a]: iso(row.a_read_at), [row.user_b]: iso(row.b_read_at) },
      });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * "Typing…" for one conversation, over a private broadcast channel that only
 * its two members may join (see the realtime.messages policies in schema.sql).
 */
export function joinConversation(conversationId: string, onTyping: () => void): ConversationChannel {
  const channel = supabase.channel(`typing:${conversationId}`, {
    config: { private: true, broadcast: { self: false } },
  });
  channel.on("broadcast", { event: "typing" }, () => onTyping()).subscribe();

  let lastSent = 0;
  return {
    typing: () => {
      const now = Date.now();
      if (now - lastSent < TYPING_THROTTLE_MS) return;
      lastSent = now;
      void channel.send({ type: "broadcast", event: "typing", payload: {} });
    },
    leave: () => {
      void supabase.removeChannel(channel);
    },
  };
}

// ---- Files ----

/** Keeps the app in step with sign-in, sign-out and token refresh (any tab). */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      callback(null);
      return;
    }
    currentUser()
      .then(callback)
      .catch(() => callback(null));
  });
  return () => data.subscription.unsubscribe();
}

/** Uploads are already public URLs, so nothing has to be resolved. */
export async function getAttachmentUrl(attachment: Attachment): Promise<string> {
  return attachment.url;
}

// ---- BacII curriculum ----

interface CurriculumSubjectRow {
  id: string;
  track_id: string;
  subject_key: string;
  name_en: string;
  name_km: string;
  sort: number;
  track: { key: string; name_en: string; name_km: string; sort: number; version: { grade: number } | null } | null;
}

interface CurriculumChapterRow {
  id: string;
  subject_id: string;
  number: number;
  name_en: string;
  name_km: string;
  verification: Verification;
  source: string;
  topics: { id: string; chapter_id: string; name_en: string; name_km: string; sort: number; verification: Verification }[];
}

export async function getCurriculumSubjects(): Promise<CurriculumSubject[]> {
  const rows = unwrap(
    await supabase
      .from("curriculum_subjects")
      .select("id, track_id, subject_key, name_en, name_km, sort, track:curriculum_tracks(key, name_en, name_km, sort, version:curriculum_versions(grade))")
      .returns<CurriculumSubjectRow[]>(),
  );
  return rows
    .map((row) => ({
      id: row.id,
      trackId: row.track_id,
      trackKey: row.track?.key ?? "",
      trackNameEn: row.track?.name_en ?? "",
      trackNameKm: row.track?.name_km ?? "",
      grade: row.track?.version?.grade ?? 0,
      subjectKey: row.subject_key,
      nameEn: row.name_en,
      nameKm: row.name_km,
      sort: row.sort,
      trackSort: row.track?.sort ?? 0,
    }))
    .sort((a, b) => a.trackSort - b.trackSort || a.sort - b.sort)
    .map(({ trackSort: _trackSort, ...subject }) => subject);
}

/** A subject's chapters in order, each with its topics. */
export async function getCurriculumChapters(subjectId: string): Promise<CurriculumChapter[]> {
  const rows = unwrap(
    await supabase
      .from("curriculum_chapters")
      .select("id, subject_id, number, name_en, name_km, verification, source, topics:curriculum_topics(id, chapter_id, name_en, name_km, sort, verification)")
      .eq("subject_id", subjectId)
      .order("number")
      .returns<CurriculumChapterRow[]>(),
  );
  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    number: row.number,
    nameEn: row.name_en,
    nameKm: row.name_km,
    verification: row.verification,
    source: row.source,
    topics: [...(row.topics ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((topic) => ({
        id: topic.id,
        chapterId: topic.chapter_id,
        nameEn: topic.name_en,
        nameKm: topic.name_km,
        sort: topic.sort,
        verification: topic.verification,
      })),
  }));
}

// ---- BacII questions ----

type QuestionRowWithSolution = QuestionRow & { solution: QuestionSolutionRow | QuestionSolutionRow[] | null };

const questionImageUrl = (path: string) => supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path).data.publicUrl;

/** Database refusals of a question (check rules, unknown chapter) keep their reason. */
function failQuestion(error: PostgrestError): never {
  if (error.code === "P0002") throw new ApiError("NOT_FOUND", 404);
  if (["23514", "22023", "23503", "23502", "22P02"].includes(error.code)) throw new ApiError("UNKNOWN", 400, error.message);
  fail(error);
}

export async function getQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
  let builder = supabase.from("questions").select(QUESTION_SELECT).order("created_at", { ascending: false }).limit(500);
  if (filter.subjectId) builder = builder.eq("subject_id", filter.subjectId);
  if (filter.chapterId) builder = builder.eq("chapter_id", filter.chapterId);
  if (filter.topicId) builder = builder.eq("topic_id", filter.topicId);
  return unwrap(await builder.returns<QuestionRowWithSolution[]>()).map((row) => toQuestion(row, questionImageUrl));
}

export async function getQuestion(id: string): Promise<Question> {
  const { data, error } = await supabase.from("questions").select(QUESTION_SELECT).eq("id", id).maybeSingle<QuestionRowWithSolution>();
  if (error) failQuestion(error);
  if (!data) throw new ApiError("NOT_FOUND", 404);
  return toQuestion(data, questionImageUrl);
}

/** Saves a question with its solution in one transaction (save_question in schema.sql); admins only. */
export async function saveQuestion(input: QuestionInput, id: string | null): Promise<Question> {
  await requireViewer();
  const { question, solution } = toSaveQuestionArgs(input);
  const { data, error } = await supabase.rpc("save_question", { target: id, question, solution });
  if (error) failQuestion(error);
  return getQuestion(data as string);
}

export async function deleteQuestion(id: string): Promise<void> {
  await requireViewer();
  const { data, error } = await supabase.from("questions").delete().eq("id", id).select("id");
  if (error) failQuestion(error);
  if (!data?.length) throw new ApiError("FORBIDDEN", 403);
}

/** Uploads a question image to the uploader's own folder in the public bucket. */
export async function uploadQuestionImage(file: File): Promise<Omit<QuestionImage, "alt">> {
  const viewer = await requireViewer();
  const extension = questionImageExtension(file.type);
  if (!extension) throw new ApiError("UNSUPPORTED_FILE", 415);
  if (file.size > MAX_QUESTION_IMAGE_BYTES) throw new ApiError("FILE_TOO_LARGE", 413);
  const path = `${viewer}/questions/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) fail(upload.error);
  return { path, url: questionImageUrl(path) };
}

// ---- BacII exam papers ----

interface ExamPaperRow {
  id: string;
  subject_id: string;
  year: number;
  title_en: string;
  title_km: string;
  duration_minutes: number | null;
  duration_source: string;
  origin: PaperOrigin;
  source: string;
  verification: Verification;
  subject?: { track: { key: string } | null } | null;
  entries: { position?: number; points: number | string | null; question?: QuestionRowWithSolution | null }[];
}

function toExamPaper(row: ExamPaperRow): ExamPaper {
  const points = (row.entries ?? []).map((entry) => (entry.points === null ? null : Number(entry.points)));
  return {
    id: row.id,
    subjectId: row.subject_id,
    year: row.year,
    titleEn: row.title_en,
    titleKm: row.title_km,
    durationMinutes: row.duration_minutes,
    durationSource: row.duration_source,
    origin: row.origin,
    source: row.source,
    verification: row.verification,
    questionCount: points.length,
    totalPoints: points.length && points.every((value) => value !== null) ? points.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null,
  };
}

export async function getExamPapers(filter: PaperFilter = {}): Promise<ExamPaper[]> {
  let builder = supabase
    .from("exam_papers")
    .select("*, subject:curriculum_subjects(track:curriculum_tracks(key)), entries:exam_paper_questions(points)")
    .order("year", { ascending: false })
    .order("title_en");
  if (filter.subjectId) builder = builder.eq("subject_id", filter.subjectId);
  if (filter.year) builder = builder.eq("year", filter.year);
  const rows = unwrap(await builder.returns<ExamPaperRow[]>());
  return rows.filter((row) => !filter.trackKey || row.subject?.track?.key === filter.trackKey).map(toExamPaper);
}

export async function getExamPaper(id: string): Promise<ExamPaperDetail> {
  const { data, error } = await supabase
    .from("exam_papers")
    .select("*, entries:exam_paper_questions(position, points, question:questions(*, solution:question_solutions(*)))")
    .eq("id", id)
    .maybeSingle<ExamPaperRow>();
  if (error) failQuestion(error);
  if (!data) throw new ApiError("NOT_FOUND", 404);
  const questions = [...(data.entries ?? [])]
    .filter((entry) => entry.question)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((entry) => ({
      position: entry.position ?? 0,
      points: entry.points === null ? null : Number(entry.points),
      question: toQuestion(entry.question!, questionImageUrl),
    }));
  return { ...toExamPaper(data), questions };
}

// ---- BacII mock exams ----
// Everything that counts runs in the database: start_exam, save_exam_answer
// and submit_exam (supabase/schema.sql). These only read and call them.

interface ExamAttemptRow {
  id: string;
  paper_id: string;
  timing: "official" | "practice";
  duration_minutes: number;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  status: ExamAttempt["status"];
  score: number | string | null;
  max_score: number | string | null;
  unmarked: number | null;
}

const asNumber = (value: number | string | null) => (value === null ? null : Number(value));

function toExamAttempt(row: ExamAttemptRow): ExamAttempt {
  return {
    id: row.id,
    paperId: row.paper_id,
    timing: row.timing,
    durationMinutes: row.duration_minutes,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.submitted_at,
    status: row.status,
    score: asNumber(row.score),
    maxScore: asNumber(row.max_score),
    unmarked: row.unmarked,
  };
}

export async function startExam(paperId: string, practiceMinutes: number): Promise<ExamStart> {
  await requireViewer();
  const sent = Date.now();
  const { data, error } = await supabase.rpc("start_exam", { paper: paperId, practice_minutes: practiceMinutes });
  if (error) failQuestion(error);
  const row = (data as { attempt_id: string; deadline_at: string; server_now: string }[])[0];
  // The server's clock, corrected for half the round trip, decides the time left.
  const clockOffsetMs = Date.parse(row.server_now) - (sent + Date.now()) / 2;
  return { attemptId: row.attempt_id, deadlineAt: row.deadline_at, clockOffsetMs };
}

export async function saveExamAnswer(attemptId: string, questionId: string, answer: string): Promise<void> {
  const { data, error } = await supabase.rpc("save_exam_answer", { attempt: attemptId, question: questionId, answer });
  if (error) failQuestion(error);
  if (data === "time-up") throw new ApiError("UNKNOWN", 400, "time is up");
}

export async function submitExam(attemptId: string): Promise<void> {
  const { error } = await supabase.rpc("submit_exam", { attempt: attemptId });
  if (error) failQuestion(error);
}

export async function getExamAttempt(attemptId: string): Promise<ExamAttemptDetail> {
  await requireViewer();
  let { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle<ExamAttemptRow>();
  if (error) failQuestion(error);
  if (!data) throw new ApiError("NOT_FOUND", 404);
  // Time ran out while away: let the server close and mark it first.
  if (data.status === "in-progress" && Date.parse(data.deadline_at) <= Date.now()) {
    await submitExam(attemptId);
    ({ data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).maybeSingle<ExamAttemptRow>());
    if (error) failQuestion(error);
    if (!data) throw new ApiError("NOT_FOUND", 404);
  }
  const answers = unwrap(
    await supabase
      .from("exam_answers")
      .select("question_id, answer, is_correct, points_awarded, updated_at")
      .eq("attempt_id", attemptId)
      .returns<{ question_id: string; answer: string; is_correct: boolean | null; points_awarded: number | string | null; updated_at: string }[]>(),
  );
  return {
    attempt: toExamAttempt(data),
    answers: answers.map(
      (row): ExamAnswer => ({
        questionId: row.question_id,
        answer: row.answer,
        isCorrect: row.is_correct,
        pointsAwarded: asNumber(row.points_awarded),
        updatedAt: row.updated_at,
      }),
    ),
  };
}

export async function getMyExamAttempts(paperId?: string): Promise<ExamAttempt[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  let builder = supabase.from("exam_attempts").select("*").eq("user_id", viewer).order("started_at", { ascending: false }).limit(50);
  if (paperId) builder = builder.eq("paper_id", paperId);
  return unwrap(await builder.returns<ExamAttemptRow[]>()).map(toExamAttempt);
}

// ---- Mistake notebook ----

interface MistakeRow {
  question_id: string;
  last_answer: string;
  source: "practice" | "exam";
  attempt_id: string | null;
  times_wrong: number;
  first_wrong_at: string;
  last_wrong_at: string;
  fixed_at: string | null;
  question: QuestionRowWithSolution | null;
}

/** Marked by record_practice_answer, which also keeps the notebook; null when it cannot be marked. */
export async function recordPracticeAnswer(questionId: string, answer: string): Promise<boolean | null> {
  await requireViewer();
  const { data, error } = await supabase.rpc("record_practice_answer", { question: questionId, answer });
  if (error) throw new ApiError(error.code === "42501" ? "FORBIDDEN" : "UNKNOWN", error.code === "42501" ? 403 : 400, error.message);
  return data as boolean | null;
}

export async function getMistakes(): Promise<Mistake[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const rows = unwrap(
    await supabase
      .from("mistakes")
      .select(`*, question:questions(${QUESTION_SELECT})`)
      .eq("user_id", viewer)
      .order("last_wrong_at", { ascending: false })
      .limit(500)
      .returns<MistakeRow[]>(),
  );
  return rows
    .filter((row) => row.question)
    .map((row) => ({
      questionId: row.question_id,
      lastAnswer: row.last_answer,
      source: row.source,
      attemptId: row.attempt_id,
      timesWrong: row.times_wrong,
      firstWrongAt: row.first_wrong_at,
      lastWrongAt: row.last_wrong_at,
      fixedAt: row.fixed_at,
      question: toQuestion(row.question!, questionImageUrl),
    }));
}

export async function deleteMistake(questionId: string): Promise<void> {
  const viewer = await requireViewer();
  const { error } = await supabase.from("mistakes").delete().eq("user_id", viewer).eq("question_id", questionId);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}
