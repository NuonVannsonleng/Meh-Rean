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

/**
 * A main subject ("medicine") or a specific one filed under it ("anatomy");
 * see MORE_SUBJECTS in src/lib/subjects.ts.
 */
export type SubjectId = string;

export interface Post {
  id: string;
  authorId: string;
  title: string;
  body: string;
  subject: SubjectId;
  level: EducationLevel;
  /** The school or university the note is from; null for self-study. */
  school: string | null;
  schoolDomain: string | null;
  tags: string[];
  attachments: Attachment[];
  createdAt: string;
  /** When the author last changed it; null (or absent in old data) if never. */
  editedAt?: string | null;
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

// ---- BacII curriculum ----

/** How far a curriculum entry (or question) has been checked. */
export type Verification = "verified" | "provisional" | "needs-review";

export const VERIFICATIONS: readonly Verification[] = ["verified", "provisional", "needs-review"];

/** A subject as taught in one track, e.g. Grade 12 Science-track Mathematics. */
export interface CurriculumSubject {
  id: string;
  trackId: string;
  trackKey: string;
  trackNameEn: string;
  trackNameKm: string;
  grade: number;
  /** The app-wide subject this belongs to (src/lib/subjects.ts). */
  subjectKey: SubjectId;
  nameEn: string;
  nameKm: string;
  sort: number;
}

export interface CurriculumTopic {
  id: string;
  chapterId: string;
  nameEn: string;
  nameKm: string;
  sort: number;
  verification: Verification;
}

export interface CurriculumChapter {
  id: string;
  subjectId: string;
  number: number;
  nameEn: string;
  nameKm: string;
  verification: Verification;
  /** Where the entry comes from; required before it can be verified. */
  source: string;
  topics: CurriculumTopic[];
}

// ---- BacII questions ----

/** multiple-choice and numeric are marked automatically; the others are not. */
export type QuestionType = "multiple-choice" | "numeric" | "short-answer" | "open";
export const QUESTION_TYPES: readonly QuestionType[] = ["multiple-choice", "numeric", "short-answer", "open"];

/** Where a question comes from. Only official-past-paper claims to be from an exam. */
export type QuestionOrigin = "official-past-paper" | "textbook" | "teacher" | "community" | "ai-generated" | "demo";
export const QUESTION_ORIGINS: readonly QuestionOrigin[] = ["official-past-paper", "textbook", "teacher", "community", "ai-generated", "demo"];

/** Where a solution comes from; separate from the question's origin. */
export type SolutionOrigin = "official" | "textbook" | "teacher" | "community" | "ai-generated" | "demo";
export const SOLUTION_ORIGINS: readonly SolutionOrigin[] = ["official", "textbook", "teacher", "community", "ai-generated", "demo"];

export type ContentLanguage = "km" | "en" | "fr";

export interface QuestionChoice {
  /** Short id, e.g. "a". */
  id: string;
  /** Text with inline LaTeX. */
  content: string;
}

export interface QuestionImage {
  path: string;
  url: string;
  alt: string;
}

export interface SolutionStep {
  content: string;
}

export interface QuestionSolution {
  questionId: string;
  answer: string;
  /** Multiple choice: the right choice id. */
  correctChoice: string | null;
  /** Numeric: the answer and how far off still counts as right. */
  numericAnswer: number | null;
  numericTolerance: number | null;
  steps: SolutionStep[];
  origin: SolutionOrigin;
  source: string;
  verification: Verification;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface Question {
  id: string;
  /** Curriculum ids; the subject always matches the chapter (enforced in the database). */
  subjectId: string;
  chapterId: string;
  topicId: string | null;
  /** Exam year, for past-paper questions. */
  year: number | null;
  type: QuestionType;
  /** Khmer or English with inline LaTeX ($…$, $$…$$). */
  content: string;
  choices: QuestionChoice[];
  images: QuestionImage[];
  difficulty: number | null;
  language: ContentLanguage;
  origin: QuestionOrigin;
  source: string;
  verification: Verification;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** null when no solution has been written yet, or when it is kept back. */
  solution: QuestionSolution | null;
}

/** What the admin form sends to save a question with its solution. */
export interface QuestionInput {
  chapterId: string;
  topicId: string | null;
  year: number | null;
  type: QuestionType;
  content: string;
  choices: QuestionChoice[];
  images: QuestionImage[];
  difficulty: number | null;
  language: ContentLanguage;
  origin: QuestionOrigin;
  source: string;
  verification: Verification;
  solution: {
    answer: string;
    correctChoice: string | null;
    numericAnswer: number | null;
    numericTolerance: number | null;
    steps: SolutionStep[];
    origin: SolutionOrigin;
    source: string;
    verification: Verification;
  };
}

export interface QuestionFilter {
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
}

// ---- BacII exam papers ----

/** official: a real past paper (with a source); demo: practice content written for Meh Rean. */
export type PaperOrigin = "official" | "demo";

export interface ExamPaper {
  id: string;
  subjectId: string;
  year: number;
  titleEn: string;
  titleKm: string;
  /** Only an exam rule when durationSource says where it comes from. */
  durationMinutes: number | null;
  durationSource: string;
  origin: PaperOrigin;
  source: string;
  verification: Verification;
  questionCount: number;
  totalPoints: number | null;
}

export interface ExamPaperQuestion {
  position: number;
  points: number | null;
  question: Question;
}

export interface ExamPaperDetail extends ExamPaper {
  questions: ExamPaperQuestion[];
}

export interface PaperFilter {
  subjectId?: string;
  trackKey?: string;
  year?: number;
}

// ---- BacII mock exams ----

export type AttemptStatus = "in-progress" | "submitted" | "timed-out";

export interface ExamAttempt {
  id: string;
  paperId: string;
  /** official: the paper's sourced duration; practice: chosen by the student. */
  timing: "official" | "practice";
  durationMinutes: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  status: AttemptStatus;
  /** Points from automatically marked questions; null until marked. */
  score: number | null;
  maxScore: number | null;
  /** Questions a person has to mark (worked problems, short answers). */
  unmarked: number | null;
}

export interface ExamAnswer {
  questionId: string;
  answer: string;
  /** null while running, and for questions that are not marked automatically. */
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  updatedAt: string;
}

export interface ExamAttemptDetail {
  attempt: ExamAttempt;
  answers: ExamAnswer[];
}

/** A started (or resumed) attempt, with how far this device's clock is off the server's. */
export interface ExamStart {
  attemptId: string;
  deadlineAt: string;
  clockOffsetMs: number;
}

/** A question the student got wrong, kept until they get it right (roadmap 3.1). */
export interface Mistake {
  questionId: string;
  /** What they answered last time ("" when left blank in a mock exam). */
  lastAnswer: string;
  source: "practice" | "exam";
  attemptId: string | null;
  timesWrong: number;
  firstWrongAt: string;
  lastWrongAt: string;
  /** When they answered it right; null while it still needs fixing. */
  fixedAt: string | null;
  /** Spaced-repetition reviews passed, 0–4 (roadmap 3.2). */
  reviewStage: number;
  /** When the next review is due; null once all reviews are done. */
  nextReviewAt: string | null;
  question: Question;
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
  subject: SubjectId;
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
  subject: SubjectId;
  level: EducationLevel;
  school: string | null;
  schoolDomain: string | null;
  tags: string[];
  files: File[];
}

/** An edit to a note: the same fields, plus which of its files to keep. */
export interface UpdatePostInput extends NewPostInput {
  /** Ids of the note's current attachments to keep; the rest are deleted. */
  keepAttachmentIds: string[];
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
  | "STORAGE_FULL"
  | "UNSUPPORTED_FILE";

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
