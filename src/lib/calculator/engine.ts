// The scientific calculator's maths: a token list (what the keys type) is
// parsed with the fx-82ES PLUS order of operations and evaluated in floating
// point, rounded to 15 significant digits like the real calculator's internal
// precision. Results are then shown in exact form (a fraction, a surd or a
// multiple of π) when one fits, else as a 10-digit decimal.

export type AngleUnit = "deg" | "rad" | "gra";

/** A key's effect on the input: an id the parser reads and the label the screen shows. */
export interface Token {
  id: string;
  label: string;
}

export class MathError extends Error {}
export class SyntaxError extends Error {}

export const VARIABLES = ["A", "B", "C", "D", "E", "F", "X", "Y", "M"] as const;
export type Variable = (typeof VARIABLES)[number];

export interface StatData {
  type: StatType;
  rows: { x: number; y: number }[];
}

export type StatType = "1-var" | "a+bx" | "quad" | "lnx" | "ex" | "abx" | "axb" | "1/x";

export interface EvalContext {
  angle: AngleUnit;
  vars: Record<Variable, number>;
  ans: number;
  /** Display rounding for Rnd(. */
  setup: DisplaySetup;
  stats?: StatData | null;
  random?: () => number;
}

export type DisplaySetup = { kind: "norm"; n: 1 | 2 } | { kind: "fix"; n: number } | { kind: "sci"; n: number };

// ---------------------------------------------------------------- tokens --

const t = (id: string, label: string): Token => ({ id, label });

/** Every token a key can type. */
export const TOKENS = {
  digit: (d: string) => t(`d:${d}`, d),
  point: t(".", "."),
  exp: t("exp", "E"),
  plus: t("+", "+"),
  minus: t("-", "−"),
  times: t("*", "×"),
  divide: t("/", "÷"),
  fraction: t("frac", "⌟"),
  neg: t("neg", "-"),
  open: t("(", "("),
  close: t(")", ")"),
  comma: t(",", ","),
  power: t("pow", "^("),
  square: t("sq", "²"),
  cube: t("cube", "³"),
  inverse: t("inv", "⁻¹"),
  factorial: t("fact", "!"),
  percent: t("pct", "%"),
  dms: t("dms", "°"),
  xroot: t("xroot", "ˣ√("),
  npr: t("npr", "P"),
  ncr: t("ncr", "C"),
  pi: t("pi", "π"),
  e: t("e", "e"),
  ans: t("ans", "Ans"),
  ranHash: t("ran#", "Ran#"),
  variable: (name: Variable) => t(`var:${name}`, name),
  drg: (unit: AngleUnit) => t(`drg:${unit}`, unit === "deg" ? "°" : unit === "rad" ? "ʳ" : "ᵍ"),
  fn: (name: FunctionName) => t(`fn:${name}`, FUNCTION_LABELS[name]),
  stat: (name: StatVar) => t(`stat:${name}`, STAT_LABELS[name]),
  statPost: (name: "xhat" | "xhat1" | "xhat2" | "yhat") => t(`statpost:${name}`, STAT_LABELS[name]),
};

export type FunctionName =
  | "sin" | "cos" | "tan" | "asin" | "acos" | "atan"
  | "sinh" | "cosh" | "tanh" | "asinh" | "acosh" | "atanh"
  | "sqrt" | "cbrt" | "log" | "ln" | "pow10" | "exp" | "abs" | "pol" | "rec" | "rnd" | "ranint";

const FUNCTION_LABELS: Record<FunctionName, string> = {
  sin: "sin(", cos: "cos(", tan: "tan(", asin: "sin⁻¹(", acos: "cos⁻¹(", atan: "tan⁻¹(",
  sinh: "sinh(", cosh: "cosh(", tanh: "tanh(", asinh: "sinh⁻¹(", acosh: "cosh⁻¹(", atanh: "tanh⁻¹(",
  sqrt: "√(", cbrt: "³√(", log: "log(", ln: "ln(", pow10: "10^(", exp: "e^(", abs: "Abs(",
  pol: "Pol(", rec: "Rec(", rnd: "Rnd(", ranint: "RanInt#(",
};

