import { useEffect, useMemo, useState } from "react";
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

/** BacII → Past papers: browse by track, subject and year. */
export default function BaciiPapers() {
  const [params, setParams] = useSearchParams();
  const track = params.get("track") ?? "";
  const subject = params.get("subject") ?? "";
  const year = Number(params.get("year")) || 0;
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [papers, setPapers] = useState<ExamPaper[] | null>(null);
  const [allYears, setAllYears] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
    getCurriculumSubjects().then(setSubjects).catch(() => setSubjects([]));
    getExamPapers()
      .then((list) => setAllYears([...new Set(list.map((paper) => paper.year))].sort((a, b) => b - a)))
      .catch(() => setAllYears([]));
  }, []);

  useEffect(() => {
    let active = true;
    setPapers(null);
    setFailed(false);
    getExamPapers({ trackKey: track || undefined, subjectId: subject || undefined, year: year || undefined })
      .then((list) => active && setPapers(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [track, subject, year, attempt]);

  const tracks = useMemo(() => [...new Map(subjects.map((s) => [s.trackKey, s])).values()], [subjects]);
  const subjectOf = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const setFilter = (key: "track" | "subject" | "year", value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key === "track") next.delete("subject");
        return next;
      },
      { replace: true },
    );

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-4">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm">{copy.optionTitleKm}</p>
        <p className="text-ink-700 mt-2 text-sm">{copy.subtitle}</p>
      </header>
      <p className="bg-ribbon-50 text-ribbon-fg mb-5 rounded-md px-4 py-3 text-sm">{copy.demoNotice}</p>

      <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap">
        <select aria-label={copy.track} value={track} onChange={(event) => setFilter("track", event.target.value)} className="input h-10 cursor-pointer sm:w-auto">
          <option value="">{copy.allTracks}</option>
          {tracks.map((item) => (
            <option key={item.trackKey} value={item.trackKey}>
              {`${item.trackNameKm} — ${item.trackNameEn}`}
            </option>
          ))}
        </select>
        <select aria-label={copy.subject} value={subject} onChange={(event) => setFilter("subject", event.target.value)} className="input h-10 cursor-pointer sm:w-auto">
          <option value="">{copy.allSubjects}</option>
          {subjects
            .filter((item) => !track || item.trackKey === track)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {`${item.nameKm} — ${item.nameEn}`}
              </option>
            ))}
        </select>
        <select aria-label={copy.year} value={year || ""} onChange={(event) => setFilter("year", event.target.value)} className="input h-10 cursor-pointer sm:w-auto">
          <option value="">{copy.allYears}</option>
          {allYears.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {failed ? (
        <ErrorState onRetry={() => setAttempt((count) => count + 1)} />
      ) : !papers ? (
        <LoadingState count={3} />
      ) : papers.length === 0 ? (
        <EmptyState icon={<FileTextIcon className="h-6 w-6" />} title={copy.none} body={copy.noneHint} />
      ) : (
        <>
          <p className="text-ink-500 mb-2 text-xs">{copy.count(papers.length)}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {papers.map((paper) => {
              const item = subjectOf.get(paper.subjectId);
              return (
                <li key={paper.id}>
                  <Link to={`/bacii/papers/${paper.id}`} className="card press hover:border-brand-500 flex h-full flex-col gap-2 p-4 transition-colors">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-ink-900 text-2xl font-bold">{paper.year}</span>
                      <PaperOriginBadge paper={paper} />
                    </span>
                    <span className="text-ink-900 text-sm font-semibold">{paper.titleKm}</span>
                    <span className="text-ink-500 text-xs">{paper.titleEn}</span>
                    {item && <span className="text-ink-700 text-xs">{`${item.nameKm} — ${item.nameEn} · ${item.trackNameEn}`}</span>}
                    <span className="text-ink-500 mt-auto text-xs">
                      {copy.questions(paper.questionCount)}
                      {paper.totalPoints !== null && ` · ${copy.points(paper.totalPoints)}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
