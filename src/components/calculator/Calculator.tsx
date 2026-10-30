import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { t } from "../../i18n/en";
import { playClick } from "../../lib/calculator/sound";
import { MuteIcon, SoundIcon } from "../Icons";
import {
  TOKENS as T,
  evaluate,
  exactForm,
  exactHints,
  formatDecimal,
  formatDms,
  MathError,
  primeFactors,
  table,
  type AngleUnit,
  type DisplaySetup,
  type EvalContext,
  type StatType,
  type StatVar,
  type Token,
  type Variable,
} from "../../lib/calculator/engine";

const copy = t.calculator;
const STORAGE_KEY = "meh-rean:calculator";
const MAX_TOKENS = 99;

type Mode = "comp" | "stat" | "table";
type Menu =
  | "mode"
  | "setup"
  | "fix"
  | "sci"
  | "norm"
  | "hyp"
  | "drg"
  | "clr"
  | "statType"
  | "statMenu"
  | "statSum"
  | "statVar"
  | "statReg"
  | "statMinMax";

interface Shown {
  value: number;
  tokens: Token[];
  pair?: { labels: [string, string]; values: [number, number] };
  decimal: boolean;
  mixed: boolean;
  eng: number | null;
  dms: boolean;
  fact: boolean;
}

type Screen =
  | { kind: "input" }
  | { kind: "result"; shown: Shown }
  | { kind: "error"; message: string }
  | { kind: "recall"; name: Variable; value: number };

interface Saved {
  vars: Record<Variable, number>;
  ans: number;
  angle: AngleUnit;
  display: DisplaySetup;
  mode: Mode;
  statType: StatType;
  statRows: { x: number; y: number }[];
  /** Key clicks on (the default) or off. */
  sound: boolean;
}

const EMPTY_VARS: Record<Variable, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 };
const DEFAULTS: Saved = { vars: EMPTY_VARS, ans: 0, angle: "deg", display: { kind: "norm", n: 1 }, mode: "comp", statType: "1-var", statRows: [], sound: true };

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Saved> | null;
    return saved ? { ...DEFAULTS, ...saved, vars: { ...EMPTY_VARS, ...saved.vars } } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Tokens a result can be continued with: pressing them after = starts from Ans, as on the calculator. */
const CONTINUES = new Set(["+", "-", "*", "/", "pow", "sq", "cube", "inv", "fact", "pct", "frac", "npr", "ncr", "xroot", "dms"]);

const STAT_TYPES: { id: StatType; label: string }[] = [
  { id: "1-var", label: "1-VAR" },
  { id: "a+bx", label: "A+BX" },
  { id: "quad", label: "_+CX²" },
  { id: "lnx", label: "ln X" },
  { id: "ex", label: "e^X" },
  { id: "abx", label: "A·B^X" },
  { id: "axb", label: "A·X^B" },
  { id: "1/x", label: "1/X" },
];

/** The letter each key types with ALPHA, and stores to after STO. */
const ALPHA_KEYS: Record<string, Variable> = { neg: "A", dms: "B", hyp: "C", sin: "D", cos: "E", tan: "F", close: "X", sd: "Y", mplus: "M" };

// ------------------------------------------------------------------ display --

function Frac({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex flex-col items-center align-middle leading-none">
      <span className="px-0.5 pb-0.5">{top}</span>
      <span className="w-full border-t border-current px-0.5 pt-0.5 text-center">{bottom}</span>
    </span>
  );
}

function Root({ n }: { n: number }) {
  return (
    <span>
      √<span className="border-t border-current">{n}</span>
    </span>
  );
}

function DecimalText({ value, setup, eng }: { value: number; setup: DisplaySetup; eng: number | null }) {
  const d = formatDecimal(value, setup, eng);
  return (
    <span>
      {d.mantissa}
      {d.exponent !== null && (
        <>
          ×10<sup className="text-[0.65em]">{d.exponent}</sup>
        </>
      )}
    </span>
  );
}

function ResultText({ shown, setup, angle }: { shown: Shown; setup: DisplaySetup; angle: AngleUnit }) {
  if (shown.pair) {
    return (
      <span className="flex flex-col items-end text-base">
        {shown.pair.labels.map((label, index) => (
          <span key={label}>
            {label}=<DecimalText value={shown.pair!.values[index]} setup={setup} eng={null} />
          </span>
        ))}
      </span>
    );
  }
  if (shown.fact) {
    const factors = primeFactors(shown.value);
    if (factors)
      return (
        <span>
          {factors.map(([p, k], index) => (
            <span key={p}>
              {index > 0 && "×"}
              {p}
              {k > 1 && <sup className="text-[0.65em]">{k}</sup>}
            </span>
          ))}
        </span>
      );
  }
  if (shown.dms) return <span>{formatDms(shown.value)}</span>;
  const exact = shown.decimal || shown.eng !== null || setup.kind !== "norm" ? null : exactForm(shown.value, exactHints(shown.tokens, angle));
  if (!exact) return <DecimalText value={shown.value} setup={setup} eng={shown.eng} />;
  const coefficient = exact.num === 1 && (exact.root > 1 || exact.pi) ? "" : exact.num;
  const top = (
    <>
      {coefficient}
      {exact.root > 1 && <Root n={exact.root} />}
      {exact.pi && "π"}
    </>
  );
  if (shown.mixed && exact.root === 1 && !exact.pi && exact.num > exact.den) {
    return (
      <span>
        {exact.negative && "−"}
        {Math.floor(exact.num / exact.den)}
        <Frac top={exact.num % exact.den} bottom={exact.den} />
      </span>
    );
  }
  return (
    <span>
      {exact.negative && "−"}
      {exact.den > 1 ? <Frac top={top} bottom={exact.den} /> : top}
    </span>
  );
}

