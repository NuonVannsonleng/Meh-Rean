import { useEffect, useState } from "react";
import { getCurriculumChapters, getCurriculumSubjects } from "../services/api";
import type { CurriculumChapter, CurriculumSubject } from "../types";

/** Every subject with its chapters (and their topics), loaded once per page. */
export function useCurriculum(): { subjects: CurriculumSubject[]; chapters: CurriculumChapter[]; loaded: boolean } {
  const [state, setState] = useState<{ subjects: CurriculumSubject[]; chapters: CurriculumChapter[]; loaded: boolean }>({ subjects: [], chapters: [], loaded: false });
  useEffect(() => {
    let active = true;
    getCurriculumSubjects()
      .then(async (subjects) => {
        const lists = await Promise.all(subjects.map((subject) => getCurriculumChapters(subject.id).catch(() => [])));
        if (active) setState({ subjects, chapters: lists.flat(), loaded: true });
      })
      .catch(() => active && setState((current) => ({ ...current, loaded: true })));
    return () => {
      active = false;
    };
  }, []);
  return state;
}