export type StatVar =
  | "n" | "sumx" | "sumx2" | "sumy" | "sumy2" | "sumxy" | "sumx3" | "sumx2y" | "sumx4"
  | "xbar" | "sigmax" | "sx" | "ybar" | "sigmay" | "sy" | "minx" | "maxx" | "miny" | "maxy"
  | "A" | "B" | "C" | "r";

const STAT_LABELS: Record<StatVar | "xhat" | "xhat1" | "xhat2" | "yhat", string> = {
  n: "n", sumx: "Σx", sumx2: "Σx²", sumy: "Σy", sumy2: "Σy²", sumxy: "Σxy", sumx3: "Σx³", sumx2y: "Σx²y", sumx4: "Σx⁴",
  xbar: "x̄", sigmax: "σx", sx: "sx", ybar: "ȳ", sigmay: "σy", sy: "sy", minx: "minX", maxx: "maxX", miny: "minY", maxy: "maxY",
  A: "A", B: "B", C: "C", r: "r", xhat: "x̂", xhat1: "x̂₁", xhat2: "x̂₂", yhat: "ŷ",
};

// ---------------------------------------------------------------- parser --

type Node =
  | { k: "num"; v: number }
  | { k: "const"; v: "pi" | "e" | "ans" | "ran#" }
  | { k: "var"; v: Variable }
  | { k: "stat"; v: StatVar }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "post"; op: string; a: Node }
  | { k: "fn"; name: FunctionName; args: Node[] };

/** Recursive descent over the tokens, fx-82ES PLUS priorities, highest first:
 * functions and brackets; postfix (x², x⁻¹, x!, °, %, ŷ); powers and roots;
 * fractions; the (−) sign; nPr nCr; × ÷ and implied ×; + −. */
