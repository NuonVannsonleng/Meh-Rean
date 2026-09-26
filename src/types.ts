export type ThemePreference = "light" | "dark" | "system";

export type ReactionType = "like" | "love" | "insightful" | "thanks" | "wow";

export const REACTION_TYPES: readonly ReactionType[] = [
  "like",
  "love",
  "insightful",
  "thanks",
  "wow",
];

export type Subject =
  | "mathematics"
  | "computer-science"
  | "engineering"
  | "physics"
  | "chemistry"
  | "biology"
  | "medicine"
  | "business"
  | "economics"
  | "languages"
  | "literature"
  | "history"
  | "arts"
  | "law"
  | "other";

export const SUBJECTS: readonly Subject[] = [
  "mathematics",
  "computer-science",
  "engineering",
  "physics",
  "chemistry",
  "biology",
  "medicine",
  "business",
  "economics",
  "languages",
  "literature",
  "history",
  "arts",
  "law",
  "other",
];

export type EducationLevel =
  | "high-school"
  | "university"
  | "postgraduate"
  | "self-study";

export const EDUCATION_LEVELS: readonly EducationLevel[] = [
  "high-school",
  "university",
  "postgraduate",
  "self-study",
];

/** Universities come from the institution list; high schools are typed in. */
export type InstitutionKind = "high-school" | "university";

export const INSTITUTION_KINDS: readonly InstitutionKind[] = ["high-school", "university"];

export type AttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "slides"
  | "spreadsheet"
  | "archive"
  | "other";

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  /** Remote URL, or `local-file:<id>` for files kept in this browser. */
  url: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  school: string;
  /** Domain of the picked institution; null for a manually typed school. */
  schoolDomain: string | null;
  /** Country the institution is in, which can differ from `country`. */
  schoolCountry: string | null;
  /** Where the student is now, e.g. "Year 2", "Grade 11", "Alumni". */
  grade: string | null;
  /** The student's own country. */
  country: string;
  fieldOfStudy: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  /** Approved by an admin through the verification request flow. */
  verified: boolean;
  createdAt: string;
}

