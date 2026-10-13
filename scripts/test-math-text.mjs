#!/usr/bin/env node
/**
 * Unit checks for src/lib/mathText.ts (roadmap task 1.3).
 *
 *   npm run test:math
 */

import { hasKhmer, splitMath } from "../src/lib/mathText.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}

const text = (value) => ({ kind: "text", value });
const inline = (value) => ({ kind: "math", value, display: false });
const display = (value) => ({ kind: "math", value, display: true });

check("plain text stays one piece", splitMath("សួស្តី world"), [text("សួស្តី world")]);
check("Khmer with inline maths", splitMath("គណនា $x^2$ ។"), [text("គណនា "), inline("x^2"), text(" ។")]);
check("$$…$$ is display maths", splitMath("a $$\\int_0^1 x\\,dx$$ b"), [text("a "), display("\\int_0^1 x\\,dx"), text(" b")]);
check("\\(…\\) is inline, \\[…\\] is display", splitMath("\\(a\\) and \\[b\\]"), [inline("a"), text(" and "), display("b")]);
check("two inline formulas", splitMath("$a$ $b$"), [inline("a"), text(" "), inline("b")]);
check("back-to-back inline formulas are not $$", splitMath("$a$$b$"), [inline("a"), inline("b")]);
check("\\$ is a literal dollar", splitMath("costs \\$12 and \\$3"), [text("costs $12 and $3")]);
check("an escaped dollar inside maths does not close it", splitMath("$a \\$ b$"), [inline("a \\$ b")]);
check("an unclosed $ stays text", splitMath("This $ is left alone"), [text("This $ is left alone")]);
check("an unclosed $$ stays text", splitMath("$$x + 1"), [text("$$x + 1")]);
check("empty maths stays text", [splitMath("a $ $ b"), splitMath("$$$$")], [[text("a $ $ b")], [text("$$$$")]]);
check("maths is trimmed", splitMath("$  x + 1  $"), [inline("x + 1")]);
check("line breaks are kept in text", splitMath("line 1\nline 2 $x$"), [text("line 1\nline 2 "), inline("x")]);
check("one line break around display maths is dropped", splitMath("a\n$$x$$\nb\n\n$$y$$"), [text("a"), display("x"), text("b\n"), display("y")]);
check("HTML stays text (never parsed)", splitMath("<b>x</b> $1<2$"), [text("<b>x</b> "), inline("1<2")]);
check("a 5000-character formula is not treated as maths", splitMath(`$${"x".repeat(5000)}$`).length, 1);
check("hasKhmer finds Khmer letters", [hasKhmer("គណិតវិទ្យា"), hasKhmer("Maths"), hasKhmer("x = ១២")], [true, false, true]);

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
