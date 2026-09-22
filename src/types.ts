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
  country: string;
  fieldOfStudy: string;
  avatarUrl: string | null;
  createdAt: string;
}

/** The signed-in user's own account, including private fields. */
export interface User extends PublicUser {
  email: string;
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
  };
}

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
  country: string;
  fieldOfStudy: string;
  avatarUrl: string | null;
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