export function parse(tokens: Token[]): Node {
  let i = 0;
  const peek = () => tokens[i]?.id;
  const next = () => tokens[i++];
  const fail = (): never => {
    throw new SyntaxError("Syntax ERROR");
  };

  const startsPrimary = (id: string | undefined) =>
    !!id && (id.startsWith("d:") || id === "." || id === "(" || id.startsWith("fn:") || id.startsWith("var:") || id.startsWith("stat:") || ["pi", "e", "ans", "ran#"].includes(id));

  function number(): Node {
    let text = "";
    while (peek()?.startsWith("d:") || peek() === ".") text += next().id === "." ? "." : tokens[i - 1].id.slice(2);
    if ((text.match(/\./g) ?? []).length > 1 || text === ".") fail();
    let value = Number(text || "1");
    if (peek() === "exp") {
      next();
      let sign = 1;
      if (peek() === "neg" || peek() === "-") {
        next();
        sign = -1;
      }
      let digits = "";
      while (peek()?.startsWith("d:")) digits += next().id.slice(2);
      if (!digits) fail();
      value = value * 10 ** (sign * Number(digits));
    }
    return { k: "num", v: value };
  }

  /** Arguments up to ")" — a missing ")" at the very end is allowed, as on the calculator. */
  function args(): Node[] {
    const list = [expression()];
    while (peek() === ",") {
      next();
      list.push(expression());
    }
    if (peek() === ")") next();
    else if (i < tokens.length) fail();
    return list;
  }

  function primary(): Node {
    const id = peek();
    if (!id) return fail();
    if (id.startsWith("d:") || id === "." || id === "exp") return number();
    if (id === "(") {
      next();
      const inner = args();
      if (inner.length !== 1) fail();
      return inner[0];
    }
    if (id.startsWith("fn:")) {
      next();
      return { k: "fn", name: id.slice(3) as FunctionName, args: args() };
    }
    if (id.startsWith("var:")) {
      next();
      return { k: "var", v: id.slice(4) as Variable };
    }
    if (id.startsWith("stat:")) {
      next();
      return { k: "stat", v: id.slice(5) as StatVar };
    }
    if (id === "pi" || id === "e" || id === "ans" || id === "ran#") {
      next();
      return { k: "const", v: id };
    }
    return fail();
  }

  function postfix(): Node {
    let node = primary();
    for (;;) {
      const id = peek();
      if (id === "sq" || id === "cube" || id === "inv" || id === "fact" || id === "pct" || id?.startsWith("drg:") || id?.startsWith("statpost:")) {
        next();
        node = { k: "post", op: id, a: node };
      } else if (id === "dms") {
        // a°b°c°: degrees, minutes, seconds.
        next();
        let value: Node = node;
        let scale = 60;
        while (peek()?.startsWith("d:") || peek() === ".") {
          const save = i;
          const part = number();
          if (peek() !== "dms") {
            i = save;
            break;
          }
          next();
          value = { k: "bin", op: "+", a: value, b: { k: "bin", op: "/", a: part, b: { k: "num", v: scale } } };
          scale *= 60;
        }
        node = value;
      } else break;
    }
    return node;
  }

  function power(): Node {
    const base = postfix();
    if (peek() === "pow") {
      next();
      const exponent = args();
      if (exponent.length !== 1) fail();
      // Left to right, as on this model: 2^(3)^(2) = 64.
      let node: Node = { k: "bin", op: "^", a: base, b: exponent[0] };
      while (peek() === "sq" || peek() === "cube" || peek() === "inv" || peek() === "fact" || peek() === "pct") node = { k: "post", op: next().id, a: node };
      return peek() === "pow" || peek() === "xroot" ? continuePower(node) : node;
    }
    if (peek() === "xroot") return continuePower(base);
    return base;
  }

  function continuePower(left: Node): Node {
    const id = next().id;
    const right = args();
    if (right.length !== 1) fail();
    const node: Node = id === "pow" ? { k: "bin", op: "^", a: left, b: right[0] } : { k: "bin", op: "xroot", a: left, b: right[0] };
    return peek() === "pow" || peek() === "xroot" ? continuePower(node) : node;
  }

  function fraction(): Node {
    let node = power();
    while (peek() === "frac") {
      next();
      const denominator = power();
      // a⌟b⌟c is the mixed number a b/c.
      if (peek() === "frac") {
        next();
        const third = power();
        node = { k: "bin", op: "+", a: node, b: { k: "bin", op: "/", a: denominator, b: third } };
      } else node = { k: "bin", op: "/", a: node, b: denominator };
    }
    return node;
  }

  function signed(): Node {
    if (peek() === "neg") {
      next();
      return { k: "neg", a: signed() };
    }
    return fraction();
  }

  function permutation(): Node {
    let node = signed();
    while (peek() === "npr" || peek() === "ncr") {
      const op = next().id;
      node = { k: "bin", op, a: node, b: signed() };
    }
    return node;
  }

  function product(): Node {
    let node = permutation();
    for (;;) {
      const id = peek();
      if (id === "*" || id === "/") {
        next();
        node = { k: "bin", op: id, a: node, b: permutation() };
      } else if (startsPrimary(id) || id === "neg") {
        // Implied multiplication, same priority as × and ÷ on this model.
        node = { k: "bin", op: "*", a: node, b: permutation() };
      } else break;
    }
    return node;
  }

  function expression(): Node {
    let node = peek() === "+" || peek() === "-" ? { k: "num", v: 0 } as Node : product();
    while (peek() === "+" || peek() === "-") {
      const op = next().id;
      node = { k: "bin", op, a: node, b: product() };
    }
    return node;
  }

  if (!tokens.length) fail();
  const tree = expression();
  if (i < tokens.length) fail();
  return tree;
}

// ------------------------------------------------------------- evaluation --

const LIMIT = 1e100;

/** 15 significant digits, the calculator's internal precision; kills float noise like 0.1+0.2. */
export function round15(x: number): number {
  return x === 0 ? 0 : Number(x.toPrecision(15));
}

function check(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) >= LIMIT) throw new MathError("Math ERROR");
  return x;
}

const toRad = (x: number, unit: AngleUnit) => (unit === "deg" ? (x * Math.PI) / 180 : unit === "gra" ? (x * Math.PI) / 200 : x);
const fromRad = (x: number, unit: AngleUnit) => (unit === "deg" ? (x * 180) / Math.PI : unit === "gra" ? (x * 200) / Math.PI : x);
const fullTurn = (unit: AngleUnit) => (unit === "deg" ? 360 : unit === "gra" ? 400 : 2 * Math.PI);

