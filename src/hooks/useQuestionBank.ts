import { useEffect, useMemo, useState } from "react";
import { getCurriculumChapters, getCurriculumSubjects, getQuestions } from "../services/api";
import type { CurriculumChapter, CurriculumSubject, Question } from "../types";

/**
 * Meh Rean's question bank with its chapter names, for matching a student's
 * exercise to a question that has a checked solution. bank is null while loading.
 */
export function useQuestionBank() {
  const [bank, setBank] = useState<Question[] | null>(null);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);

  useEffect(() => {
    let active = true;
    getQuestions()
      .then((list) => active && setBank(list))
      .catch(() => active && setBank([]));
    getCurriculumSubjects()
      .then(async (list) => {
        if (!active) return;
        setSubjects(list);
        const all = await Promise.all(list.map((item) => getCurriculumChapters(item.id).catch(() => [])));
        if (active) setChapters(all.flat());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const subjectKeyOf = (subjectId: string) => subjects.find((item) => item.id === subjectId)?.subjectKey ?? "";
  return { bank, chapterOf, subjectKeyOf };
}
