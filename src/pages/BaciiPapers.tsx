import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon, FileTextIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import { t } from "../i18n/en";
import { getCurriculumSubjects, getExamPapers } from "../services/api";
import type { CurriculumSubject, ExamPaper } from "../types";

const copy = t.bacii.papers;

/** Demo or Official, always visible on a paper; an official paper not yet checked says so. */
export function PaperOriginBadge({ paper }: { paper: Pick<ExamPaper, "origin" | "verification"> }) {
  return paper.origin === "demo" ? (
    <span className="bg-ribbon-50 text-ribbon-fg rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase">{copy.demo}</span>
  ) : (
    <span className="flex flex-wrap items-center gap-1">
      <span className="bg-brand-50 text-accent rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase">{copy.official}</span>
      {paper.verification !== "verified" && <span className="bg-ribbon-50 text-ribbon-fg rounded-full px-2 py-0.5 text-[11px] font-semibold">{copy.needsReview}</span>}
    </span>
  );
}

/** The sitting (2014 had two), read from the paper's title. */
const sittingOf = (paper: ExamPaper) => (/first sitting/.test(paper.titleEn) ? 1 : /second sitting/.test(paper.titleEn) ? 2 : 0);

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap ${active ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink-700 hover:border-ink-400 bg-surface"}`}
    >
      {children}
    </button>
  );
}

/** One paper: tap the row to open it, or Start to go straight into the timed exam. */
function PaperRow({ paper }: { paper: ExamPaper }) {
  const sitting = sittingOf(paper);
  const timed = paper.durationMinutes !== null && Boolean(paper.durationSource);
  return (
    <li className="card flex items-center gap-2 p-2 pl-4">
      <Link to={`/bacii/papers/${paper.id}`} className="press flex min-w-0 flex-1 items-center gap-3 py-1.5" aria-label={paper.titleEn}>
        <span className="font-display text-ink-900 w-14 shrink-0 text-xl font-bold tabular-nums">{paper.year}</span>
        <span className="min-w-0 flex-1">
          {/* The subject is chosen above, so a real paper's row only needs its sitting, length and points. */}
          {paper.origin === "demo" && (
            <span className="text-ink-900 block truncate text-sm font-semibold">
              {paper.titleEn}
            </span>
          )}
          <span className={paper.origin === "demo" ? "text-ink-500 block text-xs" : "text-ink-700 block text-sm"}>
            {[sitting ? copy.sitting(sitting) : "", paper.durationMinutes ? copy.minutesShort(paper.durationMinutes) : "", paper.totalPoints !== null ? copy.pointsShort(paper.totalPoints) : copy.questions(paper.questionCount)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {paper.origin === "demo" && <PaperOriginBadge paper={paper} />}
      </Link>
      {timed && (
        <Link to={`/bacii/timer?paper=${encodeURIComponent(paper.id)}&start=exam`} className="btn-primary h-10 shrink-0 px-4 text-sm" aria-label={copy.startLabel(paper.titleEn)}>
          {copy.start}
        </Link>
      )}
    </li>
  );
}

/** BacII → Past papers: pick a track and a subject (one tap each), then a year. */
export default function BaciiPapers() {
  const [params, setParams] = useSearchParams();
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [papers, setPapers] = useState<ExamPaper[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
    getCurriculumSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  // All papers at once (a few hundred rows): changing subject is then instant.
  useEffect(() => {
    let active = true;
    setPapers(null);
    setFailed(false);
    getExamPapers()
      .then((list) => active && setPapers(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [attempt]);

  const subjectOf = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  // Only subjects that have papers, in curriculum order.
  const withPapers = useMemo(() => subjects.filter((s) => papers?.some((paper) => paper.subjectId === s.id)), [subjects, papers]);
  const tracks = useMemo(() => [...new Map(withPapers.map((s) => [s.trackKey, s])).values()], [withPapers]);

  const asked = params.get("subject") ?? "";
  const track = params.get("track") || subjectOf.get(asked)?.trackKey || tracks[0]?.trackKey || "";
  const trackSubjects = withPapers.filter((s) => s.trackKey === track);
  const subject = trackSubjects.some((s) => s.id === asked) ? asked : (trackSubjects[0]?.id ?? "");
  const year = Number(params.get("year")) || 0;

  const shown = (papers ?? []).filter((paper) => paper.subjectId === subject && (!year || paper.year === year));
  const real = shown.filter((paper) => paper.origin !== "demo");
  const demo = shown.filter((paper) => paper.origin === "demo");

  const choose = (next: { track?: string; subject?: string }) =>
    setParams(
      (current) => {
        const out = new URLSearchParams(current);
        out.delete("year");
        if (next.track) {
          out.set("track", next.track);
          out.delete("subject");
        }
        if (next.subject) out.set("subject", next.subject);
        return out;
      },
      { replace: true },
    );

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-3 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-3">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">
          {copy.title}
        </h1>
        <p className="text-ink-500 mt-1 text-xs">{copy.shortNotice}</p>
      </header>

      {failed ? (
        <ErrorState onRetry={() => setAttempt((count) => count + 1)} />
      ) : !papers || !subjects.length ? (
        <LoadingState count={4} />
      ) : !tracks.length ? (
        <EmptyState icon={<FileTextIcon className="h-6 w-6" />} title={copy.none} body={copy.noneHint} />
      ) : (
        <>
          <div role="group" aria-label={copy.track} className="mb-2 flex gap-2">
            {tracks.map((item) => (
              <Chip key={item.trackKey} active={item.trackKey === track} onClick={() => choose({ track: item.trackKey })}>
                {item.trackNameEn}
              </Chip>
            ))}
          </div>
          {/* Subjects scroll sideways on a phone rather than wrapping into many lines. */}
          <div role="group" aria-label={copy.subject} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {trackSubjects.map((item) => (
              <Chip key={item.id} active={item.id === subject} onClick={() => choose({ subject: item.id })}>
                {item.nameEn}
              </Chip>
            ))}
          </div>

          <p className="text-ink-500 mb-2 text-xs">{copy.count(real.length)}</p>
          <ul className="space-y-2">
            {real.map((paper) => (
              <PaperRow key={paper.id} paper={paper} />
            ))}
          </ul>
          {demo.length > 0 && (
            <>
              <h2 className="text-ink-700 mt-6 mb-2 text-sm font-semibold">{copy.demoHeading}</h2>
              <ul className="space-y-2">
                {demo.map((paper) => (
                  <PaperRow key={paper.id} paper={paper} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
