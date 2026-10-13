import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon, CloseIcon, PlusIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import gradeScale from "../data/grade-scale.json";
import planRules from "../data/study-plan.json";
import { t } from "../i18n/en";
import { addDays, cambodiaDay } from "../lib/daily";
import { buildStudyPlan, mondayOf, weekHours, type PlanItem, type PlanItemKind, type PlanRules, type PlanWarning, type PlanWeek } from "../lib/studyPlan";
import { deleteStudyPlan, getChapterProgress, getCurriculumChapters, getCurriculumSubjects, getStudyPlan, saveStudyPlan } from "../services/api";
import type { ChapterProgress, CurriculumChapter, CurriculumSubject, StudyPlan, StudyPlanInput } from "../types";

const copy = t.bacii.plan;
const rules = planRules as PlanRules;
const SAVE_DELAY_MS = 600;
const HOURS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
const TARGETS = gradeScale.bands.map((band) => band.grade).filter((grade) => grade !== "F");

/** "Oct 12, 2026" for a "YYYY-MM-DD" day, read as a local date. */
const showDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const showHours = (hours: number) => copy.hoursShort(Math.round(hours * 100) / 100);

/** A chapter looks weak with at least 2 answers and under 60% right (smoothed). */
const looksWeak = (progress: ChapterProgress | undefined) => Boolean(progress && progress.answered >= 2 && (progress.correct + 1) / (progress.answered + 2) < 0.6);

interface Settings {
  subjectId: string;
  examDate: string;
  hoursPerDay: number;
  daysPerWeek: number;
  targetGrade: string;
  weakChapterIds: string[];
}