// --------------------------------------------------------------------- keys --

interface KeySpec {
  id: string;
  label: ReactNode;
  name: string;
  shift?: ReactNode;
  alpha?: ReactNode;
  tone?: "fn" | "num" | "del" | "top";
}

const sup = (base: string, power: string) => (
  <>
    {base}
    <sup className="text-[0.7em]">{power}</sup>
  </>
);

const TOP_LEFT: KeySpec[] = [
  { id: "shift", label: "SHIFT", name: "Shift", tone: "top" },
  { id: "alpha", label: "ALPHA", name: "Alpha", tone: "top" },
  { id: "abs", label: "Abs", name: "Absolute value" },
  { id: "x3", label: sup("x", "3"), name: "Cube" },
];
const TOP_RIGHT: KeySpec[] = [
  { id: "mode", label: "MODE", name: "Mode", shift: "SETUP", tone: "top" },
  { id: "on", label: "ON", name: "On, clear", tone: "top" },
  { id: "xinv", label: sup("x", "−1"), name: "Reciprocal", shift: "x!" },
  { id: "logab", label: <>log<sub className="text-[0.7em]">■</sub>□</>, name: "Log base a of b" },
];
const FUNCTION_ROWS: KeySpec[][] = [
  [
    { id: "frac", label: <Frac top="■" bottom="□" />, name: "Fraction", shift: "■□/□" },
    { id: "sqrt", label: "√■", name: "Square root", shift: "∛■" },
    { id: "x2", label: sup("x", "2"), name: "Square" },
    { id: "xpow", label: sup("x", "■"), name: "Power", shift: "■√□" },
    { id: "log", label: "log", name: "Logarithm", shift: sup("10", "■") },
    { id: "ln", label: "ln", name: "Natural logarithm", shift: sup("e", "■") },
  ],
  [
    { id: "neg", label: "(−)", name: "Negative", alpha: "A" },
    { id: "dms", label: "°'\"", name: "Degrees minutes seconds", shift: "FACT", alpha: "B" },
    { id: "hyp", label: "hyp", name: "Hyperbolic", alpha: "C" },
    { id: "sin", label: "sin", name: "Sine", shift: sup("sin", "−1"), alpha: "D" },
    { id: "cos", label: "cos", name: "Cosine", shift: sup("cos", "−1"), alpha: "E" },
    { id: "tan", label: "tan", name: "Tangent", shift: sup("tan", "−1"), alpha: "F" },
  ],
  [
    { id: "rcl", label: "RCL", name: "Recall", shift: "STO" },
    { id: "eng", label: "ENG", name: "Engineering", shift: "←" },
    { id: "open", label: "(", name: "Open bracket", shift: "%" },
    { id: "close", label: ")", name: "Close bracket", shift: ",", alpha: "X" },
    { id: "sd", label: "S⇔D", name: "Fraction or decimal", shift: "a b/c⇔d/c", alpha: "Y" },
    { id: "mplus", label: "M+", name: "Memory plus", shift: "M−", alpha: "M" },
  ],
];
const NUMBER_ROWS: KeySpec[][] = [
  [
    { id: "7", label: "7", name: "7", tone: "num" },
    { id: "8", label: "8", name: "8", tone: "num" },
    { id: "9", label: "9", name: "9", shift: "CLR", tone: "num" },
    { id: "del", label: "DEL", name: "Delete", shift: "INS", tone: "del" },
    { id: "ac", label: "AC", name: "All clear", shift: "OFF", tone: "del" },
  ],
  [
    { id: "4", label: "4", name: "4", tone: "num" },
    { id: "5", label: "5", name: "5", tone: "num" },
    { id: "6", label: "6", name: "6", tone: "num" },
    { id: "times", label: "×", name: "Multiply", shift: "nPr", tone: "num" },
    { id: "divide", label: "÷", name: "Divide", shift: "nCr", tone: "num" },
  ],
  [
    { id: "1", label: "1", name: "1", shift: "STAT", tone: "num" },
    { id: "2", label: "2", name: "2", tone: "num" },
    { id: "3", label: "3", name: "3", tone: "num" },
    { id: "plus", label: "+", name: "Plus", shift: "Pol", tone: "num" },
    { id: "minus", label: "−", name: "Minus", shift: "Rec", tone: "num" },
  ],
  [
    { id: "0", label: "0", name: "0", shift: "Rnd", tone: "num" },
    { id: "point", label: "•", name: "Decimal point", shift: "Ran#", alpha: "RanInt", tone: "num" },
    { id: "exp", label: sup("×10", "x"), name: "Times ten to the power", shift: "π", alpha: "e", tone: "num" },
    { id: "ans", label: "Ans", name: "Answer", shift: "DRG►", tone: "num" },
    { id: "equals", label: "=", name: "Equals", tone: "num" },
  ],
];

