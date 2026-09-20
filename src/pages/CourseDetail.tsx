import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import ResourceCard from "../components/ResourceCard";
import {
  ArrowLeftIcon,
  BuildingIcon,
  UploadIcon,
  UserIcon,
} from "../components/Icons";
import { t } from "../i18n/en";
import { getCourse, getResources } from "../services/api";
import type { CourseWithInstitution, Resource, ResourceTab } from "../types";

const tabOrder: ResourceTab[] = ["all", "note", "paper", "slide"];

const tabLabels: Record<ResourceTab, string> = {
  all: t.tabs.all,
  note: t.tabs.note,
  paper: t.tabs.paper,
  slide: t.tabs.slide,
};

export default function CourseDetail() {
  const { id = "" } = useParams<{ id: string }>();

  const [course, setCourse] = useState<CourseWithInstitution | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeTab, setActiveTab] = useState<ResourceTab>("all");

  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<ResourceTab, HTMLButtonElement>>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [loadedCourse, loadedResources] = await Promise.all([
        getCourse(id),
        getResources(id),
      ]);
      setCourse(loadedCourse);
      setResources(loadedResources);
    } catch {
      setHasError(true);
      setCourse(null);
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo<Record<ResourceTab, number>>(
    () => ({
      all: resources.length,
      note: resources.filter((resource) => resource.type === "note").length,
      paper: resources.filter((resource) => resource.type === "paper").length,
      slide: resources.filter((resource) => resource.type === "slide").length,
    }),
    [resources],
  );

  // Slide the underline to whichever tab is active, and keep it there on resize
  useLayoutEffect(() => {
    const move = () => {
      const element = tabRefs.current[activeTab];
      if (!element) return;
      setIndicator({ left: element.offsetLeft, width: element.offsetWidth });
    };
    move();

    const list = tabListRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(move);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTab, isLoading, counts]);

  const visibleResources = useMemo(
    () =>
      activeTab === "all"
        ? resources
        : resources.filter((resource) => resource.type === activeTab),
    [resources, activeTab],
  );

  return (
    <div className="container-page py-6 sm:py-8">
      <Link
        to="/"
        className="text-ink-700 hover:text-brand-700 group -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-200"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        {t.course.backToCourses}
      </Link>

      {isLoading && (
        <div className="mt-6 space-y-8">
          <div
            className="border-line bg-surface animate-shimmer h-44 rounded-2xl border"
            aria-hidden="true"
          />
          <LoadingState variant="row" count={4} />
        </div>
      )}

      {!isLoading && hasError && (
        <div className="mt-6">
          <ErrorState onRetry={() => void load()} />
        </div>
      )}

      {!isLoading && !hasError && course && (
        <div className="mt-4">
          <header className="border-line bg-surface animate-rise rounded-2xl border p-5 shadow-xs sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-brand-50 text-brand-700 inline-block rounded-md px-2 py-1 font-mono text-xs font-semibold tracking-wide">
                {course.code}
              </span>
              <span className="bg-surface-muted text-ink-700 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold">
                <BuildingIcon className="text-ink-400 h-3.5 w-3.5" />
                {course.institution.shortName}
              </span>
            </div>
            <h1 className="text-ink-900 mt-3 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
              {course.name}
            </h1>
            <p className="text-ink-700 mt-3 flex items-center gap-1.5 text-sm sm:text-base">
              <UserIcon className="text-ink-400 h-4 w-4" />
              <span>
                <span className="text-ink-500">
                  {t.course.instructorLabel(course.institution.kind)}:{" "}
                </span>
                {course.instructor}
              </span>
            </p>
            <p className="text-ink-500 mt-1.5 text-sm">
              {course.institution.name}
            </p>
            <p className="text-ink-500 mt-1.5 text-sm">
              {t.course.meta(
                course.institution.kind,
                course.level,
                course.semester,
              )}
              <span aria-hidden="true"> · </span>
              {t.course.resourceCount(counts.all)}
            </p>
          </header>

          <section
            className="animate-rise mt-8"
            style={{ animationDelay: "90ms" }}
            aria-labelledby="resources-title"
          >
            <h2
              id="resources-title"
              className="text-ink-900 text-xl font-semibold tracking-tight"
            >
              {t.course.resourcesHeading}
            </h2>

            <div className="border-line mt-4 border-b">
              <div
                ref={tabListRef}
                className="scroll-row relative sm:gap-1"
                role="tablist"
                aria-label={t.tabs.label}
              >
                {tabOrder.map((tab) => {
                  const isActive = tab === activeTab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      id={`tab-${tab}`}
                      ref={(element) => {
                        if (element) tabRefs.current[tab] = element;
                      }}
                      aria-selected={isActive}
                      aria-controls="resource-panel"
                      onClick={() => setActiveTab(tab)}
                      className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors duration-200 sm:px-4 ${
                        isActive
                          ? "text-brand-700"
                          : "text-ink-500 hover:text-ink-900"
                      }`}
                    >
                      {tabLabels[tab]}
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold transition-colors duration-200 ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "bg-surface-muted text-ink-500"
                        }`}
                      >
                        {counts[tab]}
                      </span>
                    </button>
                  );
                })}
                <span
                  aria-hidden="true"
                  className="bg-brand-600 ease-out-soft absolute bottom-0 h-0.5 rounded-full transition-[left,width] duration-300"
                  style={{
                    left: `${indicator.left}px`,
                    width: `${indicator.width}px`,
                  }}
                />
              </div>
            </div>

            <div
              id="resource-panel"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              tabIndex={-1}
              className="mt-5"
            >
              {visibleResources.length === 0 ? (
                <EmptyState
                  title={t.empty.resourcesTitle}
                  body={t.empty.resourcesBody}
                  icon={<UploadIcon className="h-6 w-6" />}
                  action={
                    <Link
                      to="/upload"
                      className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 press inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
                    >
                      {t.empty.resourcesAction}
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {visibleResources.map((resource, index) => (
                    <li
                      key={`${activeTab}-${resource.id}`}
                      className="animate-rise"
                      style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
                    >
                      <ResourceCard resource={resource} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
