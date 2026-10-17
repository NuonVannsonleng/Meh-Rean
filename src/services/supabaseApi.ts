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
import { suggestedProfile } from "../lib/learningDefaults";
import type { TopicResult } from "../lib/learningProfile";
import type { ConceptLinkInput } from "../lib/conceptGraph";
import { describeMastery, type MasteryRules, type TopicMastery } from "../lib/mastery";
import masteryRules from "../data/learning/mastery-rules.json";
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
  type ChapterProgress,
  type DailyQuestion,
  type DailyStreak,
  type ExamAttempt,
  type LiveAnswerResult,
  type LiveGameState,
  type LiveGameView,
  type LivePlayer,
  type LiveQuestion,
  type LiveQuiz,
  type ConceptLink,
  type LearningEvent,
  type LearningProfile,
  type LearningProfileInput,
  type ResourceTopic,
  type ResourceTopicInput,
  type Mistake,
  type StudyPlan,
  type StudyPlanInput,
  type VideoChannel,
  type VideoProgress,
  type VideoQuiz,
  type VideoQuizInput,
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

/** Questions per topic in a subject, reading only their topics (Learning OS 4.5). */
export async function getTopicQuestionCounts(subjectId: string): Promise<Record<string, number>> {
  const rows = unwrap(await supabase.from("questions").select("topic_id").eq("subject_id", subjectId).not("topic_id", "is", null).limit(5000).returns<{ topic_id: string }[]>());
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.topic_id] = (counts[row.topic_id] ?? 0) + 1;
  return counts;
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
  review_stage: number;
  next_review_at: string | null;
  postponed?: number;
  question: QuestionRowWithSolution | null;
}

/** Marked by record_practice_answer, which also keeps the notebook; null when it cannot be marked. */
export async function recordPracticeAnswer(questionId: string, answer: string, requestId?: string): Promise<boolean | null> {
  await requireViewer();
  // The request id makes a retry harmless: the database returns the first result.
  const { data, error } = await supabase.rpc("record_practice_answer", { question: questionId, answer, request: requestId ?? crypto.randomUUID() });
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
      reviewStage: row.review_stage,
      nextReviewAt: row.next_review_at,
      postponed: row.postponed ?? 0,
      question: toQuestion(row.question!, questionImageUrl),
    }));
}

/** Puts off a due review by 1, 3 or 7 days (Learning OS 7.2); the database sets the date. */
export async function postponeReview(questionId: string, days: 1 | 3 | 7): Promise<string> {
  await requireViewer();
  const { data, error } = await supabase.rpc("postpone_review", { question: questionId, days });
  if (error) throw new ApiError(error.code === "42501" ? "FORBIDDEN" : error.code === "P0002" ? "NOT_FOUND" : "UNKNOWN", error.code === "P0002" ? 404 : 400, error.message);
  return data as string;
}

export async function deleteMistake(questionId: string): Promise<void> {
  const viewer = await requireViewer();
  const { error } = await supabase.from("mistakes").delete().eq("user_id", viewer).eq("question_id", questionId);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}

// ---- Daily question and streak ----

interface DailyQuestionRow {
  question_id: string;
  day: string;
  chapter_id: string;
  from_results: boolean;
  answered_at: string | null;
  correct: boolean | null;
}

/** Today's question, picked once a day on the server (daily_question in schema.sql). */
export async function getDailyQuestion(): Promise<DailyQuestion | null> {
  await requireViewer();
  const { data, error } = await supabase.rpc("daily_question");
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  const row = (data as DailyQuestionRow[] | null)?.[0];
  if (!row) return null;
  const question = await getQuestion(row.question_id);
  return {
    day: row.day,
    chapterId: row.chapter_id,
    fromResults: row.from_results,
    answeredAt: row.answered_at,
    correct: row.correct,
    question,
  };
}

