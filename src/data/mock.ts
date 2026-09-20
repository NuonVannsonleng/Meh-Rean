import type { Course, Institution, Resource, ResourceType } from "../types";

/**
 * Placeholder file used by every mock resource. Nothing is really stored yet —
 * downloads open this sample document so the UI can be exercised end to end.
 */
export const PLACEHOLDER_FILE_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

export const institutions: Institution[] = [
  {
    id: "s1",
    name: "Preah Sisowath High School",
    shortName: "PSHS",
    city: "Phnom Penh",
    kind: "school",
  },
  {
    id: "s2",
    name: "Bak Touk High School",
    shortName: "BTHS",
    city: "Phnom Penh",
    kind: "school",
  },
  {
    id: "s3",
    name: "Hun Sen Serei Pheap High School",
    shortName: "HSSP",
    city: "Kampong Cham",
    kind: "school",
  },
  {
    id: "u1",
    name: "Institute of Technology of Cambodia",
    shortName: "ITC",
    city: "Phnom Penh",
    kind: "university",
  },
  {
    id: "u2",
    name: "Royal University of Phnom Penh",
    shortName: "RUPP",
    city: "Phnom Penh",
    kind: "university",
  },
  {
    id: "u3",
    name: "National University of Management",
    shortName: "NUM",
    city: "Phnom Penh",
    kind: "university",
  },
  {
    id: "u4",
    name: "American University of Phnom Penh",
    shortName: "AUPP",
    city: "Phnom Penh",
    kind: "university",
  },
  {
    id: "u5",
    name: "University of Battambang",
    shortName: "UBB",
    city: "Battambang",
    kind: "university",
  },
];

/** [id, institutionId, code, name, level, semester, instructor] */
type CourseSeed = [string, string, string, string, number, 1 | 2, string];

const courseSeed: CourseSeed[] = [
  // --- Secondary school, grades 7–12 ---
  ["c17", "s1", "ENG7", "English", 7, 1, "Ms. Pen Sophal"],
  ["c18", "s1", "MATH9", "Mathematics", 9, 1, "Mr. Chhun Sovannara"],
  ["c19", "s1", "KHM10", "Khmer Literature", 10, 2, "Ms. Sok Chanthou"],
  ["c20", "s1", "PHY11", "Physics", 11, 1, "Mr. Ly Vibol"],
  ["c21", "s1", "CHEM12", "Chemistry", 12, 2, "Ms. Nhem Sreymao"],
  ["c22", "s2", "HIST8", "History", 8, 2, "Mr. Voeun Sina"],
  ["c23", "s2", "BIO10", "Biology", 10, 1, "Ms. Chhim Davy"],
  ["c24", "s2", "ICT11", "Information Technology", 11, 2, "Mr. Tep Chanra"],
  ["c25", "s2", "MATH12", "Mathematics", 12, 1, "Mr. Kong Piseth"],
  ["c26", "s3", "MATH7", "Mathematics", 7, 2, "Mr. Sam Oeun"],
  ["c27", "s3", "GEO9", "Geography", 9, 2, "Ms. Mao Sreypich"],
  ["c28", "s3", "ES12", "Earth Science", 12, 1, "Ms. Chea Kanha"],

  // --- University, years 1–4 ---
  ["c1", "u1", "CS101", "Introduction to Programming", 1, 1, "Mr. Sok Piseth"],
  ["c2", "u2", "MA102", "Discrete Mathematics", 1, 2, "Dr. Chan Sophea"],
  ["c3", "u1", "DS201", "Data Structures II", 2, 1, "Mr. Kim Rithy"],
  ["c4", "u1", "DB201", "Database Systems", 2, 1, "Dr. Sok Dara"],
  ["c5", "u3", "WT202", "Web Technologies", 2, 2, "Ms. Chea Sreymom"],
  ["c6", "u1", "OS301", "Operating Systems", 3, 1, "Dr. Hun Vicheka"],
  ["c7", "u2", "NW302", "Computer Networks", 3, 1, "Mr. Lim Channarith"],
  ["c8", "u1", "AL303", "Algorithms and Complexity", 3, 2, "Dr. Chan Sophea"],
  ["c9", "u2", "SE401", "Software Engineering", 4, 1, "Mr. Nou Samnang"],
  ["c10", "u3", "UX402", "UX/UI Design", 4, 2, "Ms. Meas Bopha"],
  ["c11", "u4", "CS210", "Object-Oriented Programming", 2, 1, "Dr. Chea Vanna"],
  ["c12", "u4", "IS305", "Information Security", 3, 2, "Mr. Yim Sokhom"],
  ["c13", "u5", "IT150", "Computer Architecture", 1, 2, "Mr. Ouk Sovan"],
  ["c14", "u5", "DA401", "Data Analytics", 4, 1, "Ms. Ly Sokunthea"],
  ["c15", "u1", "AI402", "Artificial Intelligence", 4, 2, "Dr. Sok Dara"],
  ["c16", "u2", "MC201", "Mobile Computing", 2, 2, "Ms. Keo Sreyleak"],
];

