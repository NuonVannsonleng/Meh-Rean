#!/usr/bin/env node
/**
 * The scientific calculator's engine (no database): order of operations,
 * functions, angle units, errors, exact forms (fractions, surds, π), display
 * formats, statistics, regressions and tables, against what the fx-82ES PLUS
 * style calculator gives.
 *
 * Usage: npm run test:calculator
 */
import {
  TOKENS as T,
  evaluate,
  exactForm,
  exactHints,
  formatDecimal,
  formatDms,
  primeFactors,
  statistics,
  table,
  MathError,
  SyntaxError,
} from "../src/lib/calculator/engine.ts";

const results = [];
const check = (name, fn) => {
  try {
    results.push(["✓", name, fn() ?? ""]);
  } catch (error) {
    results.push(["✗", name, String(error?.message ?? error)]);
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const vars = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 };
const ctx = (extra = {}) => ({ angle: "deg", vars: { ...vars }, ans: 0, setup: { kind: "norm", n: 1 }, ...extra });

/** Types a key sequence: digits and . as typed; other items are tokens. */
const keys = (...items) =>
  items.flatMap((item) => (typeof item === "string" ? [...item].map((ch) => (ch === "." ? T.point : T.digit(ch))) : [item]));
const calc = (tokens, extra) => evaluate(tokens, ctx(extra)).value;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const errorOf = (tokens, extra) => {
  try {
    calc(tokens, extra);
    return "none";
  } catch (error) {
    return error instanceof MathError ? "Math" : error instanceof SyntaxError ? "Syntax" : String(error);
  }
};
const show = (value, tokens = [], angle = "deg") => {
  const exact = exactForm(value, exactHints(tokens, angle));
  if (exact) return `${exact.negative ? "-" : ""}${exact.num === 1 && (exact.root > 1 || exact.pi) ? "" : exact.num}${exact.root > 1 ? `√${exact.root}` : ""}${exact.pi ? "π" : ""}${exact.den > 1 ? `/${exact.den}` : ""}`;
  const d = formatDecimal(value, { kind: "norm", n: 1 });
  return d.exponent === null ? d.mantissa : `${d.mantissa}×10^${d.exponent}`;
};

check("order of operations: 2+3×4 = 14, (2+3)×4 = 20, 2^(3)^(2) = 64", () => {
  assert(calc(keys("2", T.plus, "3", T.times, "4")) === 14, "2+3×4");
  assert(calc(keys(T.open, "2", T.plus, "3", T.close, T.times, "4")) === 20, "(2+3)×4");
  assert(calc(keys("2", T.power, "3", T.close, T.power, "2", T.close)) === 64, "2^3^2");
});

check("(−) binds below powers: -2² = -4; (-2)² = 4", () => {
  assert(calc(keys(T.neg, "2", T.square)) === -4, String(calc(keys(T.neg, "2", T.square))));
  assert(calc(keys(T.open, T.neg, "2", T.close, T.square)) === 4, "(-2)²");
});

check("implied multiplication has the priority of × and ÷: 1÷2π = π/2", () => {
  const tokens = keys("1", T.divide, "2", T.pi);
  assert(near(calc(tokens), Math.PI / 2), String(calc(tokens)));
  assert(calc(keys("2", T.open, "3", T.plus, "4", T.close)) === 14, "2(3+4)");
  assert(calc(keys("3", T.variable("A")), { vars: { ...vars, A: 5 } }) === 15, "3A");
});

check("missing closing brackets at the end are allowed: √(4 = 2, sin(30 = 0.5", () => {
  assert(calc(keys(T.fn("sqrt"), "4")) === 2, "√(4");
  assert(calc(keys(T.fn("sin"), "30")) === 0.5, "sin(30");
});

check("the photo's sum: 2√3÷3 + 6÷(3√3) shows 4√3/3", () => {
  const tokens = keys("2", T.fn("sqrt"), "3", T.close, T.fraction, "3", T.plus, "6", T.fraction, T.open, "3", T.fn("sqrt"), "3", T.close, T.close);
  const value = calc(tokens);
  assert(show(value, tokens) === "4√3/3", show(value, tokens));
  return `${value} → ${show(value, tokens)}`;
});

check("fractions: 1⌟3 + 1⌟6 = 1/2; 0.1+0.2 = 3/10; mixed 1⌟1⌟2 = 3/2", () => {
  assert(show(calc(keys("1", T.fraction, "3", T.plus, "1", T.fraction, "6"))) === "1/2", "1/3+1/6");
  assert(show(calc(keys(".1", T.plus, ".2"))) === "3/10", show(calc(keys(".1", T.plus, ".2"))));
  assert(calc(keys("1", T.fraction, "1", T.fraction, "2")) === 1.5, "mixed");
});

check("trig in degrees is exact on the axes; tan 90° is a Math ERROR", () => {
  assert(calc(keys(T.fn("sin"), "180", T.close)) === 0, "sin180");
  assert(calc(keys(T.fn("cos"), "90", T.close)) === 0, "cos90");
  assert(calc(keys(T.fn("cos"), "60", T.close)) === 0.5, "cos60");
  assert(errorOf(keys(T.fn("tan"), "90", T.close)) === "Math", "tan90");
  assert(calc(keys(T.fn("asin"), ".5", T.close)) === 30, "asin0.5");
});

check("radians: sin π = 0; sin⁻¹(1/2) = π/6 shown exactly", () => {
  assert(calc(keys(T.fn("sin"), T.pi, T.close), { angle: "rad" }) === 0, "sin π");
  const tokens = keys(T.fn("asin"), "1", T.fraction, "2", T.close);
  assert(show(calc(tokens, { angle: "rad" }), tokens, "rad") === "π/6", show(calc(tokens, { angle: "rad" }), tokens, "rad"));
  assert(near(calc(keys(T.fn("sin"), "100", T.close), { angle: "gra" }), 1), "sin 100 grad");
});

check("angle marks (DRG►): in Rad mode, 180° = π", () => {
  assert(near(calc(keys("180", T.drg("deg")), { angle: "rad" }), Math.PI), "180° in rad");
});

check("logs and exponentials: log 1000 = 3, log(2,8) = 3, ln e = 1, 10^(2) = 100, e^(0) = 1", () => {
  assert(calc(keys(T.fn("log"), "1000")) === 3, "log");
  assert(calc(keys(T.fn("log"), "2", T.comma, "8", T.close)) === 3, "log(2,8)");
  assert(calc(keys(T.fn("ln"), T.e)) === 1, "ln e");
  assert(calc(keys(T.fn("pow10"), "2")) === 100, "10^2");
  assert(calc(keys(T.fn("exp"), "0")) === 1, "e^0");
  assert(errorOf(keys(T.fn("log"), "0")) === "Math", "log 0");
});

check("roots and powers: ³√(-8) = -2, 3ˣ√(27) = 3, (-8)^(1/3) = -2, x⁻¹, x³", () => {
  assert(calc(keys(T.fn("cbrt"), T.neg, "8")) === -2, "cbrt");
  assert(calc(keys("3", T.xroot, "27", T.close)) === 3, "xroot");
  assert(calc(keys(T.open, T.neg, "8", T.close, T.power, "1", T.fraction, "3", T.close)) === -2, "(-8)^(1/3)");
  assert(calc(keys("4", T.inverse)) === 0.25, "4⁻¹");
  assert(calc(keys("3", T.cube)) === 27, "3³");
  assert(errorOf(keys(T.fn("sqrt"), T.neg, "4")) === "Math", "√-4");
});

check("x!, nPr, nCr, %, Abs, hyperbolic", () => {
  assert(calc(keys("5", T.factorial)) === 120, "5!");
  assert(errorOf(keys("70", T.factorial)) === "Math", "70!");
  assert(calc(keys("5", T.npr, "2")) === 20, "5P2");
  assert(calc(keys("5", T.ncr, "2")) === 10, "5C2");
  assert(calc(keys("200", T.times, "15", T.percent)) === 30, "200×15%");
  assert(calc(keys(T.fn("abs"), T.neg, "7")) === 7, "Abs");
  assert(near(calc(keys(T.fn("sinh"), "1")), Math.sinh(1)), "sinh");
  assert(near(calc(keys(T.fn("acosh"), "2")), Math.acosh(2)), "acosh");
});

check("degrees, minutes, seconds: 2°30°0° = 2.5; 2.5 shows 2°30°0°", () => {
  assert(calc(keys("2", T.dms, "30", T.dms, "0", T.dms)) === 2.5, String(calc(keys("2", T.dms, "30", T.dms, "0", T.dms))));
  assert(formatDms(2.5) === "2°30°0°", formatDms(2.5));
});

check("Pol(1,1) = r √2, θ 45; Rec(2,60) = X 1, Y √3", () => {
  const pol = evaluate(keys(T.fn("pol"), "1", T.comma, "1", T.close), ctx());
  assert(near(pol.pair.values[0], Math.SQRT2) && pol.pair.values[1] === 45, JSON.stringify(pol.pair));
  const rec = evaluate(keys(T.fn("rec"), "2", T.comma, "60", T.close), ctx());
  assert(rec.pair.values[0] === 1 && near(rec.pair.values[1], Math.sqrt(3)), JSON.stringify(rec.pair));
});

check("E notation, Ans and memories", () => {
  assert(calc(keys("2", T.exp, "3")) === 2000, "2E3");
  assert(calc(keys("5", T.exp, T.neg, "2")) === 0.05, "5E-2");
  assert(calc(keys(T.ans, T.times, "2"), { ans: 21 }) === 42, "Ans×2");
  assert(calc(keys(T.variable("M"), T.plus, "1"), { vars: { ...vars, M: 9 } }) === 10, "M+1");
});

check("Rnd( rounds to the display: Fix 2 makes 10÷3 = 3.33", () => {
  assert(calc(keys(T.fn("rnd"), "10", T.divide, "3"), { setup: { kind: "fix", n: 2 } }) === 3.33, "Rnd");
});

check("errors: 1÷0 Math ERROR; 2+× Syntax ERROR; overflow Math ERROR", () => {
  assert(errorOf(keys("1", T.divide, "0")) === "Math", "1/0");
  assert(errorOf(keys("2", T.plus, T.times)) === "Syntax", "2+×");
  assert(errorOf(keys("10", T.exp, "99", T.times, "10")) === "Math", "overflow");
  assert(errorOf(keys("1", T.point, T.point, "2")) === "Syntax", "1..2");
});

check("display: 10 digits, Norm 1 switches below 0.01, Fix and Sci", () => {
  assert(show(1 / 7, []) === "1/7", "1/7 exact");
  assert(JSON.stringify(formatDecimal(1 / 7, { kind: "norm", n: 1 })) === JSON.stringify({ mantissa: "0.1428571429", exponent: null }), "1/7 decimal");
  assert(JSON.stringify(formatDecimal(0.005, { kind: "norm", n: 1 })) === JSON.stringify({ mantissa: "5", exponent: -3 }), "Norm1");
  assert(JSON.stringify(formatDecimal(0.005, { kind: "norm", n: 2 })) === JSON.stringify({ mantissa: "0.005", exponent: null }), "Norm2");
  assert(formatDecimal(2 / 3, { kind: "fix", n: 3 }).mantissa === "0.667", "Fix3");
  assert(JSON.stringify(formatDecimal(12345, { kind: "sci", n: 3 })) === JSON.stringify({ mantissa: "1.23", exponent: 4 }), "Sci3");
  assert(JSON.stringify(formatDecimal(12345, { kind: "norm", n: 1 }, 0)) === JSON.stringify({ mantissa: "12.345", exponent: 3 }), "ENG");
  assert(show(Math.log10(2)) === "0.3010299957", show(Math.log10(2)));
});

check("FACT: 12 = 2²×3", () => {
  assert(JSON.stringify(primeFactors(12)) === "[[2,2],[3,1]]", JSON.stringify(primeFactors(12)));
});

check("STAT 1-VAR: mean, σx, sx", () => {
  const s = statistics({ type: "1-var", rows: [2, 4, 4, 4, 5, 5, 7, 9].map((x) => ({ x, y: 0 })) });
  assert(s.n === 8 && s.xbar === 5 && s.sigmax === 2 && near(s.sx, 2.138089935), JSON.stringify([s.n, s.xbar, s.sigmax, s.sx]));
});

check("STAT A+BX: y = 1 + 2x, r = 1; ŷ(10) = 21 and x̂(7) = 3", () => {
  const stats = { type: "a+bx", rows: [1, 2, 3, 4].map((x) => ({ x, y: 1 + 2 * x })) };
  const s = statistics(stats);
  assert(s.A === 1 && s.B === 2 && s.r === 1, JSON.stringify([s.A, s.B, s.r]));
  assert(calc(keys("10", T.statPost("yhat")), { stats }) === 21, "ŷ");
  assert(calc(keys("7", T.statPost("xhat")), { stats }) === 3, "x̂");
  assert(calc(keys(T.stat("A")), { stats }) === 1, "A from the STAT menu");
});

check("STAT quadratic and exponential regressions", () => {
  const quad = statistics({ type: "quad", rows: [0, 1, 2, 3].map((x) => ({ x, y: 3 - x + 2 * x * x })) });
  assert(near(quad.A, 3) && near(quad.B, -1) && near(quad.C, 2), JSON.stringify([quad.A, quad.B, quad.C]));
  const ex = statistics({ type: "ex", rows: [0, 1, 2].map((x) => ({ x, y: 2 * Math.exp(0.5 * x) })) });
  assert(near(ex.A, 2) && near(ex.B, 0.5), JSON.stringify([ex.A, ex.B]));
  const abx = statistics({ type: "abx", rows: [0, 1, 2].map((x) => ({ x, y: 3 * 2 ** x })) });
  assert(near(abx.A, 3) && near(abx.B, 2), JSON.stringify([abx.A, abx.B]));
});

check("TABLE: f(X) = X² from 1 to 3 step 1; more than 30 rows is refused", () => {
  const rows = table(keys(T.variable("X"), T.square), 1, 3, 1, ctx());
  assert(JSON.stringify(rows) === JSON.stringify([{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 3, y: 9 }]), JSON.stringify(rows));
  let refused = false;
  try {
    table(keys(T.variable("X")), 1, 100, 1, ctx());
  } catch {
    refused = true;
  }
  assert(refused, "100 rows allowed");
});

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
