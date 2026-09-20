import {
  courses,
  institutions,
  resources,
  PLACEHOLDER_FILE_URL,
} from "../data/mock";
import {
  ApiError,
  type Course,
  type CourseWithCount,
  type CourseWithInstitution,
  type Institution,
  type NewCourseInput,
  type NewInstitutionInput,
  type NewResourceInput,
  type Resource,
} from "../types";

/**
 * Mock service layer. Every page reads data through these functions so that
 * Phase 2 can swap the bodies for real HTTP calls without touching components.
 */

const DEFAULT_DELAY_MS = 450;

function delay(ms: number = DEFAULT_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function countResources(courseId: string): number {
  return resources.filter((resource) => resource.courseId === courseId).length;
}

function findInstitution(institutionId: string): Institution {
  const institution = institutions.find((item) => item.id === institutionId);
  if (!institution) {
    throw new ApiError(`Institution "${institutionId}" was not found`, 404);
  }
  return institution;
}

/** Builds a short name such as "PSHS" from a typed institution name. */
function toShortName(name: string): string {
  const skip = new Set(["of", "the", "and", "for", "de", "in"]);
  const initials = name
    .split(/\s+/)
    .filter((word) => word.length > 0 && !skip.has(word.toLowerCase()))
    .map((word) => word[0].toUpperCase())
    .join("");
  return initials.slice(0, 5) || name.slice(0, 4).toUpperCase();
}

export async function getInstitutions(): Promise<Institution[]> {
  await delay(250);
  return clone(
    [...institutions].sort((a, b) => {
      // Schools first, then universities, alphabetically within each group
      if (a.kind !== b.kind) return a.kind === "school" ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
  );
}

export async function getCourses(): Promise<CourseWithCount[]> {
  await delay();
  return clone(
    courses.map((course) => ({
      ...course,
      institution: findInstitution(course.institutionId),
      resourceCount: countResources(course.id),
    })),
  );
}

export async function getCourse(id: string): Promise<CourseWithInstitution> {
  await delay();
  const course = courses.find((item) => item.id === id);
  if (!course) {
    throw new ApiError(`Course "${id}" was not found`, 404);
  }
  return clone({
    ...course,
    institution: findInstitution(course.institutionId),
  });
}

export async function getResources(courseId: string): Promise<Resource[]> {
  await delay();
  return clone(
    resources
      .filter((resource) => resource.courseId === courseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/**
 * Prototype only: the payload is logged and echoed back. Nothing is persisted,
 * so a school or university added here disappears on refresh.
 */
export async function createInstitution(
  data: NewInstitutionInput,
): Promise<Institution> {
  await delay(350);

  const created: Institution = {
    id: `local-i-${Date.now()}`,
    name: data.name.trim(),
    shortName: toShortName(data.name.trim()),
    city: "",
    kind: data.kind,
  };

  console.log("[Course Hub] createInstitution (prototype, not persisted)", {
    ...data,
    created,
  });

  return created;
}

/** Prototype only: logged and echoed back, never persisted. */
export async function createCourse(data: NewCourseInput): Promise<Course> {
  await delay(350);

  const created: Course = {
    id: `local-c-${Date.now()}`,
    institutionId: data.institutionId,
    code: data.code.trim().toUpperCase(),
    name: data.name.trim(),
    level: data.level,
    semester: data.semester,
    instructor: data.instructor.trim(),
  };

  console.log("[Course Hub] createCourse (prototype, not persisted)", {
    ...data,
    created,
  });

  return created;
}

/**
 * Prototype only: the payload is logged and echoed back. Nothing is persisted
 * and no file is stored anywhere.
 */
export async function createResource(
  data: NewResourceInput,
): Promise<Resource> {
  await delay(650);

  const created: Resource = {
    id: `local-r-${Date.now()}`,
    courseId: data.courseId,
    title: data.title.trim(),
    type: data.type,
    uploadedBy: "You",
    createdAt: new Date().toISOString().slice(0, 10),
    fileUrl: PLACEHOLDER_FILE_URL,
  };

  console.log("[Course Hub] createResource (prototype, not persisted)", {
    ...data,
    created,
  });

  return created;
}