export const courses: Course[] = courseSeed.map(
  ([id, institutionId, code, name, level, semester, instructor]) => ({
    id,
    institutionId,
    code,
    name,
    level,
    semester,
    instructor,
  }),
);

/** [id, courseId, title, type, uploadedBy, createdAt] */
type ResourceSeed = [string, string, string, ResourceType, string, string];

const resourceSeed: ResourceSeed[] = [
  // --- Secondary school ---
  ["r44", "c17", "Unit 1–3 Vocabulary Notes", "note", "Sophea", "2026-02-10"],
  ["r45", "c17", "Grade 7 English Semester 1 Exam 2025", "paper", "Chantrea", "2025-11-20"],
  ["r46", "c17", "Present Simple Practice Slides", "slide", "Rina", "2026-01-15"],
  ["r47", "c18", "Quadratic Equations Summary", "note", "Sovannara", "2026-03-05"],
  ["r48", "c18", "Grade 9 Mathematics Mock Exam 2026", "paper", "Dara", "2026-04-22"],
  ["r49", "c18", "Chapter 4 Exercises with Solutions", "note", "Mealea", "2026-02-27"],
  ["r50", "c19", "Tum Teav Poem Analysis Notes", "note", "Chanthou", "2026-06-18"],
  ["r51", "c19", "Khmer Literature Semester 2 Exam 2025", "paper", "Sreymom", "2025-12-12"],
  ["r52", "c20", "Newton's Laws Chapter Notes", "note", "Vibol", "2026-03-19"],
  ["r53", "c20", "Physics Lab Report Template Slides", "slide", "Pheakdey", "2026-04-08"],
  ["r54", "c20", "Grade 11 Physics Midterm 2026", "paper", "Sokleng", "2026-05-14"],
  ["r55", "c21", "Organic Chemistry Revision Notes", "note", "Sreymao", "2026-07-02"],
  ["r56", "c21", "Grade 12 Chemistry Bac II Practice 2025", "paper", "Rithya", "2025-12-28"],
  ["r57", "c21", "Periodic Table Study Slides", "slide", "Kunthea", "2026-06-25"],
  ["r58", "c22", "Angkor Period Study Notes", "note", "Sina", "2026-05-21"],
  ["r59", "c22", "Grade 8 History Semester 2 Exam 2025", "paper", "Molika", "2025-12-08"],
  ["r60", "c23", "Cell Structure and Function Notes", "note", "Davy", "2026-03-11"],
  ["r61", "c23", "Photosynthesis Diagram Slides", "slide", "Sokha", "2026-02-19"],
  ["r62", "c23", "Grade 10 Biology Midterm 2026", "paper", "Vanna", "2026-04-30"],
  ["r63", "c24", "Microsoft Word and Excel Basics Notes", "note", "Chanra", "2026-07-16"],
  ["r64", "c24", "Introduction to Scratch Slides", "slide", "Piseth", "2026-06-29"],
  ["r65", "c25", "Calculus Limits and Derivatives Notes", "note", "Kong Piseth", "2026-02-06"],
  ["r66", "c25", "Grade 12 Mathematics Bac II Practice 2025", "paper", "Sreynich", "2025-12-22"],
  ["r67", "c25", "Trigonometry Formula Sheet", "note", "Bopha", "2026-03-30"],
  ["r68", "c26", "Fractions and Decimals Worksheet Notes", "note", "Sam Oeun", "2026-06-11"],
  ["r69", "c26", "Grade 7 Mathematics Semester 2 Exam 2025", "paper", "Chenda", "2025-12-16"],
  ["r70", "c27", "Physical Geography of Cambodia Notes", "note", "Sreypich", "2026-07-08"],
  ["r71", "c27", "Map Reading Practice Slides", "slide", "Ratana", "2026-06-20"],
  ["r72", "c28", "Rocks and Minerals Chapter Notes", "note", "Kanha", "2026-02-24"],
  ["r73", "c28", "Grade 12 Earth Science Mock Exam 2026", "paper", "Sopheak", "2026-04-15"],

  // --- University ---
  ["r1", "c1", "Chapter 1–5 Lecture Notes", "note", "Vannak", "2026-02-14"],
  ["r2", "c1", "Midterm Examination 2025", "paper", "Sreyneang", "2025-11-28"],
  ["r3", "c1", "Week 3 — Loops and Conditions Slides", "slide", "Dara", "2026-01-20"],
  ["r4", "c2", "Set Theory and Logic Summary", "note", "Pisey", "2026-03-02"],
  ["r5", "c2", "Final Examination 2025", "paper", "Vannak", "2025-12-18"],
  ["r6", "c3", "Trees and Graphs Lecture Notes", "note", "Rithy", "2026-04-09"],
  ["r7", "c3", "Sorting Algorithms Slides", "slide", "Sokha", "2026-03-25"],
  ["r8", "c3", "Midterm Examination 2026", "paper", "Chenda", "2026-05-11"],
  ["r9", "c4", "Midterm Review Notes", "note", "Vannak", "2026-09-12"],
  ["r10", "c4", "Database Normalization Slides", "slide", "Sreypov", "2026-08-30"],
  ["r11", "c4", "SQL Joins Cheat Sheet", "note", "Panha", "2026-07-19"],
  ["r12", "c4", "Final Examination 2025", "paper", "Sokha", "2025-12-05"],
  ["r13", "c5", "Web Technologies Week 6 Notes", "note", "Chenda", "2026-06-22"],
  ["r14", "c5", "React Components Workshop Slides", "slide", "Vannak", "2026-07-03"],
  ["r15", "c5", "Midterm Examination 2026", "paper", "Sreyneang", "2026-06-08"],
  ["r16", "c6", "Operating Systems Final Review", "note", "Rithy", "2026-05-30"],
  ["r17", "c6", "Process Scheduling Slides", "slide", "Dara", "2026-04-17"],
  ["r18", "c6", "Final Examination 2025", "paper", "Bopha", "2025-12-21"],
  ["r19", "c7", "OSI Model and TCP/IP Notes", "note", "Channarith", "2026-03-14"],
  ["r20", "c7", "Subnetting Practice Paper", "paper", "Panha", "2026-02-27"],
  ["r21", "c8", "Dynamic Programming Lecture Notes", "note", "Sophea", "2026-08-05"],
  ["r22", "c8", "Graph Algorithms Slides", "slide", "Chenda", "2026-07-28"],
  ["r23", "c8", "Midterm Examination 2026", "paper", "Vannak", "2026-08-19"],
  ["r24", "c9", "Agile and Scrum Summary Notes", "note", "Samnang", "2026-09-01"],
  ["r25", "c9", "Software Testing Slides", "slide", "Sreypov", "2026-08-12"],
  ["r26", "c9", "Final Examination 2025", "paper", "Pisey", "2025-12-15"],
  ["r27", "c10", "Design Principles and Heuristics Notes", "note", "Bopha", "2026-09-08"],
  ["r28", "c10", "Wireframing Workshop Slides", "slide", "Sokha", "2026-08-24"],
  ["r29", "c11", "Classes and Inheritance Notes", "note", "Vanna", "2026-04-02"],
  ["r30", "c11", "Java Practical Lab Slides", "slide", "Sothea", "2026-03-19"],
  ["r31", "c11", "Midterm Examination 2026", "paper", "Ratana", "2026-05-06"],
  ["r32", "c12", "Cryptography Basics Notes", "note", "Sokhom", "2026-07-11"],
  ["r33", "c12", "Network Attacks Case Study Slides", "slide", "Chanda", "2026-06-30"],
  ["r34", "c12", "Final Examination 2025", "paper", "Ratana", "2025-12-09"],
  ["r35", "c13", "CPU and Memory Hierarchy Notes", "note", "Sovan", "2026-02-20"],
  ["r36", "c13", "Assembly Language Practice Paper", "paper", "Thida", "2026-03-08"],
  ["r37", "c14", "Data Cleaning with Python Notes", "note", "Sokunthea", "2026-09-03"],
  ["r38", "c14", "Visualization Techniques Slides", "slide", "Makara", "2026-08-16"],
  ["r39", "c14", "Midterm Examination 2026", "paper", "Thida", "2026-07-25"],
  ["r40", "c15", "Neural Networks Lecture Notes", "note", "Dara", "2026-09-15"],
  ["r41", "c15", "Search Algorithms Slides", "slide", "Vannak", "2026-08-28"],
  ["r42", "c16", "Android Layouts Week 4 Notes", "note", "Sreyleak", "2026-06-12"],
  ["r43", "c16", "Final Examination 2025", "paper", "Panha", "2025-12-19"],
];

export const resources: Resource[] = resourceSeed.map(
  ([id, courseId, title, type, uploadedBy, createdAt]) => ({
    id,
    courseId,
    title,
    type,
    uploadedBy,
    createdAt,
    fileUrl: PLACEHOLDER_FILE_URL,
  }),
);
