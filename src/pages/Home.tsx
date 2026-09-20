import { useCallback, useEffect, useMemo, useState } from "react";
import ChipGroup, { type ChipOption } from "../components/ChipGroup";
import CourseCard from "../components/CourseCard";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import SearchBar from "../components/SearchBar";
import { SearchIcon } from "../components/Icons";
import { t } from "../i18n/en";
import { getCourses, getInstitutions } from "../services/api";
import {
  SCHOOL_GRADES,
  UNIVERSITY_YEARS,
  type CourseWithCount,
  type Institution,
  type InstitutionFilter,
  type InstitutionKind,
  type KindFilter,
  type LevelFilter,
  type SemesterFilter,
} from "../types";

const kindOptions: ChipOption<KindFilter>[] = [
  { value: "all", label: t.filters.all },
  { value: "school", label: t.filters.schools },
  { value: "university", label: t.filters.universities },
];

const semesterOptions: ChipOption<SemesterFilter>[] = [
  { value: "all", label: t.filters.all },
  { value: 1, label: t.filters.semester(1) },
  { value: 2, label: t.filters.semester(2) },
];

function levelsFor(kind: KindFilter): number[] {
  if (kind === "school") return [...SCHOOL_GRADES];
  if (kind === "university") return [...UNIVERSITY_YEARS];
  return [...SCHOOL_GRADES, ...UNIVERSITY_YEARS];
}

/** Grade and year ranges never overlap, so a level implies its kind. */
function kindOfLevel(level: number): InstitutionKind {
  return level >= 7 ? "school" : "university";
}

function matchesQuery(course: CourseWithCount, query: string): boolean {
  const haystack = [
    course.code,
    course.name,
    course.instructor,
    course.institution.name,
    course.institution.shortName,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function Home() {
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [institution, setInstitution] = useState<InstitutionFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [semester, setSemester] = useState<SemesterFilter>("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [loadedCourses, loadedInstitutions] = await Promise.all([
        getCourses(),
        getInstitutions(),
      ]);
      setCourses(loadedCourses);
      setInstitutions(loadedInstitutions);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleInstitutions = useMemo(
    () =>
      kind === "all"
        ? institutions
        : institutions.filter((item) => item.kind === kind),
    [institutions, kind],
  );

  const institutionOptions = useMemo<ChipOption<InstitutionFilter>[]>(
    () => [
      { value: "all", label: t.filters.all },
      ...visibleInstitutions.map((item) => ({
        value: item.id,
        label: item.shortName,
        title: item.name,
      })),
    ],
    [visibleInstitutions],
  );

  /** A chosen institution pins the level list to its own kind. */
  const effectiveKind = useMemo<KindFilter>(() => {
    if (institution !== "all") {
      const chosen = institutions.find((item) => item.id === institution);
      if (chosen) return chosen.kind;
    }
    return kind;
  }, [institution, institutions, kind]);

  const levelOptions = useMemo<ChipOption<LevelFilter>[]>(
    () => [
      { value: "all", label: t.filters.all },
      ...levelsFor(effectiveKind).map((value) => ({
        value,
        label: t.level.label(kindOfLevel(value), value),
      })),
    ],
    [effectiveKind],
  );

  const handleKindChange = (nextKind: KindFilter) => {
    setKind(nextKind);
    if (institution !== "all") {
      const chosen = institutions.find((item) => item.id === institution);
      if (nextKind !== "all" && chosen?.kind !== nextKind) {
        setInstitution("all");
      }
    }
    if (level !== "all" && !levelsFor(nextKind).includes(level)) {
      setLevel("all");
    }
  };

  const handleInstitutionChange = (nextInstitution: InstitutionFilter) => {
    setInstitution(nextInstitution);
    const chosen = institutions.find((item) => item.id === nextInstitution);
    if (chosen && level !== "all" && !levelsFor(chosen.kind).includes(level)) {
      setLevel("all");
    }
  };

  const visibleCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (normalized && !matchesQuery(course, normalized)) return false;
      if (kind !== "all" && course.institution.kind !== kind) return false;
      if (institution !== "all" && course.institutionId !== institution)
        return false;
      if (level !== "all" && course.level !== level) return false;
      if (semester !== "all" && course.semester !== semester) return false;
      return true;
    });
  }, [courses, query, kind, institution, level, semester]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    kind !== "all" ||
    institution !== "all" ||
    level !== "all" ||
    semester !== "all";

  const resetFilters = () => {
    setQuery("");
    setKind("all");
    setInstitution("all");
    setLevel("all");
    setSemester("all");
  };

  return (
    <>
      <section
        className="border-line bg-surface border-b"
        aria-labelledby="home-title"
      >
        <div className="container-page py-10 sm:py-14">
          <div className="animate-rise max-w-2xl">
            <h1
              id="home-title"
              className="text-ink-900 text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl"
            >
              {t.home.title}
            </h1>
            <p className="text-ink-700 mt-3 text-base leading-relaxed sm:mt-4 sm:text-lg">
              {t.home.subtitle}
            </p>
          </div>
          <div
            className="animate-rise mt-6 max-w-2xl sm:mt-8"
            style={{ animationDelay: "80ms" }}
          >
            <SearchBar value={query} onChange={setQuery} />
            {!isLoading && !hasError && (
              <p className="text-ink-500 mt-3 text-sm">
                {t.home.stats(courses.length, institutions.length)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className="container-page py-6 sm:py-8"
        aria-labelledby="courses-title"
      >
        <div
          className="animate-rise flex flex-col gap-5"
          style={{ animationDelay: "120ms" }}
          aria-label={t.filters.label}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
            <ChipGroup
              legend={t.filters.kindLabel}
              options={kindOptions}
              selected={kind}
              onSelect={handleKindChange}
            />
            {institutionOptions.length > 1 && (
              <ChipGroup
                legend={t.filters.institutionLabel}
                options={institutionOptions}
                selected={institution}
                onSelect={handleInstitutionChange}
              />
            )}
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-10">
            <ChipGroup
              legend={t.filters.gradeYearLabel}
              options={levelOptions}
              selected={level}
              onSelect={setLevel}
            />
            <ChipGroup
              legend={t.filters.semesterLabel}
              options={semesterOptions}
              selected={semester}
              onSelect={setSemester}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="courses-title"
            className="text-ink-900 text-xl font-semibold tracking-tight"
          >
            {t.home.sectionTitle}
          </h2>
          {!isLoading && !hasError && (
            <p className="text-ink-500 animate-fade text-sm">
              {t.home.resultCount(visibleCourses.length, courses.length)}
            </p>
          )}
        </div>

        <div className="mt-4">
          {isLoading && <LoadingState count={6} />}

          {!isLoading && hasError && <ErrorState onRetry={() => void load()} />}

          {!isLoading && !hasError && visibleCourses.length === 0 && (
            <EmptyState
              title={t.empty.coursesTitle}
              body={t.empty.coursesBody}
              icon={<SearchIcon className="h-6 w-6" />}
              action={
                hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 press inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
                  >
                    {t.filters.reset}
                  </button>
                ) : undefined
              }
            />
          )}

          {!isLoading && !hasError && visibleCourses.length > 0 && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCourses.map((course, index) => (
                <li
                  key={course.id}
                  className="animate-rise h-full"
                  style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                >
                  <CourseCard course={course} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