/** sin, cos, tan with exact values on the axes, as the calculator gives (sin 180° = 0, tan 90° is an error). */
function trig(name: "sin" | "cos" | "tan", x: number, unit: AngleUnit): number {
  if (Math.abs(x) >= (unit === "rad" ? 1e10 * (Math.PI / 180) : unit === "gra" ? 1e10 * (10 / 9) : 1e10)) throw new MathError("Math ERROR");
  const turn = fullTurn(unit);
  const quarter = turn / 4;
  const reduced = ((x % turn) + turn) % turn;
  const steps = reduced / quarter;
  if (Math.abs(steps - Math.round(steps)) < 1e-12) {
    const q = Math.round(steps) % 4;
    const sin = [0, 1, 0, -1][q];
    const cos = [1, 0, -1, 0][q];
    if (name === "sin") return sin;
    if (name === "cos") return cos;
    if (cos === 0) throw new MathError("Math ERROR");
    return sin / cos;
  }
  const rad = toRad(reduced, unit);
  return name === "sin" ? Math.sin(rad) : name === "cos" ? Math.cos(rad) : Math.tan(rad);
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 69) throw new MathError("Math ERROR");
  let out = 1;
  for (let k = 2; k <= n; k += 1) out *= k;
  return out;
}

function permutations(n: number, r: number, choose: boolean): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n >= 1e10) throw new MathError("Math ERROR");
  let out = 1;
  for (let k = 0; k < r; k += 1) out *= n - k;
  if (choose) {
    let denominator = 1;
    for (let k = 2; k <= r; k += 1) denominator *= k;
    out /= denominator;
  }
  return check(Math.round(out));
}

/** x^y, with real odd roots of negative numbers (as the calculator does for (−8)^(1/3)). */
function pow(x: number, y: number): number {
  if (x === 0 && y <= 0) throw new MathError("Math ERROR");
  if (x < 0 && !Number.isInteger(y)) {
    const inverse = 1 / y;
    if (Number.isInteger(round15(inverse)) && Math.abs(round15(inverse)) % 2 === 1) return -(Math.abs(x) ** y);
    const odd = rationalApprox(y, 99);
    if (odd && odd[1] % 2 === 1) return (odd[0] % 2 === 0 ? 1 : -1) * Math.abs(x) ** y;
    throw new MathError("Math ERROR");
  }
  return x ** y;
}

/** Rounds to the display setting, as Rnd( does. */
export function roundToSetup(x: number, setup: DisplaySetup): number {
  if (x === 0) return 0;
  if (setup.kind === "fix") return round15(Number(x.toFixed(setup.n)));
  if (setup.kind === "sci") return round15(Number(x.toPrecision(Math.max(1, setup.n))));
  return round15(Number(x.toPrecision(10)));
}

export interface EvalResult {
  value: number;
  /** Pol( and Rec( give two values. */
  pair?: { labels: [string, string]; values: [number, number] };
  /** x̂ for a quadratic regression gives two roots. */
}