/** The signed-in user's own account, including private fields. */
export interface User extends PublicUser {
  email: string;
  /** Admins review verification requests. */
  isAdmin: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  title: string;
  body: string;
  subject: Subject;
  level: EducationLevel;
  tags: string[];
  attachments: Attachment[];
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface ReactionSummary {
  counts: Record<ReactionType, number>;
  total: number;
  mine: ReactionType | null;
}

export interface RatingSummary {
  average: number;
  count: number;
  mine: number | null;
}

/** A post joined with everything the feed needs to render it. */
export interface PostView extends Post {
  author: PublicUser;
  reactions: ReactionSummary;
  rating: RatingSummary;
  commentCount: number;
  saved: boolean;
}

export interface CommentView extends Comment {
  author: PublicUser;
}

export interface ProfileView {
  user: PublicUser;
  stats: {
    posts: number;
    reactions: number;
    averageRating: number | null;
    followers: number;
    following: number;
  };
  /** Whether the person viewing this profile follows it. */
  isFollowing: boolean;
}

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export interface VerificationRequest {
  id: string;
  user: PublicUser;
  reason: string;
  link: string;
  status: Exclude<VerificationStatus, "none">;
  createdAt: string;
  decidedAt: string | null;
}

export interface NewVerificationRequest {
  reason: string;
  link: string;
}

// ---- Direct messages ----

export type MessageKind = "text" | "image" | "video" | "voice" | "file" | "sticker";

/** A photo, video, voice note or file sent in a chat. */
export interface MessageAttachment {
  /** Where the file is kept: a storage path, or an IndexedDB id in browser-only mode. */
  path: string;
  /** Ready to display: a signed URL, or `local-file:<id>` in browser-only mode. */
  url: string;
  /** Like `url`, but served as a download under the original file name. */
  downloadUrl: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  /** Seconds, for voice notes and videos. */
  duration?: number;
  /** Voice notes: loudness bars from 0 to 100. */
  waveform?: number[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  /** The text, or a caption for a photo, video or file. */
  body: string;
  attachment: MessageAttachment | null;
  sticker: string | null;
  replyToId: string | null;
  /** userId → their reaction. */
  reactions: Record<string, ReactionType>;
  editedAt: string | null;
  /** Set once the sender unsends it; the content is gone by then. */
  deletedAt: string | null;
  createdAt: string;
}

/** What the composer hands to sendMessage(). */
export interface OutgoingMessage {
  kind: MessageKind;
  body?: string;
  file?: File;
  sticker?: string;
  replyToId?: string | null;
  /** Measured in the browser before sending. */
  meta?: Pick<MessageAttachment, "width" | "height" | "duration" | "waveform">;
}

/** One row of the inbox. */
export interface ConversationSummary {
  id: string;
  other: PublicUser;
  lastMessage: Pick<Message, "body" | "senderId" | "createdAt" | "kind"> & {
    attachmentName: string | null;
    deleted: boolean;
  };
  /** Messages from the other person the viewer has not opened yet. */
  unread: number;
}

/** An open thread with one person. */
export interface ThreadView {
  /** Null until the first message is sent. */
  conversationId: string | null;
  other: PublicUser;
  messages: Message[];
  /** When the other person last opened the thread, for "Seen". */
  otherReadAt: string | null;
}

/** Pushed to the UI as messages arrive, change, get reactions, or are read. */
export type ChatEvent =
  | { type: "message"; message: Message }
  | { type: "updated"; message: Message }
  | { type: "reaction"; messageId: string; userId: string; reaction: ReactionType | null }
  | { type: "read"; conversationId: string; reads: Record<string, string> };

/** Live "typing…" for one open conversation. */
export interface ConversationChannel {
  /** Tells the other person you are typing; cheap to call on every keystroke. */
  typing: () => void;
  leave: () => void;
}

/** Square for avatars, wide for profile banners. */
export type ProfileImageKind = "avatar" | "banner";

export type MediaFilter = "all" | "documents" | "images" | "videos";
export type FeedSort = "latest" | "top" | "discussed";

export interface FeedQuery {
  search?: string;
  /** Exact school or university name, matched against the author's profile. */
  school?: string;
  subject?: Subject | "all";
  level?: EducationLevel | "all";
  media?: MediaFilter;
  sort?: FeedSort;
  authorUsername?: string;
  savedOnly?: boolean;
}

export type SearchScope = "all" | "people" | "schools" | "subjects" | "tags";

export interface SchoolSummary {
  name: string;
  country: string;
  students: number;
  posts: number;
}

export interface TagSummary {
  tag: string;
  posts: number;
}

export interface SubjectSummary {
  subject: Subject;
  posts: number;
}

export interface SearchSuggestions {
  people: PublicUser[];
  schools: SchoolSummary[];
  subjects: SubjectSummary[];
  tags: TagSummary[];
}

// ---- Service inputs ----

export interface SignUpInput {
  displayName: string;
  username: string;
  email: string;
  password: string;
  school: string;
  schoolDomain: string | null;
  schoolCountry: string | null;
  grade: string;
  fieldOfStudy: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface NewPostInput {
  title: string;
  body: string;
  subject: Subject;
  level: EducationLevel;
  tags: string[];
  files: File[];
}

export interface UpdateProfileInput {
  displayName: string;
  username: string;
  email: string;
  bio: string;
  school: string;
  schoolDomain: string | null;
  schoolCountry: string | null;
  grade: string | null;
  country: string;
  fieldOfStudy: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export type ApiErrorCode =
  | "UNKNOWN"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "USERNAME_TAKEN"
  | "WRONG_PASSWORD"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "EMAIL_CONFIRMATION"
  | "EMAIL_NOT_CONFIRMED"
  | "ALREADY_REQUESTED"
  | "MESSAGE_TOO_LONG"
  | "MICROPHONE_BLOCKED"
  | "STORAGE_FULL";

/** Error surfaced by the service layer; UI maps `code` to friendly copy. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, status = 500, message: string = code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