const TONES: Record<NonNullable<KeySpec["tone"]>, string> = {
  fn: "calc-key calc-key-fn h-7 text-white text-[12px] rounded-[9px]",
  top: "calc-key calc-key-top h-6 text-white text-[9px] font-bold tracking-wide rounded-full",
  num: "calc-key calc-key-num h-8 text-white text-lg rounded-[10px]",
  del: "calc-key calc-key-green h-8 text-white text-sm font-bold rounded-[10px]",
};

function Key({ spec, onPress }: { spec: KeySpec; onPress: (id: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col items-stretch">
      <span className="flex h-3 items-end justify-center gap-1 text-[8px] leading-none font-semibold whitespace-nowrap">
        {spec.shift && <span className="text-[#e7b54a]">{spec.shift}</span>}
        {spec.alpha && <span className="text-[#ec6a8c]">{spec.alpha}</span>}
      </span>
      <button
        type="button"
        onClick={() => onPress(spec.id)}
        aria-label={[spec.name, spec.shift && typeof spec.shift === "string" ? `Shift: ${spec.shift}` : "", spec.alpha && typeof spec.alpha === "string" ? `Alpha: ${spec.alpha}` : ""].filter(Boolean).join(", ")}
        data-key={spec.id}
        className={`mt-0.5 mb-[3px] flex items-center justify-center font-medium select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ad35c] ${TONES[spec.tone ?? "fn"]}`}
      >
        {spec.label}
      </button>
    </div>
  );
}

// --------------------------------------------------------------- the device --

/** A scientific calculator in the style of the fx-82ES PLUS: COMP, STAT and TABLE modes. */
export default function Calculator({ onOff, closeLabel }: { onOff: () => void; closeLabel: string }) {
  const [saved, setSaved] = useState<Saved>(load);
  const [input, setInput] = useState<Token[]>([]);
  const [cursor, setCursor] = useState(0);
  const [screen, setScreen] = useState<Screen>({ kind: "input" });
  const [shift, setShift] = useState(false);
  const [alpha, setAlpha] = useState(false);
  const [pending, setPending] = useState<"sto" | "rcl" | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [hypInverse, setHypInverse] = useState(false);
  const [history, setHistory] = useState<Token[][]>([]);
  const [historyAt, setHistoryAt] = useState(-1);
  // STAT data editor and TABLE prompts.
  const [statEditor, setStatEditor] = useState<{ row: number; col: 0 | 1 } | null>(null);
  const [entry, setEntry] = useState<Token[]>([]);
  const [tablePhase, setTablePhase] = useState<"fx" | "start" | "end" | "step" | "view">("fx");
  const [tableSpec, setTableSpec] = useState({ fx: [] as Token[], start: 1, end: 5, step: 1 });
  const [tableRows, setTableRows] = useState<{ x: number; y: number | null }[]>([]);
  const [tableRow, setTableRow] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Memory is kept for this visit only.
    }
  }, [saved]);

  const update = (patch: Partial<Saved>) => setSaved((current) => ({ ...current, ...patch }));
  const context = (): EvalContext => ({
    angle: saved.angle,
    vars: saved.vars,
    ans: saved.ans,
    setup: saved.display,
    stats: saved.mode === "stat" ? { type: saved.statType, rows: saved.statRows } : null,
  });
  const twoVar = saved.statType !== "1-var";

  const clearInput = () => {
    setInput([]);
    setCursor(0);
    setScreen({ kind: "input" });
    setHistoryAt(-1);
  };

  const fail = (error: unknown) => setScreen({ kind: "error", message: error instanceof MathError ? error.message : copy.syntaxError });

  /** Types tokens at the cursor; after a result, an operator continues from Ans. */
  const insert = (tokens: Token[]) => {
    if (statEditor || (saved.mode === "table" && tablePhase !== "fx")) {
      setEntry((current) => [...current, ...tokens].slice(0, 30));
      return;
    }
    if (screen.kind === "result" || screen.kind === "recall") {
      const next = CONTINUES.has(tokens[0].id) || tokens[0].id.startsWith("statpost:") || tokens[0].id.startsWith("drg:") ? [T.ans, ...tokens] : tokens;
      setInput(next);
      setCursor(next.length);
      setScreen({ kind: "input" });
      return;
    }
    if (screen.kind === "error") return;
    if (input.length + tokens.length > MAX_TOKENS) return;
    setInput([...input.slice(0, cursor), ...tokens, ...input.slice(cursor)]);
    setCursor(cursor + tokens.length);
  };

  const showResult = (value: number, tokens: Token[], pair?: Shown["pair"]) =>
    setScreen({ kind: "result", shown: { value, tokens, pair, decimal: false, mixed: false, eng: null, dms: false, fact: false } });

  const equals = () => {
    if (!input.length) return;
    try {
      const result = evaluate(input, context());
      const vars = result.pair ? { ...saved.vars, X: result.pair.values[0], Y: result.pair.values[1] } : saved.vars;
      update({ ans: result.value, vars });
      setHistory((current) => [input, ...current.filter((item) => item !== input)].slice(0, 20));
      setHistoryAt(-1);
      showResult(result.value, input, result.pair);
    } catch (error) {
      fail(error);
    }
  };

  /** The value STO and M+ act on: the shown result, or the input worked out first. */
  const currentValue = (): number | null => {
    if (screen.kind === "result") return screen.shown.value;
    if (!input.length) return saved.ans;
    try {
      const result = evaluate(input, context());
      update({ ans: result.value });
      showResult(result.value, input, result.pair);
      return result.value;
    } catch (error) {
      fail(error);
      return null;
    }
  };

  const changeShown = (change: (shown: Shown) => Shown) => {
    if (screen.kind === "result") setScreen({ kind: "result", shown: change(screen.shown) });
  };

  const chooseMenu = (item: number) => {
    const current = menu;
    setMenu(null);
    switch (current) {
      case "mode": {
        const mode = (["comp", "stat", "table"] as const)[item - 1];
        if (!mode) return setMenu(current);
        update({ mode });
        clearInput();
        setStatEditor(null);
        setTablePhase("fx");
        if (mode === "stat") setMenu("statType");
        return;
      }
      case "statType": {
        const type = STAT_TYPES[item - 1];
        if (!type) return setMenu(current);
        // Choosing a type clears the data, as on the calculator.
        update({ statType: type.id, statRows: [] });
        setStatEditor({ row: 0, col: 0 });
        setEntry([]);
        return;
      }
      case "setup": {
        if (item === 1) return update({ angle: "deg" });
        if (item === 2) return update({ angle: "rad" });
        if (item === 3) return update({ angle: "gra" });
        if (item === 4) return setMenu("fix");
        if (item === 5) return setMenu("sci");
        if (item === 6) return setMenu("norm");
        return setMenu(current);
      }
      case "fix":
        return item >= 0 && item <= 9 ? update({ display: { kind: "fix", n: item } }) : setMenu(current);
      case "sci":
        return item >= 0 && item <= 9 ? update({ display: { kind: "sci", n: item === 0 ? 10 : item } }) : setMenu(current);
      case "norm":
        return item === 1 || item === 2 ? update({ display: { kind: "norm", n: item } }) : setMenu(current);
      case "hyp": {
        const names = hypInverse ? (["asinh", "acosh", "atanh"] as const) : (["sinh", "cosh", "tanh"] as const);
        const all = [...names, ...(hypInverse ? [] : (["asinh", "acosh", "atanh"] as const))];
        const name = all[item - 1];
        if (!name) return setMenu(current);
        return insert([T.fn(name)]);
      }
      case "drg": {
        const unit = (["deg", "rad", "gra"] as const)[item - 1];
        if (!unit) return setMenu(current);
        return insert([T.drg(unit)]);
      }
      case "clr": {
        if (item === 1) return update({ angle: DEFAULTS.angle, display: DEFAULTS.display });
        if (item === 2) return update({ vars: EMPTY_VARS, ans: 0 });
        if (item === 3) {
          setSaved({ ...DEFAULTS });
          setHistory([]);
          return clearInput();
        }
        return setMenu(current);
      }
      case "statMenu": {
        if (item === 1) return setMenu("statType");
        if (item === 2) {
          setStatEditor({ row: 0, col: 0 });
          return setEntry([]);
        }
        const next: Menu | undefined = ({ 3: "statSum", 4: "statVar", 5: twoVar ? "statReg" : undefined, 6: "statMinMax" } as Record<number, Menu | undefined>)[item];
        return next ? setMenu(next) : setMenu(current);
      }
      case "statSum":
      case "statVar":
      case "statReg":
      case "statMinMax": {
        const list = statMenuItems(current, saved.statType);
        const picked = list[item - 1];
        if (!picked) return setMenu(current);
        return insert([picked.post ? T.statPost(picked.post) : T.stat(picked.id as StatVar)]);
      }
    }
  };

  const commitEntry = (): number | null => {
    if (!entry.length) return null;
    try {
      return evaluate(entry, context()).value;
    } catch (error) {
      fail(error);
      return null;
    }
  };

  const press = (key: string) => {
    const isShift = shift;
    const isAlpha = alpha;
    setShift(false);
    setAlpha(false);

    // Menus take a digit (AC or the menu's own key leaves them).
    if (menu) {
      if (/^\d$/.test(key)) return chooseMenu(Number(key));
      if (key === "ac" || key === "on" || key === "mode") return setMenu(null);
      if (key === "right" && menu === "setup") return;
      return;
    }

    if (key === "shift") return setShift(!isShift);
    if (key === "alpha") return setAlpha(!isAlpha);
    if (key === "on") {
      setPending(null);
      setStatEditor(null);
      return clearInput();
    }
    if (key === "ac" && isShift) return onOff();
    if (key === "mode") return setMenu(isShift ? "setup" : "mode");

    // STO / RCL wait for a variable key.
    if (pending) {
      const name = ALPHA_KEYS[key];
      setPending(null);
      if (!name) return;
      if (pending === "rcl") return setScreen({ kind: "recall", name, value: saved.vars[name] });
      const value = currentValue();
      if (value !== null) {
        update({ vars: { ...saved.vars, [name]: value }, ans: value });
        showResult(value, input);
      }
      return;
    }

    if (isAlpha) {
      const name = ALPHA_KEYS[key];
      if (name) return insert([T.variable(name)]);
      if (key === "point") return insert([T.fn("ranint")]);
      if (key === "exp") return insert([T.e]);
      return;
    }

    // ---- STAT data editor ----
    if (statEditor) {
      const rows = saved.statRows;
      const col = statEditor.col;
      if (key === "equals") {
        const value = commitEntry();
        if (value === null) return;
        const next = [...rows];
        if (statEditor.row >= next.length) next.push({ x: 0, y: 0 });
        next[statEditor.row] = { ...next[statEditor.row], [col === 0 ? "x" : "y"]: value };
        update({ statRows: next.slice(0, 40) });
        setEntry([]);
        setStatEditor({ row: Math.min(statEditor.row + 1, next.length, 39), col });
        return;
      }
      if (key === "up") return setStatEditor({ ...statEditor, row: Math.max(0, statEditor.row - 1) });
      if (key === "down") return setStatEditor({ ...statEditor, row: Math.min(rows.length, statEditor.row + 1) });
      if (key === "left" || key === "right") return twoVar ? setStatEditor({ ...statEditor, col: col === 0 ? 1 : 0 }) : undefined;
      if (key === "del") {
        if (entry.length) return setEntry(entry.slice(0, -1));
        if (statEditor.row < rows.length) update({ statRows: rows.filter((_, index) => index !== statEditor.row) });
        return;
      }
      if (key === "ac") {
        if (entry.length) return setEntry([]);
        setStatEditor(null);
        return clearInput();
      }
    }

    // ---- TABLE prompts and view ----
    if (saved.mode === "table" && tablePhase !== "fx") {
      if (tablePhase === "view") {
        if (key === "up") return setTableRow(Math.max(0, tableRow - 1));
        if (key === "down") return setTableRow(Math.min(tableRows.length - 1, tableRow + 1));
        if (key === "ac") {
          setTablePhase("fx");
          setInput(tableSpec.fx);
          setCursor(tableSpec.fx.length);
          return setScreen({ kind: "input" });
        }
        return;
      }
      if (key === "equals") {
        const value = entry.length ? commitEntry() : tableSpec[tablePhase];
        if (value === null) return;
        const spec = { ...tableSpec, [tablePhase]: value };
        setTableSpec(spec);
        setEntry([]);
        if (tablePhase === "start") return setTablePhase("end");
        if (tablePhase === "end") return setTablePhase("step");
        try {
          setTableRows(table(spec.fx, spec.start, spec.end, spec.step, context()));
          setTableRow(0);
          setTablePhase("view");
        } catch (error) {
          // Back to f(X), with the error under it.
          setScreen({ kind: "error", message: error instanceof Error && error.message === "Insufficient MEM" ? copy.memError : copy.mathError });
          setTablePhase("fx");
        }
        return;
      }
      if (key === "del") return setEntry(entry.slice(0, -1));
      if (key === "ac") {
        setTablePhase("fx");
        return setScreen({ kind: "input" });
      }
    }

    switch (key) {
      case "equals":
        if (saved.mode === "table") {
          if (!input.length) return;
          setTableSpec({ ...tableSpec, fx: input });
          setEntry([]);
          setScreen({ kind: "input" });
          return setTablePhase("start");
        }
        return equals();
      case "ac":
        return clearInput();
      case "del":
        if (screen.kind !== "input" || cursor === 0) return;
        setInput([...input.slice(0, cursor - 1), ...input.slice(cursor)]);
        return setCursor(cursor - 1);
      case "left":
      case "right":
        if (screen.kind !== "input") {
          // Back to editing the last calculation.
          setScreen({ kind: "input" });
          return setCursor(key === "left" ? input.length : 0);
        }
        return setCursor(Math.max(0, Math.min(input.length, cursor + (key === "left" ? -1 : 1))));
      case "up":
      case "down": {
        if (!history.length) return;
        const at = Math.max(-1, Math.min(history.length - 1, historyAt + (key === "up" ? 1 : -1)));
        setHistoryAt(at);
        const item = at === -1 ? [] : history[at];
        setInput(item);
        setCursor(item.length);
        return setScreen({ kind: "input" });
      }
      case "rcl":
        return setPending(isShift ? "sto" : "rcl");
      case "mplus": {
        const value = currentValue();
        if (value !== null) update({ vars: { ...saved.vars, M: saved.vars.M + (isShift ? -value : value) }, ans: value });
        return;
      }
      case "sd":
        if (isShift) return changeShown((shown) => ({ ...shown, mixed: !shown.mixed, decimal: false }));
        return changeShown((shown) => ({ ...shown, decimal: !shown.decimal, eng: null, dms: false, fact: false }));
      case "eng":
        return changeShown((shown) => ({ ...shown, eng: isShift ? (shown.eng === null ? 3 : shown.eng + 3) : shown.eng === null ? 0 : shown.eng - 3 }));
      case "dms":
        if (isShift) return changeShown((shown) => ({ ...shown, fact: !shown.fact }));
        if (screen.kind === "result") return changeShown((shown) => ({ ...shown, dms: !shown.dms }));
        return insert([T.dms]);
      case "hyp":
        setHypInverse(isShift);
        return setMenu("hyp");
      case "ans":
        return isShift ? setMenu("drg") : insert([T.ans]);
      case "9":
        if (isShift) return setMenu("clr");
        break;
      case "1":
        if (isShift) return saved.mode === "stat" ? setMenu("statMenu") : undefined;
        break;
      case "0":
        if (isShift) return insert([T.fn("rnd")]);
        break;
    }

    const shifted: Record<string, Token[]> = {
      xinv: [T.factorial],
      frac: [T.fraction],
      sqrt: [T.fn("cbrt")],
      xpow: [T.xroot],
      log: [T.fn("pow10")],
      ln: [T.fn("exp")],
      sin: [T.fn("asin")],
      cos: [T.fn("acos")],
      tan: [T.fn("atan")],
      open: [T.percent],
      close: [T.comma],
      times: [T.npr],
      divide: [T.ncr],
      plus: [T.fn("pol")],
      minus: [T.fn("rec")],
      point: [T.ranHash],
      exp: [T.pi],
    };
    const plain: Record<string, Token[]> = {
      abs: [T.fn("abs")],
      x3: [T.cube],
      xinv: [T.inverse],
      logab: [T.fn("log")],
      frac: [T.fraction],
      sqrt: [T.fn("sqrt")],
      x2: [T.square],
      xpow: [T.power],
      log: [T.fn("log")],
      ln: [T.fn("ln")],
      neg: [T.neg],
      sin: [T.fn("sin")],
      cos: [T.fn("cos")],
      tan: [T.fn("tan")],
      open: [T.open],
      close: [T.close],
      times: [T.times],
      divide: [T.divide],
      plus: [T.plus],
      minus: [T.minus],
      point: [T.point],
      exp: [T.exp],
    };
    if (/^\d$/.test(key)) return insert([T.digit(key)]);
    const tokens = (isShift ? shifted[key] : undefined) ?? plain[key];
    if (tokens) insert(tokens);
  };

  const pressKey = (key: string) => {
    if (saved.sound) playClick(key === "equals" ? "equals" : /^\d$/.test(key) || ["point", "exp", "ans", "times", "divide", "plus", "minus", "del", "ac"].includes(key) ? "num" : "fn");
    press(key);
  };

  // ------------------------------------------------------------ keyboard --
  const onKeyDown = (event: KeyboardEvent) => {
    const map: Record<string, string> = {
      Enter: "equals",
      "=": "equals",
      Backspace: "del",
      Delete: "ac",
      Escape: "ac",
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      "+": "plus",
      "-": "minus",
      "*": "times",
      "/": "divide",
      "^": "xpow",
      "(": "open",
      ")": "close",
      ".": "point",
      ",": "point",
    };
    const key = /^\d$/.test(event.key) ? event.key : map[event.key];
    if (!key || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    pressKey(key);
  };

  // --------------------------------------------------------------- screen --
  const indicators = [
    shift && "S",
    alpha && "A",
    saved.vars.M !== 0 && "M",
    pending === "sto" && "STO",
    pending === "rcl" && "RCL",
    saved.mode === "stat" && "STAT",
    saved.angle === "deg" ? "D" : saved.angle === "rad" ? "R" : "G",
    saved.display.kind === "fix" && "FIX",
    saved.display.kind === "sci" && "SCI",
    "Math",
  ].filter(Boolean) as string[];

  const tokensText = (tokens: Token[], withCursor: boolean) => (
    <span className="break-all">
      {tokens.map((token, index) => (
        <span key={index}>
          {withCursor && index === cursor && <span className="calc-cursor" />}
          {token.label}
        </span>
      ))}
      {withCursor && cursor === tokens.length && <span className="calc-cursor" />}
    </span>
  );

  let body: ReactNode;
  if (menu) {
    body = (
      <ol className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
        {menuItems(menu, saved, hypInverse).map((label, index) => (
          <li key={label}>
            <button type="button" className="w-full text-left hover:underline" onClick={() => chooseMenu(menu === "fix" || menu === "sci" ? index : index + 1)}>
              {label}
            </button>
          </li>
        ))}
      </ol>
    );
  } else if (statEditor) {
    const rows = saved.statRows;
    const first = Math.max(0, statEditor.row - 2);
    body = (
      <div className="text-[13px]">
        <table className="w-full table-fixed text-right tabular-nums">
          <thead>
            <tr>
              <th className="w-6 text-left font-normal" />
              <th className="font-semibold">x</th>
              {twoVar && <th className="font-semibold">y</th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }, (_, offset) => first + offset).map((row) => (
              <tr key={row}>
                <td className="text-left">{row + 1}</td>
                {[0, 1].slice(0, twoVar ? 2 : 1).map((col) => (
                  <td key={col} className={`px-1 ${statEditor.row === row && statEditor.col === col ? "bg-[#2d3a2b] text-[#c9d6bf]" : ""}`}>
                    {row < rows.length ? formatDecimal(col === 0 ? rows[row].x : rows[row].y, { kind: "norm", n: 1 }).mantissa : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 min-h-5 border-t border-[#2d3a2b]/30 pt-0.5 text-right">{tokensText(entry, false)}</p>
      </div>
    );
  } else if (saved.mode === "table" && tablePhase !== "fx") {
    if (tablePhase === "view") {
      const first = Math.max(0, Math.min(tableRow - 1, tableRows.length - 3));
      const current = tableRows[tableRow];
      body = (
        <div className="text-[13px]">
          <table className="w-full table-fixed text-right tabular-nums">
            <thead>
              <tr>
                <th className="w-6" />
                <th className="font-semibold">X</th>
                <th className="font-semibold">f(X)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(first, first + 3).map((row, offset) => (
                <tr key={row.x} className={first + offset === tableRow ? "bg-[#2d3a2b] text-[#c9d6bf]" : ""}>
                  <td className="text-left">{first + offset + 1}</td>
                  <td className="px-1">{formatDecimal(row.x, saved.display).mantissa}</td>
                  <td className="px-1">{row.y === null ? "ERROR" : formatDecimal(row.y, saved.display).mantissa}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {current && (
            <p className="mt-1 text-right text-base">{current.y === null ? copy.mathError : <DecimalText value={current.y} setup={saved.display} eng={null} />}</p>
          )}
        </div>
      );
    } else {
      body = (
        <div>
          <p className="text-[13px]">{copy.tablePrompt[tablePhase]}</p>
          <p className="mt-2 text-right text-xl">{entry.length ? tokensText(entry, false) : formatDecimal(tableSpec[tablePhase], { kind: "norm", n: 1 }).mantissa}</p>
        </div>
      );
    }
  } else {
    body = (
      <>
        <p className="min-h-6 text-[15px] leading-snug" data-testid="calc-input">
          {saved.mode === "table" && "f(X)="}
          {tokensText(input, screen.kind === "input")}
        </p>
        <p className="mt-0.5 min-h-8 text-right text-[22px] leading-none font-medium" data-testid="calc-output" aria-live="polite">
          {screen.kind === "result" && <ResultText shown={screen.shown} setup={saved.display} angle={saved.angle} />}
          {screen.kind === "error" && <span className="text-lg">{screen.message}</span>}
          {screen.kind === "recall" && (
            <span className="text-lg">
              {screen.name}=<DecimalText value={screen.value} setup={saved.display} eng={null} />
            </span>
          )}
        </p>
      </>
    );
  }

  return (
    <div onKeyDown={onKeyDown} title={copy.keyboardHint} className="calc-body rounded-[24px] p-2.5 pt-2 text-white ring-1 ring-black/50 select-none" data-testid="calculator">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="text-[11px] font-extrabold tracking-[0.22em] text-white/85 [text-shadow:0_1px_0_rgba(0,0,0,0.6)]">MEH REAN</span>
        <span className="calc-solar h-3.5 flex-1 rounded-[3px]" aria-hidden="true" />
        <button
          type="button"
          onClick={() => update({ sound: !saved.sound })}
          aria-label={saved.sound ? copy.soundOff : copy.soundOn}
          aria-pressed={saved.sound}
          data-testid="calculator-sound"
          className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          {saved.sound ? <SoundIcon className="h-4 w-4" /> : <MuteIcon className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onOff} aria-label={closeLabel} data-testid="calculator-close" className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
          ✕
        </button>
      </div>
      <p className="mb-1 px-1 text-right text-[8.5px] font-semibold tracking-wide text-white/45 italic">{copy.model}</p>
      <div className="calc-bezel mb-2.5 rounded-xl p-[5px]">
      <div className="calc-lcd rounded-md px-2 py-1 font-mono">
        <p className="flex h-3.5 gap-1.5 text-[9px] font-bold tracking-wide" aria-label={copy.status}>
          {indicators.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </p>
        <div className="min-h-[3.75rem]">{body}</div>
      </div>
      </div>

      {/* SHIFT ALPHA · the arrows · MODE ON, then the keys beside the arrows. */}
      <div className="grid grid-cols-[1fr_1fr_5.5rem_1fr_1fr] items-end gap-x-1.5 gap-y-0.5">
        {TOP_LEFT.slice(0, 2).map((spec) => (
          <Key key={spec.id} spec={spec} onPress={pressKey} />
        ))}
        <div className="calc-pad row-span-2 grid h-[3.75rem] grid-cols-3 grid-rows-3 place-items-center self-center rounded-full">
          <span className="calc-pad-ring col-start-2 row-start-2 h-5 w-5 rounded-full" aria-hidden="true" />
          {[
            ["up", "▲", "col-start-2 row-start-1", copy.arrows.up],
            ["left", "◀", "col-start-1 row-start-2", copy.arrows.left],
            ["right", "▶", "col-start-3 row-start-2", copy.arrows.right],
            ["down", "▼", "col-start-2 row-start-3", copy.arrows.down],
          ].map(([id, label, place, name]) => (
            <button key={id} type="button" aria-label={name} data-key={id} onClick={() => pressKey(id)} className={`${place} h-5 w-6 text-[10px] text-white/80 hover:text-white`}>
              {label}
            </button>
          ))}
        </div>
        {TOP_RIGHT.slice(0, 2).map((spec) => (
          <Key key={spec.id} spec={spec} onPress={pressKey} />
        ))}
        {TOP_LEFT.slice(2).map((spec) => (
          <Key key={spec.id} spec={spec} onPress={pressKey} />
        ))}
        {TOP_RIGHT.slice(2).map((spec) => (
          <Key key={spec.id} spec={spec} onPress={pressKey} />
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-6 gap-x-1.5 gap-y-0.5">
        {FUNCTION_ROWS.flat().map((spec) => (
          <Key key={spec.id} spec={spec} onPress={pressKey} />
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-x-2 gap-y-1">
        {NUMBER_ROWS.flat().map((spec) => (
          <Key key={spec.id} spec={spec} onPress={pressKey} />
        ))}
      </div>
    </div>
  );
}

function statMenuItems(menu: Menu, type: StatType): { id: string; label: string; post?: "xhat" | "xhat1" | "xhat2" | "yhat" }[] {
  const two = type !== "1-var";
  if (menu === "statSum") return [{ id: "sumx2", label: "Σx²" }, { id: "sumx", label: "Σx" }, ...(two ? [{ id: "sumy2", label: "Σy²" }, { id: "sumy", label: "Σy" }, { id: "sumxy", label: "Σxy" }, { id: "sumx3", label: "Σx³" }, { id: "sumx2y", label: "Σx²y" }, { id: "sumx4", label: "Σx⁴" }] : [])];
  if (menu === "statVar") return [{ id: "n", label: "n" }, { id: "xbar", label: "x̄" }, { id: "sigmax", label: "σx" }, { id: "sx", label: "sx" }, ...(two ? [{ id: "ybar", label: "ȳ" }, { id: "sigmay", label: "σy" }, { id: "sy", label: "sy" }] : [])];
  if (menu === "statMinMax") return [{ id: "minx", label: "minX" }, { id: "maxx", label: "maxX" }, ...(two ? [{ id: "miny", label: "minY" }, { id: "maxy", label: "maxY" }] : [])];
  if (type === "quad") return [{ id: "A", label: "A" }, { id: "B", label: "B" }, { id: "C", label: "C" }, { id: "xhat1", label: "x̂₁", post: "xhat1" }, { id: "xhat2", label: "x̂₂", post: "xhat2" }, { id: "yhat", label: "ŷ", post: "yhat" }];
  return [{ id: "A", label: "A" }, { id: "B", label: "B" }, { id: "r", label: "r" }, { id: "xhat", label: "x̂", post: "xhat" }, { id: "yhat", label: "ŷ", post: "yhat" }];
}

function menuItems(menu: Menu, saved: Saved, hypInverse: boolean): string[] {
  const numbered = (labels: string[], from = 1) => labels.map((label, index) => `${index + from}:${label}`);
  switch (menu) {
    case "mode":
      return numbered(["COMP", "STAT", "TABLE"]);
    case "setup":
      return numbered([`Deg${saved.angle === "deg" ? " ✓" : ""}`, `Rad${saved.angle === "rad" ? " ✓" : ""}`, `Gra${saved.angle === "gra" ? " ✓" : ""}`, "Fix", "Sci", "Norm"]);
    case "fix":
      return Array.from({ length: 10 }, (_, n) => `${n}:Fix ${n}`);
    case "sci":
      return Array.from({ length: 10 }, (_, n) => `${n}:Sci ${n === 0 ? 10 : n}`);
    case "norm":
      return numbered(["Norm 1", "Norm 2"]);
    case "hyp":
      return numbered(hypInverse ? ["sinh⁻¹", "cosh⁻¹", "tanh⁻¹"] : ["sinh", "cosh", "tanh", "sinh⁻¹", "cosh⁻¹", "tanh⁻¹"]);
    case "drg":
      return numbered(["°", "ʳ", "ᵍ"]);
    case "clr":
      return numbered(["Setup", "Memory", "All"]);
    case "statType":
      return numbered(STAT_TYPES.map((item) => item.label));
    case "statMenu":
      return numbered(["Type", "Data", "Sum", "Var", ...(saved.statType !== "1-var" ? ["Reg"] : ["—"]), "MinMax"]);
    default:
      return numbered(statMenuItems(menu, saved.statType).map((item) => item.label));
  }
}
