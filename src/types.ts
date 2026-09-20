export type ResourceType = "note" | "paper" | "slide";

/** Course Hub serves both secondary schools (grades 7–12) and universities. */
export type InstitutionKind = "school" | "university";

export interface Institution {
  id: string;
  name: string;
  /** Abbreviation used in compact UI such as filter chips and card badges. */
  shortName: string;
  city: string;
  kind: InstitutionKind;
}

export interface Course {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  /** Grade 7–12 for schools, year 1–4 for universities. The ranges never overlap. */
  level: number;
  semester: 1 | 2;
  /** Teacher at a school, lecturer or professor at a university. */
  instructor: string;
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  type: ResourceType;
  uploadedBy: string;
  createdAt: string;
  fileUrl: string;
}

/** A course joined with the school or university that teaches it. */
export interface CourseWithInstitution extends Course {
  institution: Institution;
}

/** A course joined with its institution and the number of resources it holds. */
export interface CourseWithCount extends CourseWithInstitution {
  resourceCount: number;
}

/** Payload accepted by `createResource()`. */
export interface NewResourceInput {
  courseId: string;
  title: string;
  type: ResourceType;
  fileName: string;
}

/** Payload accepted by `createCourse()`. */
export interface NewCourseInput {
  institutionId: string;
  code: string;
  name: string;
  level: number;
  semester: 1 | 2;
  instructor: string;
}

/** Payload accepted by `createInstitution()`. */
export interface NewInstitutionInput {
  name: string;
  kind: InstitutionKind;
}

export const SCHOOL_GRADES = [7, 8, 9, 10, 11, 12] as const;
export const UNIVERSITY_YEARS = [1, 2, 3, 4] as const;

export type KindFilter = "all" | InstitutionKind;
export type InstitutionFilter = "all" | string;
export type LevelFilter = "all" | number;
export type SemesterFilter = "all" | 1 | 2;
export type ResourceTab = "all" | ResourceType;

/** Error surfaced by the service layer; never shown verbatim to users. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
