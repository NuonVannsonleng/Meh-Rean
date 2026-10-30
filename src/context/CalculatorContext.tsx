import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import calculatorSubjects from "../data/bacii/calculator-subjects.json";

const CalculatorDock = lazy(() => import("../components/calculator/CalculatorDock"));

interface CalculatorRegistry {
  register: (id: string, subjectKey: string) => void;
  unregister: (id: string) => void;
}

const Context = createContext<CalculatorRegistry | null>(null);
const SUBJECTS = new Set<string>(calculatorSubjects.subjects);

/** Shows the calculator button while a page shows a subject that needs one (src/data/bacii/calculator-subjects.json). */
export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<Map<string, string>>(() => new Map());
  const register = useCallback((id: string, subjectKey: string) => {
    setSubjects((current) => (current.get(id) === subjectKey ? current : new Map(current).set(id, subjectKey)));
  }, []);
  const unregister = useCallback((id: string) => {
    setSubjects((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ register, unregister }), [register, unregister]);
  const visible = [...subjects.values()].some((key) => SUBJECTS.has(key));
  return (
    <Context.Provider value={value}>
      {children}
      {/* Loaded only when a calculation subject first appears. */}
      {visible && (
        <Suspense fallback={null}>
          <CalculatorDock />
        </Suspense>
      )}
    </Context.Provider>
  );
}

/** "kh-grade12-social-mathematics" → "mathematics": the subject key in a curriculum subject id. */
export function calculatorSubjectKey(subjectId: string | null | undefined): string | null {
  if (!subjectId) return null;
  return /^kh-grade12-(?:science|social)-(.+)$/.exec(subjectId)?.[1] ?? subjectId;
}

/** Called by anything showing a subject's questions: offers the calculator for calculation subjects. */
export function useCalculatorFor(subjectKey: string | null | undefined) {
  const registry = useContext(Context);
  const id = useId();
  useEffect(() => {
    if (!registry || !subjectKey) return;
    registry.register(id, subjectKey);
    return () => registry.unregister(id);
  }, [registry, id, subjectKey]);
}