export function evaluate(tokens: Token[], ctx: EvalContext): EvalResult {
  const tree = parse(tokens);
  let pair: EvalResult["pair"];
  const stats = () => {
    if (!ctx.stats || !ctx.stats.rows.length) throw new MathError("Math ERROR");
    return statistics(ctx.stats);
  };

  const run = (node: Node): number => {
    switch (node.k) {
      case "num":
        return check(node.v);
      case "const":
        if (node.v === "pi") return Math.PI;
        if (node.v === "e") return Math.E;
        if (node.v === "ans") return ctx.ans;
        return Math.floor((ctx.random ?? Math.random)() * 1000) / 1000;
      case "var":
        return ctx.vars[node.v] ?? 0;
      case "stat": {
        const value = stats()[node.v];
        if (value === undefined || !Number.isFinite(value)) throw new MathError("Math ERROR");
        return value;
      }
      case "neg":
        return -run(node.a);
      case "post": {
        const a = run(node.a);
        switch (node.op) {
          case "sq":
            return check(a * a);
          case "cube":
            return check(a * a * a);
          case "inv":
            if (a === 0) throw new MathError("Math ERROR");
            return 1 / a;
          case "fact":
            return check(factorial(round15(a)));
          case "pct":
            return a / 100;
          case "drg:deg":
            return fromRad((a * Math.PI) / 180, ctx.angle);
          case "drg:rad":
            return fromRad(a, ctx.angle);
          case "drg:gra":
            return fromRad((a * Math.PI) / 200, ctx.angle);
          default: {
            const s = stats();
            const name = node.op.slice(9);
            const value = estimate(s, ctx.stats!.type, name, a);
            if (!Number.isFinite(value)) throw new MathError("Math ERROR");
            return value;
          }
        }
      }
      case "bin": {
        const a = run(node.a);
        const b = run(node.b);
        switch (node.op) {
          case "+":
            return check(a + b);
          case "-":
            return check(a - b);
          case "*":
            return check(a * b);
          case "/":
            if (b === 0) throw new MathError("Math ERROR");
            return check(a / b);
          case "^":
            return check(pow(a, b));
          case "xroot":
            if (a === 0) throw new MathError("Math ERROR");
            return check(pow(b, 1 / a));
          case "npr":
            return permutations(round15(a), round15(b), false);
          case "ncr":
            return permutations(round15(a), round15(b), true);
        }
        throw new SyntaxError("Syntax ERROR");
      }
      case "fn": {
        const values = node.args.map(run);
        const [x, y] = values;
        const one = () => {
          if (values.length !== 1) throw new SyntaxError("Syntax ERROR");
          return x;
        };
        switch (node.name) {
          case "sin":
          case "cos":
          case "tan":
            return trig(node.name, one(), ctx.angle);
          case "asin":
          case "acos": {
            const v = one();
            if (v < -1 || v > 1) throw new MathError("Math ERROR");
            return fromRad(node.name === "asin" ? Math.asin(v) : Math.acos(v), ctx.angle);
          }
          case "atan":
            return fromRad(Math.atan(one()), ctx.angle);
          case "sinh":
            return check(Math.sinh(one()));
          case "cosh":
            return check(Math.cosh(one()));
          case "tanh":
            return Math.tanh(one());
          case "asinh":
            return Math.asinh(one());
          case "acosh": {
            const v = one();
            if (v < 1) throw new MathError("Math ERROR");
            return Math.acosh(v);
          }
          case "atanh": {
            const v = one();
            if (v <= -1 || v >= 1) throw new MathError("Math ERROR");
            return Math.atanh(v);
          }
          case "sqrt": {
            const v = one();
            if (v < 0) throw new MathError("Math ERROR");
            return Math.sqrt(v);
          }
          case "cbrt":
            return Math.cbrt(one());
          case "log": {
            // log(x), or log(a,b): log base a of b.
            const [base, value] = values.length === 2 ? [x, y] : [10, x];
            if (values.length > 2 || value <= 0 || base <= 0 || base === 1) throw new MathError("Math ERROR");
            return values.length === 2 ? Math.log(value) / Math.log(base) : Math.log10(value);
          }
          case "ln": {
            const v = one();
            if (v <= 0) throw new MathError("Math ERROR");
            return Math.log(v);
          }
          case "pow10":
            return check(10 ** one());
          case "exp":
            return check(Math.exp(one()));
          case "abs":
            return Math.abs(one());
          case "rnd":
            return roundToSetup(round15(one()), ctx.setup);
          case "ranint": {
            if (values.length !== 2 || !Number.isInteger(x) || !Number.isInteger(y) || x >= y) throw new MathError("Math ERROR");
            return x + Math.floor((ctx.random ?? Math.random)() * (y - x + 1));
          }
          case "pol": {
            if (values.length !== 2) throw new SyntaxError("Syntax ERROR");
            if (x === 0 && y === 0) throw new MathError("Math ERROR");
            const r = Math.hypot(x, y);
            const theta = fromRad(Math.atan2(y, x), ctx.angle);
            pair = { labels: ["r", "θ"], values: [round15(r), round15(theta)] };
            return r;
          }
          case "rec": {
            if (values.length !== 2) throw new SyntaxError("Syntax ERROR");
            const px = x * trig("cos", y, ctx.angle);
            const py = x * trig("sin", y, ctx.angle);
            pair = { labels: ["X", "Y"], values: [round15(px), round15(py)] };
            return px;
          }
        }
      }
    }
    throw new SyntaxError("Syntax ERROR");
  };

  const value = round15(check(run(tree)));
  return { value: Object.is(value, -0) ? 0 : value, pair };
}

