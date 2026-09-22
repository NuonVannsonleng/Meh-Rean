import type {
  Attachment,
  Comment,
  EducationLevel,
  Post,
  PublicUser,
  ReactionType,
  Subject,
} from "../types";

/**
 * Seed content loaded into the in-browser database on first visit. The
 * service layer is the only module that reads from this file.
 */

export const DEMO_ACCOUNT = {
  email: "demo@mehrean.app",
  password: "demo1234",
} as const;

export const DEMO_USER_ID = "u-demo";

const SAMPLE_PDF_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const SAMPLE_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

// ---- Generated study images (inline SVG so seeds work offline) ----

interface NoteImageOptions {
  heading: string;
  lines: string[];
  paper: string;
  ink: string;
  accent: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function noteImage({ heading, lines, paper, ink, accent }: NoteImageOptions): string {
  const ruled = Array.from(
    { length: 11 },
    (_, index) =>
      `<line x1="0" x2="1200" y1="${190 + index * 62}" y2="${190 + index * 62}" stroke="${accent}" stroke-opacity=".18" stroke-width="2"/>`,
  ).join("");
  const text = lines
    .map(
      (line, index) =>
        `<text x="130" y="${240 + index * 62}" font-size="38" fill="${ink}" font-family="'Segoe Print','Bradley Hand','Comic Sans MS',cursive">${escapeXml(line)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="${paper}"/>${ruled}<line x1="100" x2="100" y1="0" y2="900" stroke="#e11d48" stroke-opacity=".35" stroke-width="3"/><text x="130" y="120" font-size="54" font-weight="700" fill="${accent}" font-family="'Segoe Print','Bradley Hand','Comic Sans MS',cursive">${escapeXml(heading)}</text>${text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function image(id: string, name: string, options: NoteImageOptions): Attachment {
  const url = noteImage(options);
  return { id, name, mimeType: "image/svg+xml", size: url.length, kind: "image", url };
}

function pdf(id: string, name: string, size: number): Attachment {
  return { id, name, mimeType: "application/pdf", size, kind: "pdf", url: SAMPLE_PDF_URL };
}

function video(id: string, name: string, size: number): Attachment {
  return { id, name, mimeType: "video/mp4", size, kind: "video", url: SAMPLE_VIDEO_URL };
}

// ---- Users ----

type UserSeed = [
  id: string,
  username: string,
  displayName: string,
  school: string,
  country: string,
  fieldOfStudy: string,
  bio: string,
  createdAt: string,
];

const userSeed: UserSeed[] = [
  [DEMO_USER_ID, "alex", "Alex Rivera", "University of Toronto", "Canada", "Computer Science", "Second-year CS student. I share my notes so future me (and you) can find them.", "2026-06-02T10:00:00Z"],
  ["u1", "vannak", "Chea Vannak", "Institute of Technology of Cambodia", "Cambodia", "IT Engineering", "Databases, networks and too much coffee. Phnom Penh 🇰🇭", "2026-03-11T08:30:00Z"],
  ["u2", "amara", "Amara Okafor", "University of Lagos", "Nigeria", "Medicine", "MBBS year 3. Anatomy diagrams are my love language.", "2026-02-19T14:12:00Z"],
  ["u3", "lukas.s", "Lukas Schneider", "Technical University of Munich", "Germany", "Mechanical Engineering", "Thermodynamics tutor. Happy to answer questions in the comments.", "2026-01-07T09:45:00Z"],
  ["u4", "priya", "Priya Nair", "IIT Bombay", "India", "Computer Science", "Algorithms, competitive programming and clean notes.", "2026-04-23T05:20:00Z"],
  ["u5", "sofiam", "Sofía Martínez", "Universidad de Buenos Aires", "Argentina", "Economics", "Macro, micro and mate. Notes in English and Spanish.", "2026-05-15T18:05:00Z"],
  ["u6", "yuki", "Yuki Tanaka", "Shibuya Senior High School", "Japan", "Physics", "High school senior preparing for university entrance exams.", "2026-07-01T00:40:00Z"],
  ["u7", "emmaw", "Emma Wilson", "University of Melbourne", "Australia", "Law", "Law student. Case briefs and exam outlines.", "2026-03-28T22:10:00Z"],
  ["u8", "minh", "Trần Minh", "Hanoi University of Science and Technology", "Vietnam", "Mathematics", "Linear algebra enjoyer. Handwritten notes, always.", "2026-02-02T03:00:00Z"],
];

export const seedUsers: PublicUser[] = userSeed.map(
  ([id, username, displayName, school, country, fieldOfStudy, bio, createdAt]) => ({
    id,
    username,
    displayName,
    school,
    country,
    fieldOfStudy,
    bio,
    avatarUrl: null,
    createdAt,
  }),
);

export const seedEmails: Record<string, string> = Object.fromEntries(
  seedUsers.map((user) =>
    user.id === DEMO_USER_ID
      ? [user.id, DEMO_ACCOUNT.email]
      : [user.id, `${user.username.replace(/\W/g, "")}@example.com`],
  ),
);

// ---- Posts ----

interface PostSeed {
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

const postSeed: PostSeed[] = [
  {
    id: "p1",
    authorId: "u1",
    title: "Database Normalization — 1NF to BCNF cheat sheet",
    body: "Made this after failing to understand functional dependencies for two weeks. It walks through one messy table and normalizes it step by step, with the anomalies each step removes.\n\nSlides + my handwritten summary page.",
    subject: "computer-science",
    level: "university",
    tags: ["databases", "sql", "normalization"],
    attachments: [
      image("a1", "normalization-summary.svg", {
        heading: "Normalization — quick guide",
        lines: ["1NF: atomic values, no repeating groups", "2NF: 1NF + no partial dependency", "3NF: 2NF + no transitive dependency", "BCNF: every determinant is a key", "", "Tip: draw the FDs first!"],
        paper: "#faf3e4",
        ink: "#1e293b",
        accent: "#5b7c42",
      }),
      pdf("a2", "Normalization-Slides.pdf", 2_480_000),
    ],
    createdAt: "2026-09-21T15:24:00Z",
  },
  {
    id: "p2",
    authorId: "u2",
    title: "Brachial plexus — the only diagram you need",
    body: "Randy Travis Drinks Cold Beer: Roots, Trunks, Divisions, Cords, Branches. I redrew the plexus with colour coding for each cord and the five terminal branches. Good luck with your anatomy practical!",
    subject: "medicine",
    level: "university",
    tags: ["anatomy", "mnemonics"],
    attachments: [
      image("a3", "brachial-plexus.svg", {
        heading: "Brachial plexus (C5–T1)",
        lines: ["Roots → Trunks → Divisions → Cords → Branches", "Lateral cord: musculocutaneous", "Posterior cord: axillary, radial", "Medial cord: ulnar", "Lat + Med: median nerve", "Mnemonic: Randy Travis Drinks Cold Beer"],
        paper: "#fdf2f8",
        ink: "#3f1d2e",
        accent: "#be185d",
      }),
    ],
    createdAt: "2026-09-21T09:02:00Z",
  },
  {
    id: "p3",
    authorId: "u3",
    title: "Thermodynamics I — full lecture notes (Chapters 1–6)",
    body: "Complete notes for Thermo I: properties of pure substances, first law for closed and open systems, entropy and the second law. Worked examples are at the end of every chapter.",
    subject: "engineering",
    level: "university",
    tags: ["thermodynamics", "lecture-notes"],
    attachments: [pdf("a4", "Thermo-I-Lecture-Notes.pdf", 8_900_000)],
    createdAt: "2026-09-20T18:40:00Z",
  },
  {
    id: "p4",
    authorId: "u4",
    title: "Dynamic programming in 12 minutes (video walkthrough)",
    body: "Recorded a short walkthrough of how I approach DP problems: define the state, write the recurrence, then decide top-down vs bottom-up. Examples: coin change and longest common subsequence.",
    subject: "computer-science",
    level: "university",
    tags: ["algorithms", "dynamic-programming", "video"],
    attachments: [video("a5", "dp-walkthrough.mp4", 21_400_000)],
    createdAt: "2026-09-20T07:15:00Z",
  },
  {
    id: "p5",
    authorId: "u6",
    title: "Kinematics formulas — exam night summary",
    body: "Everything for the SUVAT section on one page. Our teacher said 80% of the mechanics questions use just these four equations.",
    subject: "physics",
    level: "high-school",
    tags: ["mechanics", "formulas", "exam-prep"],
    attachments: [
      image("a6", "suvat.svg", {
        heading: "SUVAT equations",
        lines: ["v = u + at", "s = ut + ½at²", "v² = u² + 2as", "s = ½(u + v)t", "", "Always list: s, u, v, a, t first"],
        paper: "#f1f7f7",
        ink: "#123038",
        accent: "#2f6f7e",
      }),
    ],
    createdAt: "2026-09-19T12:30:00Z",
  },
  {
    id: "p6",
    authorId: "u5",
    title: "IS-LM model explained with examples",
    body: "My summary of the IS-LM model for Macro II: how fiscal and monetary policy shift each curve, plus three past exam questions with worked answers. Slides are in English, notes partly in Spanish.",
    subject: "economics",
    level: "university",
    tags: ["macroeconomics", "is-lm"],
    attachments: [
      pdf("a7", "IS-LM-Slides.pdf", 3_150_000),
      pdf("a8", "Macro-II-Past-Questions-2025.pdf", 1_220_000),
    ],
    createdAt: "2026-09-18T21:10:00Z",
  },
  {
    id: "p7",
    authorId: "u8",
    title: "Eigenvalues & eigenvectors — handwritten notes",
    body: "Part 3 of my linear algebra series. Characteristic polynomial, diagonalization and a few tricks for 3×3 matrices.",
    subject: "mathematics",
    level: "university",
    tags: ["linear-algebra", "handwritten"],
    attachments: [
      image("a9", "eigen-1.svg", {
        heading: "Eigenvalues",
        lines: ["Av = λv  (v ≠ 0)", "det(A − λI) = 0", "trace(A) = Σ λᵢ", "det(A) = Π λᵢ"],
        paper: "#fefce8",
        ink: "#292524",
        accent: "#a16207",
      }),
      image("a10", "eigen-2.svg", {
        heading: "Diagonalization",
        lines: ["A = PDP⁻¹", "P = [v₁ v₂ … vₙ]", "D = diag(λ₁ … λₙ)", "Needs n independent eigenvectors", "Aᵏ = PDᵏP⁻¹"],
        paper: "#fefce8",
        ink: "#292524",
        accent: "#a16207",
      }),
      image("a11", "eigen-3.svg", {
        heading: "3×3 tricks",
        lines: ["Triangular → λ = diagonal entries", "Symmetric → real λ, orthogonal v", "Check: sum of λ = trace"],
        paper: "#fefce8",
        ink: "#292524",
        accent: "#a16207",
      }),
    ],
    createdAt: "2026-09-17T04:45:00Z",
  },
  {
    id: "p8",
    authorId: "u7",
    title: "Contract law exam outline — formation & consideration",
    body: "My outline for the formation half of Contracts: offer, acceptance, intention, consideration and promissory estoppel, with the leading cases for each. Australian law, but the structure works for most common-law courses.",
    subject: "law",
    level: "university",
    tags: ["contracts", "exam-outline"],
    attachments: [pdf("a12", "Contracts-Formation-Outline.pdf", 640_000)],
    createdAt: "2026-09-16T10:05:00Z",
  },
  {
    id: "p9",
    authorId: "u1",
    title: "Computer Networks midterm 2025 (with my answers)",
    body: "Past midterm paper from last year. I added my answers, but please double-check question 4 on subnetting — I'm not 100% sure.",
    subject: "computer-science",
    level: "university",
    tags: ["networks", "past-paper", "subnetting"],
    attachments: [pdf("a13", "Networks-Midterm-2025.pdf", 1_050_000)],
    createdAt: "2026-09-14T13:50:00Z",
  },
  {
    id: "p10",
    authorId: "u2",
    title: "How I study with active recall (no fancy apps)",
    body: "A few people asked how I got through first-year physiology. Short version: close the book, write everything you remember, then check. Repeat after 1, 3 and 7 days. That's it.",
    subject: "other",
    level: "self-study",
    tags: ["study-tips", "active-recall"],
    attachments: [],
    createdAt: "2026-09-12T16:35:00Z",
  },
  {
    id: "p11",
    authorId: "u4",
    title: "Graph algorithms — BFS, DFS, Dijkstra slides",
    body: "Slides from the study group I run on Saturdays. Includes pseudocode and complexity for each algorithm.",
    subject: "computer-science",
    level: "university",
    tags: ["algorithms", "graphs"],
    attachments: [pdf("a14", "Graph-Algorithms.pdf", 4_200_000)],
    createdAt: "2026-09-10T08:00:00Z",
  },
  {
    id: "p12",
    authorId: "u6",
    title: "Organic chemistry functional groups (flashcard photos)",
    body: "Photos of my flashcards for the functional groups unit. Name on one side, structure on the other.",
    subject: "chemistry",
    level: "high-school",
    tags: ["organic-chemistry", "flashcards"],
    attachments: [
      image("a15", "functional-groups.svg", {
        heading: "Functional groups",
        lines: ["Alcohol: –OH", "Aldehyde: –CHO", "Ketone: C=O (middle)", "Carboxylic acid: –COOH", "Ester: –COO–", "Amine: –NH₂"],
        paper: "#f0fdf4",
        ink: "#14301f",
        accent: "#15803d",
      }),
    ],
    createdAt: "2026-09-08T11:25:00Z",
  },
];

export const seedPosts: Post[] = postSeed;

// ---- Social activity ----

type CommentSeed = [id: string, postId: string, authorId: string, body: string, createdAt: string];

const commentSeed: CommentSeed[] = [
  ["c1", "p1", "u4", "The BCNF example finally made it click for me. Thank you!", "2026-09-21T16:02:00Z"],
  ["c2", "p1", "u8", "Could you also do 4NF with multivalued dependencies?", "2026-09-21T17:40:00Z"],
  ["c3", "p1", "u1", "@minh yes, working on it for next week 👍", "2026-09-21T18:05:00Z"],
  ["c4", "p2", "u7", "Randy Travis Drinks Cold Beer — I will never forget this now 😂", "2026-09-21T10:15:00Z"],
  ["c5", "p2", DEMO_USER_ID, "The colour coding is so clear.", "2026-09-21T11:48:00Z"],
  ["c6", "p3", "u5", "Chapter 5 worked examples saved my weekend.", "2026-09-20T20:10:00Z"],
  ["c7", "p4", "u1", "Clearest explanation of LCS I've seen.", "2026-09-20T09:30:00Z"],
  ["c8", "p4", "u6", "Is there a part 2 with knapsack?", "2026-09-20T11:02:00Z"],
  ["c9", "p4", "u4", "@yuki yes! Recording it this weekend.", "2026-09-20T12:20:00Z"],
  ["c10", "p5", "u3", "Nice. Add projectile motion next — it's just SUVAT in two directions.", "2026-09-19T14:00:00Z"],
  ["c11", "p6", "u7", "Gracias! The past questions are gold.", "2026-09-19T08:45:00Z"],
  ["c12", "p7", "u4", "Your handwriting is unreal.", "2026-09-17T06:10:00Z"],
  ["c13", "p7", DEMO_USER_ID, "The trace check trick is so useful for exams.", "2026-09-17T09:33:00Z"],
  ["c14", "p9", "u8", "Q4: I think the broadcast address should be .63, not .64.", "2026-09-14T15:12:00Z"],
  ["c15", "p9", "u1", "@minh you're right, fixed in my copy. Thanks!", "2026-09-14T16:01:00Z"],
  ["c16", "p10", "u5", "Simple and it actually works. Trying the 1-3-7 schedule this semester.", "2026-09-12T19:20:00Z"],
  ["c17", "p10", "u6", "Does this work for formulas too?", "2026-09-13T01:05:00Z"],
  ["c18", "p10", "u2", "@yuki definitely — write them out from memory, then derive one.", "2026-09-13T07:44:00Z"],
  ["c19", "p12", "u2", "Great for revision, thanks!", "2026-09-08T15:30:00Z"],
];

export const seedComments: Comment[] = commentSeed.map(
  ([id, postId, authorId, body, createdAt]) => ({ id, postId, authorId, body, createdAt }),
);

/** postId → [userId, reaction][] */
export const seedReactions: Record<string, [string, ReactionType][]> = {
  p1: [["u2", "insightful"], ["u3", "like"], ["u4", "love"], ["u5", "like"], ["u8", "insightful"], [DEMO_USER_ID, "thanks"]],
  p2: [["u1", "wow"], ["u5", "love"], ["u7", "love"], [DEMO_USER_ID, "love"], ["u6", "insightful"]],
  p3: [["u5", "thanks"], ["u8", "like"], ["u1", "like"]],
  p4: [["u1", "insightful"], ["u2", "like"], ["u3", "like"], ["u6", "love"], ["u8", "wow"], ["u7", "like"], [DEMO_USER_ID, "insightful"]],
  p5: [["u3", "like"], ["u8", "like"]],
  p6: [["u7", "thanks"], ["u4", "insightful"], ["u1", "like"]],
  p7: [["u4", "wow"], ["u2", "love"], ["u3", "insightful"], [DEMO_USER_ID, "like"]],
  p8: [["u5", "like"], ["u2", "thanks"]],
  p9: [["u8", "like"], ["u4", "thanks"], [DEMO_USER_ID, "thanks"]],
  p10: [["u5", "love"], ["u6", "insightful"], ["u1", "like"], ["u3", "like"], ["u7", "love"], ["u8", "like"]],
  p11: [["u1", "like"], ["u8", "insightful"]],
  p12: [["u2", "like"]],
};

/** postId → [userId, stars][] */
export const seedRatings: Record<string, [string, number][]> = {
  p1: [["u2", 5], ["u4", 5], ["u8", 4], [DEMO_USER_ID, 5]],
  p2: [["u7", 5], ["u5", 5], [DEMO_USER_ID, 4]],
  p3: [["u5", 5], ["u8", 4], ["u1", 4]],
  p4: [["u1", 5], ["u2", 4], ["u6", 5], ["u3", 4]],
  p5: [["u3", 4]],
  p6: [["u7", 5], ["u4", 4]],
  p7: [["u4", 5], ["u2", 5], ["u3", 4]],
  p8: [["u5", 4]],
  p9: [["u8", 3], ["u4", 4]],
  p10: [["u5", 5], ["u6", 4], ["u3", 4]],
  p11: [["u1", 4]],
};

/** userId → saved postIds */
export const seedSaves: Record<string, string[]> = {
  [DEMO_USER_ID]: ["p3", "p7"],
};