export async function getDailyStreak(): Promise<DailyStreak> {
  await requireViewer();
  const { data, error } = await supabase.rpc("daily_streak");
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  const row = (data as { current_streak: number; best_streak: number; answered_today: boolean }[] | null)?.[0];
  return { current: row?.current_streak ?? 0, best: row?.best_streak ?? 0, answeredToday: row?.answered_today ?? false };
}

// ---- Chapter progress and study plans ----

export async function getChapterProgress(): Promise<ChapterProgress[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const rows = unwrap(
    await supabase.from("chapter_progress").select("chapter_id, answered, correct").eq("user_id", viewer).returns<{ chapter_id: string; answered: number; correct: number }[]>(),
  );
  return rows.map((row) => ({ chapterId: row.chapter_id, answered: row.answered, correct: row.correct }));
}

interface StudyPlanRow {
  subject_id: string;
  exam_date: string;
  hours_per_day: number | string;
  days_per_week: number;
  target_grade: string;
  weak_chapter_ids: string[];
  weeks: StudyPlan["weeks"];
  created_at: string;
  updated_at: string;
}

const toStudyPlan = (row: StudyPlanRow): StudyPlan => ({
  subjectId: row.subject_id,
  examDate: row.exam_date,
  hoursPerDay: Number(row.hours_per_day),
  daysPerWeek: row.days_per_week,
  targetGrade: row.target_grade,
  weakChapterIds: row.weak_chapter_ids,
  weeks: row.weeks,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getStudyPlan(): Promise<StudyPlan | null> {
  const viewer = await viewerId();
  if (!viewer) return null;
  const { data, error } = await supabase.from("study_plans").select("*").eq("user_id", viewer).maybeSingle<StudyPlanRow>();
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  return data ? toStudyPlan(data) : null;
}

export async function saveStudyPlan(input: StudyPlanInput): Promise<StudyPlan> {
  const viewer = await requireViewer();
  const { data, error } = await supabase
    .from("study_plans")
    .upsert({
      user_id: viewer,
      subject_id: input.subjectId,
      exam_date: input.examDate,
      hours_per_day: input.hoursPerDay,
      days_per_week: input.daysPerWeek,
      target_grade: input.targetGrade,
      weak_chapter_ids: input.weakChapterIds,
      weeks: input.weeks,
    })
    .select()
    .single<StudyPlanRow>();
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  return toStudyPlan(data);
}

export async function deleteStudyPlan(): Promise<void> {
  const viewer = await requireViewer();
  const { error } = await supabase.from("study_plans").delete().eq("user_id", viewer);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}

// ---- Trusted video channels ----

interface VideoChannelRow {
  channel_id: string;
  name: string;
  language: "km" | "en";
  subject_keys: string[];
  note: string;
  created_at: string;
}

const toVideoChannel = (row: VideoChannelRow): VideoChannel => ({
  channelId: row.channel_id,
  name: row.name,
  language: row.language,
  subjectKeys: row.subject_keys ?? [],
  note: row.note,
  createdAt: row.created_at,
});

export async function getVideoChannels(): Promise<VideoChannel[]> {
  const rows = unwrap(await supabase.from("video_channels").select("channel_id, name, language, subject_keys, note, created_at").order("name").returns<VideoChannelRow[]>());
  return rows.map(toVideoChannel);
}

export async function saveVideoChannel(input: Omit<VideoChannel, "createdAt">): Promise<VideoChannel> {
  await requireViewer();
  const { data, error } = await supabase
    .from("video_channels")
    .upsert({ channel_id: input.channelId, name: input.name.trim(), language: input.language, subject_keys: input.subjectKeys, note: input.note })
    .select("channel_id, name, language, subject_keys, note, created_at")
    .single<VideoChannelRow>();
  if (error) throw new ApiError(error.code === "42501" ? "FORBIDDEN" : "UNKNOWN", error.code === "42501" ? 403 : 400, error.message);
  return toVideoChannel(data);
}

export async function deleteVideoChannel(channelId: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.from("video_channels").delete().eq("channel_id", channelId);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}

// ---- Video quizzes ----

interface VideoQuizRow {
  video_id: string;
  title: string;
  language: "km" | "en";
  questions: VideoQuiz["questions"];
  source: string;
  ai_generated: boolean;
  reviewed: boolean;
  updated_at: string;
}

const QUIZ_COLUMNS = "video_id, title, language, questions, source, ai_generated, reviewed, updated_at";
const toVideoQuiz = (row: VideoQuizRow): VideoQuiz => ({
  videoId: row.video_id,
  title: row.title,
  language: row.language,
  questions: row.questions,
  source: row.source,
  aiGenerated: row.ai_generated,
  reviewed: row.reviewed,
  updatedAt: row.updated_at,
});

export async function getVideoQuizzes(videoIds?: string[]): Promise<VideoQuiz[]> {
  let builder = supabase.from("video_quizzes").select(QUIZ_COLUMNS).order("updated_at", { ascending: false }).limit(200);
  if (videoIds) builder = builder.in("video_id", videoIds.length ? videoIds : ["-"]);
  return unwrap(await builder.returns<VideoQuizRow[]>()).map(toVideoQuiz);
}

export async function saveVideoQuiz(input: VideoQuizInput): Promise<VideoQuiz> {
  await requireViewer();
  const { data, error } = await supabase
    .from("video_quizzes")
    .upsert({
      video_id: input.videoId,
      title: input.title.trim(),
      language: input.language,
      questions: input.questions,
      source: input.source.trim(),
      ai_generated: input.aiGenerated,
      reviewed: input.reviewed,
      updated_at: new Date().toISOString(),
    })
    .select(QUIZ_COLUMNS)
    .single<VideoQuizRow>();
  if (error) throw new ApiError(error.code === "42501" ? "FORBIDDEN" : "UNKNOWN", error.code === "42501" ? 403 : 400, error.message);
  return toVideoQuiz(data);
}

export async function deleteVideoQuiz(videoId: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.from("video_quizzes").delete().eq("video_id", videoId);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}

// ---- Watched videos ----

interface VideoProgressRow {
  video_id: string;
  title: string;
  channel: string;
  status: VideoProgress["status"];
  chapter_id: string | null;
  updated_at: string;
}

const PROGRESS_COLUMNS = "video_id, title, channel, status, chapter_id, updated_at";
const toVideoProgress = (row: VideoProgressRow): VideoProgress => ({
  videoId: row.video_id,
  title: row.title,
  channel: row.channel,
  status: row.status,
  chapterId: row.chapter_id,
  updatedAt: row.updated_at,
});

export async function getVideoProgress(): Promise<VideoProgress[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const rows = unwrap(
    await supabase.from("video_progress").select(PROGRESS_COLUMNS).eq("user_id", viewer).order("updated_at", { ascending: false }).limit(500).returns<VideoProgressRow[]>(),
  );
  return rows.map(toVideoProgress);
}

export async function setVideoProgress(input: Omit<VideoProgress, "updatedAt">): Promise<VideoProgress> {
  const viewer = await requireViewer();
  const { data, error } = await supabase
    .from("video_progress")
    .upsert({
      user_id: viewer,
      video_id: input.videoId,
      title: input.title.slice(0, 300),
      channel: input.channel.slice(0, 200),
      status: input.status,
      chapter_id: input.chapterId,
      updated_at: new Date().toISOString(),
    })
    .select(PROGRESS_COLUMNS)
    .single<VideoProgressRow>();
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  return toVideoProgress(data);
}

export async function deleteVideoProgress(videoId: string): Promise<void> {
  const viewer = await requireViewer();
  const { error } = await supabase.from("video_progress").delete().eq("user_id", viewer).eq("video_id", videoId);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}

// ---- Live quizzes ----

interface LiveQuizRow {
  id: string;
  title: string;
  questions: LiveQuestion[];
  updated_at: string;
}

interface LiveGameStateRow {
  game_id: string;
  title: string;
  code: string;
  host_id: string;
  status: LiveGameState["status"];
  question_index: number;
  question_count: number;
  prompt: string | null;
  choices: string[] | null;
  seconds: number | null;
  started_at: string | null;
  deadline_at: string | null;
  answered: number;
  player_count: number;
  correct_choice: number | null;
  choice_counts: number[] | null;
}

interface LivePlayerRow {
  player_id: string;
  nickname: string;
  score: number;
  correct_count: number;
  last_points: number;
}

const toLiveQuiz = (row: LiveQuizRow): LiveQuiz => ({ id: row.id, title: row.title, questions: row.questions, updatedAt: row.updated_at });

/** Turns a database error into a message a player can act on. */
function failLive(error: { message: string; code?: string }): never {
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
  throw new ApiError(status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "UNKNOWN", status, error.message);
}

export async function getLiveQuizzes(): Promise<LiveQuiz[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const rows = unwrap(
    await supabase.from("live_quizzes").select("id, title, questions, updated_at").eq("owner_id", viewer).order("updated_at", { ascending: false }).limit(200).returns<LiveQuizRow[]>(),
  );
  return rows.map(toLiveQuiz);
}

export async function getLiveQuiz(id: string): Promise<LiveQuiz> {
  const { data, error } = await supabase.from("live_quizzes").select("id, title, questions, updated_at").eq("id", id).maybeSingle<LiveQuizRow>();
  if (error) failLive(error);
  if (!data) throw new ApiError("NOT_FOUND", 404);
  return toLiveQuiz(data);
}

export async function saveLiveQuiz(input: { title: string; questions: LiveQuestion[] }, id: string | null): Promise<LiveQuiz> {
  await requireViewer();
  const values = { title: input.title.trim(), questions: input.questions, updated_at: new Date().toISOString() };
  const query = id ? supabase.from("live_quizzes").update(values).eq("id", id) : supabase.from("live_quizzes").insert(values);
  const { data, error } = await query.select("id, title, questions, updated_at").single<LiveQuizRow>();
  if (error) failLive(error);
  return toLiveQuiz(data);
}

export async function deleteLiveQuiz(id: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.from("live_quizzes").delete().eq("id", id);
  if (error) failLive(error);
}

export async function startLiveGame(quizId: string): Promise<{ gameId: string; code: string }> {
  await requireViewer();
  const { data, error } = await supabase.rpc("create_live_game", { quiz: quizId });
  if (error) failLive(error);
  const row = (data as { game_id: string; code: string }[])[0];
  return { gameId: row.game_id, code: row.code };
}

export async function joinLiveGame(code: string, nickname: string): Promise<string> {
  await requireViewer();
  const { data, error } = await supabase.rpc("join_live_game", { join_code: code.trim(), nickname: nickname.trim() });
  if (error) failLive(error);
  if (!data) throw new ApiError("NOT_FOUND", 404, "No open game has that code.");
  return data as string;
}

/** Server time minus this phone's, measured once per page and kept. */
let liveClock: { offsetMs: number; at: number } | null = null;
async function liveClockOffset(): Promise<number> {
  if (liveClock && Date.now() - liveClock.at < 60_000) return liveClock.offsetMs;
  const sent = Date.now();
  const { data, error } = await supabase.rpc("live_clock");
  const received = Date.now();
  if (error || !data) return liveClock?.offsetMs ?? 0;
  liveClock = { offsetMs: Date.parse(data as string) - (sent + received) / 2, at: received };
  return liveClock.offsetMs;
}

export async function getLiveGame(gameId: string): Promise<LiveGameView> {
  const viewer = await requireViewer();
  const [stateResult, playersResult, offset, mine] = await Promise.all([
    supabase.from("live_game_state").select("*").eq("game_id", gameId).maybeSingle<LiveGameStateRow>(),
    supabase.from("live_players").select("player_id, nickname, score, correct_count, last_points").eq("game_id", gameId).returns<LivePlayerRow[]>(),
    liveClockOffset(),
    supabase.rpc("live_my_player", { game: gameId }),
  ]);
  if (stateResult.error) failLive(stateResult.error);
  const row = stateResult.data;
  if (!row) throw new ApiError("NOT_FOUND", 404, "This game was not found, or you have not joined it.");
  let myChoice: number | null = null;
  if (row.status !== "lobby" && row.host_id !== viewer) {
    const mine = await supabase
      .from("live_answers")
      .select("choice")
      .eq("game_id", gameId)
      .eq("question_index", row.question_index)
      .eq("user_id", viewer)
      .maybeSingle<{ choice: number }>();
    myChoice = mine.data?.choice ?? null;
  }
  return {
    state: {
      gameId: row.game_id,
      title: row.title,
      code: row.code,
      hostId: row.host_id,
      status: row.status,
      questionIndex: row.question_index,
      questionCount: row.question_count,
      prompt: row.prompt,
      choices: row.choices,
      seconds: row.seconds,
      startedAt: row.started_at,
      deadlineAt: row.deadline_at,
      answered: row.answered,
      playerCount: row.player_count,
      correctChoice: row.correct_choice,
      choiceCounts: row.choice_counts,
    },
    players: (playersResult.data ?? []).map(
      (player): LivePlayer => ({ playerId: player.player_id, nickname: player.nickname, score: player.score, correctCount: player.correct_count, lastPoints: player.last_points }),
    ),
    isHost: row.host_id === viewer,
    myPlayerId: (mine.data as string | null) ?? null,
    myChoice,
    clockOffsetMs: offset,
  };
}

export async function liveNext(gameId: string): Promise<string> {
  const { data, error } = await supabase.rpc("live_next", { game: gameId });
  if (error) failLive(error);
  return data as string;
}

export async function liveReveal(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("live_reveal", { game: gameId });
  if (error) failLive(error);
}

export async function liveFinish(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("live_finish", { game: gameId });
  if (error) failLive(error);
}

export async function answerLive(gameId: string, choice: number): Promise<LiveAnswerResult> {
  const { data, error } = await supabase.rpc("live_answer", { game: gameId, choice });
  if (error) failLive(error);
  return data as LiveAnswerResult;
}

/**
 * Calls onChange whenever the game changes (Realtime; members only, by row
 * level security). Joins and scores also touch the state row, so the player
 * table itself is not streamed (it holds account ids).
 */
export function subscribeLiveGame(gameId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`live-${gameId}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "live_game_state", filter: `game_id=eq.${gameId}` }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---- Knowledge graph (Learning OS) ----

export async function getConceptLinks(): Promise<ConceptLink[]> {
  const rows = unwrap(
    await supabase
      .from("concept_links")
      .select("id, from_topic, to_topic, kind, verification, source")
      .limit(2000)
      .returns<{ id: string; from_topic: string; to_topic: string; kind: ConceptLink["kind"]; verification: ConceptLink["verification"]; source: string }[]>(),
  );
  return rows.map((row) => ({ id: row.id, fromTopic: row.from_topic, toTopic: row.to_topic, kind: row.kind, verification: row.verification, source: row.source }));
}

interface ResourceTopicRow {
  id: string;
  resource_type: ResourceTopic["resourceType"];
  resource_id: string;
  topic_id: string;
  title: string;
  created_at: string;
}

const toResourceTopic = (row: ResourceTopicRow): ResourceTopic => ({
  id: row.id,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  topicId: row.topic_id,
  title: row.title,
  createdAt: row.created_at,
});

export async function getResourceTopics(filter: { resourceType?: ResourceTopic["resourceType"]; resourceId?: string; topicId?: string } = {}): Promise<ResourceTopic[]> {
  let builder = supabase.from("resource_topics").select("id, resource_type, resource_id, topic_id, title, created_at").order("created_at").limit(1000);
  if (filter.resourceType) builder = builder.eq("resource_type", filter.resourceType);
  if (filter.resourceId) builder = builder.eq("resource_id", filter.resourceId);
  if (filter.topicId) builder = builder.eq("topic_id", filter.topicId);
  return unwrap(await builder.returns<ResourceTopicRow[]>()).map(toResourceTopic);
}

export async function linkResourceTopic(input: ResourceTopicInput): Promise<ResourceTopic> {
  await requireViewer();
  const { data, error } = await supabase
    .from("resource_topics")
    .insert({ resource_type: input.resourceType, resource_id: input.resourceId, topic_id: input.topicId, title: input.title.slice(0, 200) })
    .select("id, resource_type, resource_id, topic_id, title, created_at")
    .single<ResourceTopicRow>();
  if (error) throw new ApiError(error.code === "42501" ? "FORBIDDEN" : "UNKNOWN", error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400, error.code === "23505" ? "already linked" : error.message);
  return toResourceTopic(data);
}

export async function unlinkResourceTopic(id: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.from("resource_topics").delete().eq("id", id);
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
}

// ---- Learning activity (Learning OS 1.3) ----

export async function getLearningEvents(limit = 50): Promise<LearningEvent[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const rows = unwrap(
    await supabase
      .from("learning_events")
      .select("id, event_type, resource_type, resource_id, topic_id, chapter_id, data, created_at")
      .eq("user_id", viewer)
      .order("created_at", { ascending: false })
      .limit(Math.min(1000, limit))
      .returns<{ id: number; event_type: LearningEvent["eventType"]; resource_type: LearningEvent["resourceType"]; resource_id: string | null; topic_id: string | null; chapter_id: string | null; data: Record<string, unknown>; created_at: string }[]>(),
  );
  return rows.map((row) => ({
    id: String(row.id),
    eventType: row.event_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    topicId: row.topic_id,
    chapterId: row.chapter_id,
    data: row.data,
    createdAt: row.created_at,
  }));
}

/** Deletes some (by id) or all of the student's learning events; estimates are worked out again (Learning OS 7.3). */
export async function deleteLearningEvents(ids?: string[]): Promise<number> {
  await requireViewer();
  const { data, error } = await supabase.rpc("delete_my_learning_events", ids ? { ids } : {});
  if (error) throw new ApiError(error.code === "42501" ? "FORBIDDEN" : "UNKNOWN", error.code === "42501" ? 403 : 400, error.message);
  return data as number;
}

// ---- Learning profile (Learning OS 1.4) ----

interface LearningProfileRow {
  track_id: string | null;
  subject_ids: string[];
  target_grade: string | null;
  exam_date: string | null;
  preferred_language: "km" | "en";
  session_minutes: number;
  days_per_week: number | null;
  updated_at: string;
}

const LEARNING_PROFILE_COLUMNS = "track_id, subject_ids, target_grade, exam_date, preferred_language, session_minutes, days_per_week, updated_at";
const toLearningProfile = (row: LearningProfileRow): LearningProfile => ({
  trackId: row.track_id,
  subjectIds: row.subject_ids ?? [],
  targetGrade: row.target_grade,
  examDate: row.exam_date,
  preferredLanguage: row.preferred_language,
  sessionMinutes: row.session_minutes,
  daysPerWeek: row.days_per_week,
  updatedAt: row.updated_at,
});

export async function getLearningProfile(): Promise<LearningProfile> {
  const viewer = await requireViewer();
  const { data, error } = await supabase.from("learning_profiles").select(LEARNING_PROFILE_COLUMNS).eq("user_id", viewer).maybeSingle<LearningProfileRow>();
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  if (data) return toLearningProfile(data);
  const [plan, subjects] = await Promise.all([getStudyPlan().catch(() => null), getCurriculumSubjects().catch(() => [])]);
  return suggestedProfile(plan, subjects);
}

export async function saveLearningProfile(input: LearningProfileInput): Promise<LearningProfile> {
  const viewer = await requireViewer();
  const { data, error } = await supabase
    .from("learning_profiles")
    .upsert({
      user_id: viewer,
      track_id: input.trackId,
      subject_ids: input.subjectIds,
      target_grade: input.targetGrade,
      exam_date: input.examDate,
      preferred_language: input.preferredLanguage,
      session_minutes: input.sessionMinutes,
      days_per_week: input.daysPerWeek,
    })
    .select(LEARNING_PROFILE_COLUMNS)
    .single<LearningProfileRow>();
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  return toLearningProfile(data);
}

/** The student's answers per topic: only the first attempt at a question per day counts. */
export async function getTopicResults(): Promise<TopicResult[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const { data, error } = await supabase.rpc("my_topic_results");
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  return ((data ?? []) as { topic_id: string; answered: number; correct: number; last_at: string | null }[]).map((row) => ({
    topicId: row.topic_id,
    answered: row.answered,
    correct: row.correct,
    lastAt: row.last_at,
  }));
}

/** The student's stored estimates (Learning OS 3.3); confidence and labels are worked out for today. */
export async function getTopicMastery(): Promise<TopicMastery[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  const { data, error } = await supabase.from("topic_mastery").select("topic_id, score, evidence, correct, last_at, version").eq("user_id", viewer).order("topic_id");
  if (error) throw new ApiError("UNKNOWN", 400, error.message);
  const rules = masteryRules as MasteryRules;
  return ((data ?? []) as { topic_id: string; score: number; evidence: number; correct: number; last_at: string; version: number }[]).map((row) => ({
    ...describeMastery(row.topic_id, { score: Number(row.score), evidence: row.evidence, correct: row.correct, lastAt: row.last_at }, rules),
    version: row.version,
  }));
}

// ---- Topic links, admin (Learning OS 2.4) ----

type ConceptLinkRow = { id: string; from_topic: string; to_topic: string; kind: ConceptLink["kind"]; verification: ConceptLink["verification"]; source: string };
const toConceptLink = (row: ConceptLinkRow): ConceptLink => ({
  id: row.id,
  fromTopic: row.from_topic,
  toTopic: row.to_topic,
  kind: row.kind,
  verification: row.verification,
  source: row.source,
});
const failLink = (error: { message: string; code?: string }): never => {
  throw new ApiError(error.code === "42501" ? "FORBIDDEN" : "UNKNOWN", error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400, error.code === "23505" ? "that link already exists" : error.message);
};

export async function saveConceptLink(input: ConceptLinkInput): Promise<ConceptLink> {
  await requireViewer();
  // The database keeps one row per related pair, in alphabetical order.
  const ordered = input.kind === "related" && input.toTopic < input.fromTopic ? { ...input, fromTopic: input.toTopic, toTopic: input.fromTopic } : input;
  const { data, error } = await supabase
    .from("concept_links")
    .insert({ from_topic: ordered.fromTopic, to_topic: ordered.toTopic, kind: ordered.kind })
    .select("id, from_topic, to_topic, kind, verification, source")
    .single<ConceptLinkRow>();
  if (error) failLink(error);
  return toConceptLink(data!);
}

export async function updateConceptLink(id: string, changes: Pick<ConceptLink, "verification" | "source">): Promise<ConceptLink> {
  await requireViewer();
  const { data, error } = await supabase
    .from("concept_links")
    .update({ verification: changes.verification, source: changes.source.trim() })
    .eq("id", id)
    .select("id, from_topic, to_topic, kind, verification, source")
    .single<ConceptLinkRow>();
  if (error) failLink(error);
  return toConceptLink(data!);
}

export async function deleteConceptLink(id: string): Promise<void> {
  await requireViewer();
  const { error } = await supabase.from("concept_links").delete().eq("id", id);
  if (error) failLink(error);
}