// ------------------------------------------------------------- statistics --

export type StatValues = Record<StatVar, number>;

/** Sums, means, deviations and the regression coefficients for the data. */
export function statistics(data: StatData): StatValues {
  const xs = data.rows.map((row) => row.x);
  const ys = data.rows.map((row) => row.y);
  const n = xs.length;
  const sum = (list: number[]) => list.reduce((total, value) => total + value, 0);
  const sumx = sum(xs);
  const sumx2 = sum(xs.map((x) => x * x));
  const sumy = sum(ys);
  const sumy2 = sum(ys.map((y) => y * y));
  const sumxy = sum(xs.map((x, index) => x * ys[index]));
  const xbar = sumx / n;
  const ybar = sumy / n;
  const sigma = (list: number[], mean: number) => Math.sqrt(sum(list.map((value) => (value - mean) ** 2)) / list.length);
  const sample = (list: number[], mean: number) => (list.length > 1 ? Math.sqrt(sum(list.map((value) => (value - mean) ** 2)) / (list.length - 1)) : NaN);
  const out: StatValues = {
    n,
    sumx,
    sumx2,
    sumy,
    sumy2,
    sumxy,
    sumx3: sum(xs.map((x) => x ** 3)),
    sumx2y: sum(xs.map((x, index) => x * x * ys[index])),
    sumx4: sum(xs.map((x) => x ** 4)),
    xbar,
    sigmax: sigma(xs, xbar),
    sx: sample(xs, xbar),
    ybar,
    sigmay: sigma(ys, ybar),
    sy: sample(ys, ybar),
    minx: Math.min(...xs),
    maxx: Math.max(...xs),
    miny: Math.min(...ys),
    maxy: Math.max(...ys),
    A: NaN,
    B: NaN,
    C: NaN,
    r: NaN,
  };
  if (data.type === "1-var") return roundAll(out);
  if (data.type === "quad") {
    // Least squares for y = A + Bx + Cx².
    const m = [
      [n, sumx, sumx2, sumy],
      [sumx, sumx2, out.sumx3, sumxy],
      [sumx2, out.sumx3, out.sumx4, out.sumx2y],
    ];
    const solved = solve3(m);
    if (solved) [out.A, out.B, out.C] = solved;
    return roundAll(out);
  }
  // The other regressions are linear in transformed data.
  const fx = (x: number) => (data.type === "lnx" || data.type === "axb" ? Math.log(x) : data.type === "1/x" ? 1 / x : x);
  const fy = (y: number) => (data.type === "ex" || data.type === "abx" || data.type === "axb" ? Math.log(y) : y);
  const tx = xs.map(fx);
  const ty = ys.map(fy);
  if ([...tx, ...ty].some((value) => !Number.isFinite(value))) return roundAll(out);
  const mx = sum(tx) / n;
  const my = sum(ty) / n;
  const sxx = sum(tx.map((x) => (x - mx) ** 2));
  const syy = sum(ty.map((y) => (y - my) ** 2));
  const sxy = sum(tx.map((x, index) => (x - mx) * (ty[index] - my)));
  const b = sxx === 0 ? NaN : sxy / sxx;
  const a = my - b * mx;
  out.r = sxx === 0 || syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
  if (data.type === "ex" || data.type === "axb") {
    out.A = Math.exp(a);
    out.B = b;
  } else if (data.type === "abx") {
    out.A = Math.exp(a);
    out.B = Math.exp(b);
  } else {
    out.A = a;
    out.B = b;
  }
  return roundAll(out);
}

function roundAll(values: StatValues): StatValues {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number.isFinite(value) ? round15(value) : value])) as StatValues;
}