function SettingsForm({
  initial,
  subjects,
  chaptersFor,
  progress,
  hasPlan,
  onCancel,
  onSubmit,
}: {
  initial: Settings;
  subjects: CurriculumSubject[];
  chaptersFor: (subjectId: string) => CurriculumChapter[];
  progress: Map<string, ChapterProgress>;
  hasPlan: boolean;
  onCancel: (() => void) | null;
  onSubmit: (settings: Settings) => void;
}) {
  const [settings, setSettings] = useState(initial);
  const [problem, setProblem] = useState<PlanWarning | null>(null);
  const today = cambodiaDay(new Date());
  const chapters = chaptersFor(settings.subjectId);
  const update = (changes: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...changes }));
    setProblem(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!settings.examDate || settings.examDate <= today) return setProblem("exam-passed");
    if (settings.examDate > addDays(today, 365)) return setProblem("too-far");
    if (hasPlan && !window.confirm(copy.replaceConfirm)) return;
    onSubmit(settings);
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5" aria-labelledby="plan-settings">
      <h2 id="plan-settings" className="font-display text-ink-900 text-lg font-bold">
        {copy.settingsTitle}
      </h2>
      {subjects.length > 1 && (
        <label className="text-ink-700 block text-sm font-medium">
          {copy.subject}
          <select value={settings.subjectId} onChange={(event) => update({ subjectId: event.target.value, weakChapterIds: [] })} className="input mt-1 h-10">
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{`${subject.nameKm} — ${subject.nameEn}`}</option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-ink-700 block text-sm font-medium">
          {copy.examDate}
          <input
            type="date"
            required
            min={addDays(today, 1)}
            max={addDays(today, 365)}
            value={settings.examDate}
            onChange={(event) => update({ examDate: event.target.value })}
            aria-describedby="exam-date-hint"
            className="input mt-1 h-10"
          />
          <span id="exam-date-hint" className="text-ink-500 mt-1 block text-xs font-normal">
            {copy.examDateHint}
          </span>
        </label>
        <label className="text-ink-700 block text-sm font-medium">
          {copy.targetGrade}
          <select value={settings.targetGrade} onChange={(event) => update({ targetGrade: event.target.value })} className="input mt-1 h-10">
            {TARGETS.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <span className="text-ink-500 mt-1 block text-xs font-normal">{copy.targetHint}</span>
        </label>
        <label className="text-ink-700 block text-sm font-medium">
          {copy.hoursPerDay}
          <select value={settings.hoursPerDay} onChange={(event) => update({ hoursPerDay: Number(event.target.value) })} className="input mt-1 h-10">
            {HOURS.map((hours) => (
              <option key={hours} value={hours}>
                {copy.hours(hours)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-ink-700 block text-sm font-medium">
          {copy.daysPerWeek}
          <select value={settings.daysPerWeek} onChange={(event) => update({ daysPerWeek: Number(event.target.value) })} className="input mt-1 h-10">
            {[1, 2, 3, 4, 5, 6, 7].map((days) => (
              <option key={days} value={days}>
                {copy.days(days)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-ink-700 text-sm font-medium">{copy.weakChapters}</legend>
        <p className="text-ink-500 mb-2 text-xs">{copy.weakHint}</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {chapters.map((chapter) => {
            const result = progress.get(chapter.id);
            const checked = settings.weakChapterIds.includes(chapter.id);
            return (
              <label key={chapter.id} className="border-line hover:border-ink-400 flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    update({ weakChapterIds: checked ? settings.weakChapterIds.filter((id) => id !== chapter.id) : [...settings.weakChapterIds, chapter.id] })
                  }
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="text-ink-900 block">{`${chapter.number}. ${chapter.nameKm}`}</span>
                  <span className="text-ink-500 block text-xs">
                    {chapter.nameEn}
                    {result && result.answered > 0 && ` · ${copy.chapterResult(result.correct, result.answered)}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {problem && (
        <p role="alert" className="text-danger-fg text-sm font-medium">
          {copy.warnings[problem]}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary">
          {hasPlan ? copy.remake : copy.make}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            {copy.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

function itemLink(item: PlanItem, subjectId: string): string {
  if (item.kind === "mock-exam") return "/bacii/papers";
  if (item.kind === "review") return "/bacii/mistakes";
  return item.chapterId ? `/bacii/practice?subject=${encodeURIComponent(subjectId)}&chapter=${encodeURIComponent(item.chapterId)}` : "/bacii/practice";
}

function WeekCard({
  week,
  current,
  past,
  subjectId,
  chapters,
  chapterOf,
  onChange,
}: {
  week: PlanWeek;
  current: boolean;
  past: boolean;
  subjectId: string;
  chapters: CurriculumChapter[];
  chapterOf: Map<string, CurriculumChapter>;
  onChange: (items: PlanItem[]) => void;
}) {
  const [adding, setAdding] = useState("");
  const done = week.items.filter((item) => item.done).length;
  const label = (item: PlanItem) => {
    const chapter = item.chapterId ? chapterOf.get(item.chapterId) : undefined;
    return chapter ? `${copy.kinds[item.kind]}: ${chapter.number}. ${chapter.nameKm}` : copy.kinds[item.kind];
  };
  const set = (id: string, changes: Partial<PlanItem>) => onChange(week.items.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const add = () => {
    if (!adding) return;
    const [kind, chapterId] = adding.includes(":") ? (adding.split(":") as [PlanItemKind, string]) : [adding as PlanItemKind, null];
    const hours = kind === "mock-exam" ? rules.mockExamHours : 1;
    onChange([...week.items, { id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind, chapterId, hours, done: false }]);
    setAdding("");
  };

  return (
    <li className={`card p-4 sm:p-5 ${past ? "opacity-75" : ""} ${current ? "border-brand-500" : ""}`}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-display text-ink-900 text-base font-bold">{copy.weekOf(showDay(week.start))}</h3>
        {current && <span className="bg-brand-50 text-accent rounded-full px-2 py-0.5 text-xs font-semibold">{copy.thisWeek}</span>}
        <span className="text-ink-500 text-xs">
          {week.studyDays ? copy.weekLine(week.studyDays, showHours(weekHours(week)), done, week.items.length) : copy.noStudyDays}
        </span>
      </div>
      {week.items.length > 0 && (
        <ul className="divide-line divide-y">
          {week.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => set(item.id, { done: !item.done })}
                aria-label={copy.markDone(label(item))}
                className="h-4 w-4 shrink-0"
              />
              <Link
                to={itemLink(item, subjectId)}
                className={`min-w-0 flex-1 text-sm hover:underline ${item.done ? "text-ink-500 line-through" : "text-ink-900"}`}
              >
                {label(item)}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => set(item.id, { hours: Math.max(0.5, item.hours - 0.5) })}
                  disabled={item.hours <= 0.5}
                  aria-label={`${copy.lessTime}: ${label(item)}`}
                  className="border-line text-ink-700 hover:border-ink-400 h-7 w-7 rounded border text-sm disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-ink-700 w-11 text-center text-xs tabular-nums">{showHours(item.hours)}</span>
                <button
                  type="button"
                  onClick={() => set(item.id, { hours: Math.min(12, item.hours + 0.5) })}
                  aria-label={`${copy.moreTime}: ${label(item)}`}
                  className="border-line text-ink-700 hover:border-ink-400 h-7 w-7 rounded border text-sm"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onChange(week.items.filter((other) => other.id !== item.id))}
                  aria-label={`${copy.remove}: ${label(item)}`}
                  className="text-ink-500 hover:text-danger-fg flex h-7 w-7 items-center justify-center"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {week.studyDays > 0 && (
        <div className="mt-2 flex gap-2">
          <select value={adding} onChange={(event) => setAdding(event.target.value)} aria-label={copy.addLabel} className="input h-9 min-w-0 flex-1 text-sm">
            <option value="">{copy.addLabel}</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={`chapter:${chapter.id}`}>{`${copy.kinds.chapter}: ${chapter.number}. ${chapter.nameKm}`}</option>
            ))}
            <option value="mock-exam">{copy.kinds["mock-exam"]}</option>
            <option value="review">{copy.kinds.review}</option>
          </select>
          <button type="button" onClick={add} disabled={!adding} className="btn-secondary h-9 shrink-0 px-3 text-sm">
            <PlusIcon className="h-4 w-4" />
            {copy.addButton}
          </button>
        </div>
      )}
    </li>
  );
}

/** BacII → Study plan: a weekly plan from the exam date, time and results, all editable (roadmap 3.4). */
export default function BaciiPlan() {
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [warnings, setWarnings] = useState<PlanWarning[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [chapters, setChapters] = useState<Record<string, CurriculumChapter[]>>({});
  const [progress, setProgress] = useState<ChapterProgress[]>([]);
  const [editing, setEditing] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const pending = useRef<StudyPlanInput | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    Promise.all([getStudyPlan(), getCurriculumSubjects(), getChapterProgress().catch(() => [])])
      .then(async ([saved, subjectList, results]) => {
        const lists = await Promise.all(subjectList.map((subject) => getCurriculumChapters(subject.id).catch(() => [])));
        if (!active) return;
        setSubjects(subjectList);
        setChapters(Object.fromEntries(subjectList.map((subject, index) => [subject.id, lists[index]])));
        setProgress(results);
        setPlan(saved);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [reload]);

  // Save edits shortly after the last change; keep trying if the network drops.
  const flush = () => {
    const next = pending.current;
    if (!next) return;
    setSaveState("saving");
    saveStudyPlan(next)
      .then(() => {
        if (pending.current === next) {
          pending.current = null;
          setSaveState("saved");
        }
      })
      .catch(() => {
        setSaveState("failed");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 4000);
      });
  };
  // Leaving or hiding the page saves at once rather than losing the last edit.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const now = () => {
      if (!pending.current) return;
      window.clearTimeout(timer.current);
      flushRef.current();
    };
    const onHide = () => document.visibilityState === "hidden" && now();
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", now);
      document.removeEventListener("visibilitychange", onHide);
      now();
    };
  }, []);

  const progressOf = useMemo(() => new Map(progress.map((item) => [item.chapterId, item])), [progress]);
  const chapterOf = useMemo(() => new Map(Object.values(chapters).flat().map((chapter) => [chapter.id, chapter])), [chapters]);
  const chaptersFor = (subjectId: string) => chapters[subjectId] ?? [];

  const create = async (settings: Settings) => {
    const today = cambodiaDay(new Date());
    const built = buildStudyPlan({ ...settings, today, chapterIds: chaptersFor(settings.subjectId).map((chapter) => chapter.id) }, rules);
    setWarnings(built.warnings);
    if (!built.weeks.length) return;
    setSaveState("saving");
    try {
      const saved = await saveStudyPlan({ ...settings, weeks: built.weeks });
      setPlan(saved);
      setEditing(false);
      setShowEarlier(false);
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  };

  const changeWeek = (start: string, items: PlanItem[]) => {
    if (!plan) return;
    const next = { ...plan, weeks: plan.weeks.map((week) => (week.start === start ? { ...week, items } : week)) };
    setPlan(next);
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...input } = next;
    pending.current = input;
    setSaveState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  };

  const remove = async () => {
    if (!window.confirm(copy.deleteConfirm)) return;
    try {
      await deleteStudyPlan();
      setPlan(null);
      setWarnings([]);
    } catch {
      setReload((count) => count + 1);
    }
  };

  const defaults = (): Settings => {
    const subjectId = plan?.subjectId ?? subjects[0]?.id ?? "";
    return plan
      ? { subjectId, examDate: plan.examDate, hoursPerDay: plan.hoursPerDay, daysPerWeek: plan.daysPerWeek, targetGrade: plan.targetGrade, weakChapterIds: plan.weakChapterIds }
      : {
          subjectId,
          examDate: "",
          hoursPerDay: 2,
          daysPerWeek: 6,
          targetGrade: "C",
          weakChapterIds: chaptersFor(subjectId)
            .filter((chapter) => looksWeak(progressOf.get(chapter.id)))
            .map((chapter) => chapter.id),
        };
  };

  const thisMonday = mondayOf(cambodiaDay(new Date()));
  const earlier = plan ? plan.weeks.filter((week) => week.start < thisMonday) : [];
  const shownWeeks = plan ? plan.weeks.filter((week) => showEarlier || week.start >= thisMonday) : [];
  const weeksLeft = plan ? plan.weeks.filter((week) => week.start >= thisMonday).length : 0;
  const perWeek = plan ? plan.hoursPerDay * plan.daysPerWeek : 0;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-4">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm" lang="km">
          {copy.optionTitleKm}
        </p>
        <p className="text-ink-700 mt-2 text-sm">{copy.intro}</p>
      </header>

      {failed ? (
        <ErrorState onRetry={() => setReload((count) => count + 1)} />
      ) : plan === undefined ? (
        <LoadingState count={2} variant="block" />
      ) : !plan || editing ? (
        <SettingsForm
          key={plan ? "edit" : "new"}
          initial={defaults()}
          subjects={subjects}
          chaptersFor={chaptersFor}
          progress={progressOf}
          hasPlan={Boolean(plan)}
          onCancel={plan ? () => setEditing(false) : null}
          onSubmit={(settings) => void create(settings)}
        />
      ) : (
        <>
          <section className="card mb-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-ink-900 text-sm font-semibold">{copy.summary(showDay(plan.examDate), weeksLeft, showHours(perWeek))}</p>
              <span role="status" className="text-ink-500 text-xs">
                {saveState === "saving" ? copy.saving : saveState === "saved" ? copy.saved : saveState === "failed" ? copy.notSaved : ""}
              </span>
            </div>
            <p className="text-ink-500 mt-1 text-xs">{copy.ruleNote}</p>
            {warnings
              .filter((warning) => warning === "thin")
              .map((warning) => (
                <p key={warning} className="bg-ribbon-50 text-ribbon-fg mt-2 rounded-md px-3 py-2 text-xs font-medium">
                  {copy.warnings[warning]}
                </p>
              ))}
            <button type="button" onClick={() => setEditing(true)} className="btn-secondary mt-3 h-9 px-3 text-sm">
              {copy.changeSettings}
            </button>
          </section>

          {earlier.length > 0 && !showEarlier && (
            <button type="button" onClick={() => setShowEarlier(true)} className="text-accent mb-3 text-sm font-semibold hover:underline">
              {copy.showEarlier(earlier.length)}
            </button>
          )}
          <ol className="space-y-3">
            {shownWeeks.map((week) => (
              <WeekCard
                key={week.start}
                week={week}
                current={week.start === thisMonday}
                past={week.start < thisMonday}
                subjectId={plan.subjectId}
                chapters={chaptersFor(plan.subjectId)}
                chapterOf={chapterOf}
                onChange={(items) => changeWeek(week.start, items)}
              />
            ))}
          </ol>
          <button type="button" onClick={() => void remove()} className="text-ink-500 hover:text-danger-fg mt-6 text-sm font-medium">
            {copy.deletePlan}
          </button>
        </>
      )}
    </div>
  );
}
