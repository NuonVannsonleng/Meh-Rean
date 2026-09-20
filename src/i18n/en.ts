import type { InstitutionKind } from "../types";

/**
 * All user-facing copy lives here. A future `km.ts` only needs to satisfy the
 * exported `Translations` type for Khmer support to drop in.
 */
export const en = {
  common: {
    appName: "Course Hub",
    skipToContent: "Skip to main content",
    tryAgain: "Try again",
    loading: "Loading…",
    prototypeBadge: "Prototype",
  },
  nav: {
    label: "Main navigation",
    courses: "Courses",
    upload: "Upload",
    logoAria: "Course Hub — go to courses",
  },
  home: {
    title: "Find your classes. Share your knowledge.",
    subtitle:
      "Lecture notes, past exam papers and slides from high schools and universities across Cambodia — collected in one place instead of scattered across Telegram groups and Drive folders.",
    sectionTitle: "All courses",
    resultCount: (shown: number, total: number) =>
      `Showing ${shown} of ${total} courses`,
    stats: (courses: number, institutions: number) =>
      `${courses} courses · ${institutions} schools and universities`,
  },
  search: {
    label: "Search courses",
    placeholder: "Search subjects, teachers, schools…",
    clear: "Clear search",
  },
  filters: {
    label: "Filter courses",
    kindLabel: "Level",
    institutionLabel: "School / University",
    gradeYearLabel: "Grade / Year",
    semesterLabel: "Semester",
    all: "All",
    schools: "High school",
    universities: "University",
    semester: (semester: number) => `Semester ${semester}`,
    reset: "Reset filters",
  },
  /** Grade 7–12 for schools, Year 1–4 for universities. */
  level: {
    label: (kind: InstitutionKind, level: number) =>
      kind === "school" ? `Grade ${level}` : `Year ${level}`,
  },
  course: {
    meta: (kind: InstitutionKind, level: number, semester: number) =>
      `${kind === "school" ? "Grade" : "Year"} ${level} · Semester ${semester}`,
    instructorLabel: (kind: InstitutionKind) =>
      kind === "school" ? "Teacher" : "Lecturer",
    resourceCount: (count: number) =>
      `${count} ${count === 1 ? "resource" : "resources"}`,
    backToCourses: "Back to courses",
    resourcesHeading: "Resources",
  },
  tabs: {
    label: "Filter resources by type",
    all: "All",
    note: "Notes",
    paper: "Papers",
    slide: "Slides",
  },
  resource: {
    typeLabel: {
      note: "Notes",
      paper: "Paper",
      slide: "Slides",
    },
    uploadedBy: (name: string) => `Uploaded by ${name}`,
    download: "Download",
    downloadAria: (title: string) => `Download ${title}`,
  },
  upload: {
    title: "Share a resource",
    subtitle:
      "Upload notes, a past paper or slides so the next student does not have to ask for them. Any school, any university, any subject.",
    stepCourse: "Where is it from?",
    stepResource: "What are you sharing?",

    institutionLabel: "School or university",
    institutionPlaceholder: "Select your school or university",
    institutionGroupSchools: "High schools",
    institutionGroupUniversities: "Universities",
    institutionOther: "＋ Mine is not listed",
    institutionKindLabel: "Is it a high school or a university?",
    institutionKindOptions: {
      school: "High school",
      university: "University",
    },
    institutionNameLabel: "School or university name",
    institutionNamePlaceholder: "e.g. Sisowath High School",

    courseLabel: "Subject or course",
    coursePlaceholder: "Select a subject",
    courseOther: "＋ Add a new subject",
    courseEmpty: "Nothing listed here yet — add the first subject.",

    courseCodeLabel: "Subject code",
    courseCodePlaceholder: "e.g. MATH9",
    courseNameLabel: "Subject name",
    courseNamePlaceholder: "e.g. Mathematics",
    instructorLabel: (kind: InstitutionKind) =>
      kind === "school" ? "Teacher" : "Professor / lecturer",
    instructorPlaceholder: (kind: InstitutionKind) =>
      kind === "school" ? "e.g. Mr. Chhun Sovannara" : "e.g. Dr. Sok Dara",
    gradeLabel: "Grade",
    yearLabel: "Year",
    semesterLabel: "Semester",
    semester: (semester: number) => `Semester ${semester}`,

    typeLabel: "Resource type",
    typeOptions: {
      note: "Note",
      paper: "Past Paper",
      slide: "Slide",
    },
    titleLabel: "Title",
    titlePlaceholder: "e.g. Chapter 1–5 Lecture Notes",
    fileLabel: "File",
    fileHint: "PDF, DOCX, PPTX or images up to 20 MB.",
    submit: "Upload resource",
    submitting: "Uploading…",
    prototypeNotice:
      "This is a frontend prototype. Nothing is uploaded to a server and files are not stored.",
    errors: {
      institution: "Please select your school or university.",
      institutionKind: "Please choose high school or university.",
      institutionName: "Please enter the school or university name.",
      course: "Please select a subject.",
      courseCode: "Please enter the subject code.",
      courseName: "Please enter the subject name.",
      instructor: "Please enter the teacher's name.",
      type: "Please choose a resource type.",
      title: "Please enter a title.",
      titleTooShort: "Title must be at least 4 characters.",
      file: "Please attach a file.",
      submit: "We couldn't submit this resource. Please try again.",
    },
    success: {
      title: "Resource uploaded successfully!",
      body: "Your submission was received by the prototype. It is not saved to a server yet.",
      newCourseBody:
        "Your new subject was received by the prototype too. Because nothing is saved to a server yet, it won't appear in the course list.",
      summary: (course: string, institution: string) =>
        `${course} · ${institution}`,
      uploadAnother: "Upload another",
      viewCourse: "View course",
      backToCourses: "Back to courses",
    },
  },
  empty: {
    coursesTitle: "No courses found",
    coursesBody: "Try a different search or remove some filters.",
    resourcesTitle: "No resources yet",
    resourcesBody:
      "Nothing has been shared for this course yet. Be the first to upload.",
    resourcesAction: "Upload a resource",
  },
  error: {
    title: "Something went wrong.",
    body: "We couldn't load this information. Please try again.",
  },
  notFound: {
    code: "404",
    title: "Page not found",
    body: "The page you're looking for doesn't exist.",
    action: "Back to Courses",
  },
  footer: {
    note: "Course Hub — a student project prototype. Mock data only.",
  },
} as const;

export type Translations = typeof en;

export const t: Translations = en;
