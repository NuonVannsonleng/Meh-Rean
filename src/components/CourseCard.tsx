import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import type { CourseWithCount } from "../types";
import { BuildingIcon, UserIcon } from "./Icons";

interface CourseCardProps {
  course: CourseWithCount;
}

export default function CourseCard({ course }: CourseCardProps) {
  const { kind } = course.institution;

  return (
    <article className="border-line bg-surface hover:border-brand-300 focus-within:border-brand-400 lift group relative flex h-full flex-col gap-3 rounded-2xl border p-5 shadow-xs hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <span className="bg-brand-50 text-brand-700 group-hover:bg-brand-100 rounded-md px-2 py-1 font-mono text-xs font-semibold tracking-wide transition-colors duration-200">
          {course.code}
        </span>
        {course.resourceCount > 0 && (
          <span className="text-ink-500 shrink-0 text-xs font-medium">
            {t.course.resourceCount(course.resourceCount)}
          </span>
        )}
      </div>

      <h3 className="text-ink-900 text-lg leading-snug font-semibold">
        {/* Stretched link keeps the whole card clickable without nesting issues */}
        <Link
          to={`/courses/${course.id}`}
          className="group-hover:text-brand-700 rounded transition-colors duration-200 before:absolute before:inset-0 before:content-['']"
        >
          {course.name}
        </Link>
      </h3>

      <p className="text-ink-700 flex items-center gap-1.5 text-sm">
        <UserIcon className="text-ink-400 h-4 w-4" />
        <span>{course.instructor}</span>
      </p>

      <div className="border-line mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3">
        <p className="text-ink-500 text-sm">
          {t.course.meta(kind, course.level, course.semester)}
        </p>
        <p
          className="text-ink-500 flex min-w-0 items-center gap-1 text-xs font-semibold"
          title={course.institution.name}
        >
          <BuildingIcon className="text-ink-400 h-3.5 w-3.5" />
          <span className="truncate">{course.institution.shortName}</span>
        </p>
      </div>
    </article>
  );
}