function solve3(m: number[][]): [number, number, number] | null {
  const a = m.map((row) => [...row]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k < 4; k += 1) a[row][k] -= factor * a[col][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/** ŷ from x, or x̂ from y, for the regression type. */
function estimate(s: StatValues, type: StatType, name: string, v: number): number {
  const { A, B, C } = s;
  if (name === "yhat") {
    switch (type) {
      case "a+bx":
        return A + B * v;
      case "quad":
        return A + B * v + C * v * v;
      case "lnx":
        return A + B * Math.log(v);
      case "ex":
        return A * Math.exp(B * v);
      case "abx":
        return A * B ** v;
      case "axb":
        return A * v ** B;
      case "1/x":
        return A + B / v;
    }
    return NaN;
  }
  switch (type) {
    case "a+bx":
      return (v - A) / B;
    case "lnx":
      return Math.exp((v - A) / B);
    case "ex":
      return Math.log(v / A) / B;
    case "abx":
      return Math.log(v / A) / Math.log(B);
    case "axb":
      return (v / A) ** (1 / B);
    case "1/x":
      return B / (v - A);
    case "quad": {
      const disc = B * B - 4 * C * (A - v);
      if (disc < 0) return NaN;
      const root = Math.sqrt(disc);
      return name === "xhat2" ? (-B - root) / (2 * C) : (-B + root) / (2 * C);
    }
  }
  return NaN;
}

// ------------------------------------------------------------------ tables --

/** TABLE mode: f(X) from start to end by step, at most 30 rows like the calculator. */
export function table(fx: Token[], start: number, end: number, step: number, ctx: EvalContext): { x: number; y: number | null }[] {
  if (step <= 0 || end < start) throw new MathError("Math ERROR");
  const count = Math.floor(round15((end - start) / step)) + 1;
  if (count > 30) throw new MathError("Insufficient MEM");
  const rows: { x: number; y: number | null }[] = [];
  for (let k = 0; k < count; k += 1) {
    const x = round15(start + k * step);
    let y: number | null;
    try {
      y = evaluate(fx, { ...ctx, vars: { ...ctx.vars, X: x } }).value;
    } catch {
      y = null;
    }
    rows.push({ x, y });
  }
  return rows;
}

// ---------------------------------------------------------------- display --

/** The best rational approximation p/q (q ≤ maxDen) with continued fractions, or null. */
export function rationalApprox(x: number, maxDen = 1e6): [number, number] | null {
  if (!Number.isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  let value = Math.abs(x);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  for (let step = 0; step < 40; step += 1) {
    const a = Math.floor(value);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    if (Math.abs(Math.abs(x) - h1 / k1) <= 1e-12 * Math.max(1, Math.abs(x))) return [sign * h1, k1];
    const rest = value - a;
    if (rest < 1e-15) break;
    value = 1 / rest;
  }
  return null;
}

const digitCount = (n: number) => String(Math.abs(n)).length;

/** n = k²·m with m square-free. */
function simplifyRoot(n: number): [number, number] {
  let k = 1;
  let m = n;
  for (let f = 2; f * f <= m; f += 1) {
    while (m % (f * f) === 0) {
      m /= f * f;
      k *= f;
    }
  }
  return [k, m];
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** An exact result: sign · (num · √root · π?) / den. */
export interface Exact {
  negative: boolean;
  num: number;
  den: number;
  root: number;
  pi: boolean;
}

/**
 * The exact form the calculator would show: a fraction (at most 10 digits in
 * all), a surd when the input had a root, a multiple of π when it had π or an
 * inverse trig function in radians. Null when only a decimal fits.
 */
export function exactForm(value: number, hints: { roots: boolean; pi: boolean }): Exact | null {
  if (value === 0 || Math.abs(value) >= 1e10 || Number.isInteger(value)) return null;
  const fraction = rationalApprox(value);
  if (fraction && digitCount(fraction[0]) + digitCount(fraction[1]) <= 10 && fraction[1] > 1) {
    return { negative: fraction[0] < 0, num: Math.abs(fraction[0]), den: fraction[1], root: 1, pi: false };
  }
  if (hints.roots) {
    const squared = rationalApprox(round15(value * value), 1e5);
    if (squared && squared[0] > 0) {
      const [p, q] = squared;
      const [k, m] = simplifyRoot(p * q);
      if (m > 1) {
        const g = gcd(k, q);
        const num = k / g;
        const den = q / g;
        if (digitCount(num) + digitCount(m) + digitCount(den) <= 10) return { negative: value < 0, num, den, root: m, pi: false };
      }
    }
  }
  if (hints.pi) {
    const multiple = rationalApprox(round15(value / Math.PI), 1000);
    if (multiple && multiple[0] !== 0) return { negative: multiple[0] < 0, num: Math.abs(multiple[0]), den: multiple[1], root: 1, pi: true };
  }
  return null;
}

/** A decimal as the screen shows it: mantissa and an optional ×10 exponent. */
export interface Decimal {
  mantissa: string;
  exponent: number | null;
}

const trimZeros = (text: string) => (text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text);

/** 10 significant digits; Norm 1 switches to ×10ⁿ below 0.01, Norm 2 below 10⁻⁹; Fix and Sci as set. */
export function formatDecimal(value: number, setup: DisplaySetup, engShift: number | null = null): Decimal {
  if (engShift !== null) {
    if (value === 0) return { mantissa: "0", exponent: 0 };
    const exp = Math.floor(Math.log10(Math.abs(value)) / 3) * 3 + engShift;
    return { mantissa: trimZeros(round15(value / 10 ** exp).toPrecision(10)), exponent: exp };
  }
  if (value === 0) return { mantissa: setup.kind === "fix" ? (0).toFixed(setup.n) : "0", exponent: null };
  const abs = Math.abs(value);
  if (setup.kind === "sci") {
    const [m, e] = value.toExponential(Math.max(0, setup.n - 1)).split("e");
    return { mantissa: m, exponent: Number(e) };
  }
  if (setup.kind === "fix" && abs < 1e10) {
    const fixed = value.toFixed(setup.n);
    if (Number(fixed) !== 0 || abs >= 10 ** -setup.n) return { mantissa: fixed, exponent: null };
  }
  const small = setup.kind === "norm" && setup.n === 2 ? 1e-9 : 1e-2;
  if (abs >= 1e10 || abs < small) {
    const [m, e] = value.toExponential(9).split("e");
    return { mantissa: trimZeros(m), exponent: Number(e) };
  }
  return { mantissa: trimZeros(value.toPrecision(10)).replace(/e.*$/, ""), exponent: null };
}

/** As degrees, minutes and seconds (the °'" key on a result). */
export function formatDms(value: number): string {
  const sign = value < 0 ? "-" : "";
  let abs = Math.abs(value);
  let d = Math.floor(abs);
  abs = (abs - d) * 60;
  let m = Math.floor(abs + 1e-9);
  let s = round15((abs - m) * 60);
  s = Math.round(s * 100) / 100;
  if (s >= 60) {
    s -= 60;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    d += 1;
  }
  return `${sign}${d}°${m}°${trimZeros(s.toFixed(2))}°`;
}

/** Prime factors (FACT) of a whole number below 10¹⁰, e.g. [[2, 2], [3, 1]] for 12. */
export function primeFactors(n: number): [number, number][] | null {
  if (!Number.isInteger(n) || n < 2 || n >= 1e10) return null;
  const out: [number, number][] = [];
  let rest = n;
  for (let p = 2; p * p <= rest; p += p === 2 ? 1 : 2) {
    let count = 0;
    while (rest % p === 0) {
      rest /= p;
      count += 1;
    }
    if (count) out.push([p, count]);
  }
  if (rest > 1) out.push([rest, 1]);
  return out;
}

/** Whether the input asks for surd or π forms (see exactForm). */
export function exactHints(tokens: Token[], angle: AngleUnit): { roots: boolean; pi: boolean } {
  const ids = tokens.map((token) => token.id);
  return {
    roots: ids.some((id) => id === "fn:sqrt" || id === "xroot" || id === "fn:cbrt" || id === "pow"),
    pi: ids.includes("pi") || (angle === "rad" && ids.some((id) => id === "fn:asin" || id === "fn:acos" || id === "fn:atan")),
  };
}
