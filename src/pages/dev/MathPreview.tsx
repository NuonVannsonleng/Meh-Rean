import MathText from "../../components/MathText";

/**
 * Development only (/dev/math): how question text renders, including hostile
 * input. Not part of the production build; see App.tsx.
 */
const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Khmer with inline maths",
    text: "គណនាអាំងតេក្រាល $I = \\int_0^1 x e^x \\, dx$ ដោយប្រើអាំងតេក្រាលដោយផ្នែក។ ដាក់ $u = x$ និង $dv = e^x dx$។",
  },
  {
    label: "Display maths between Khmer lines",
    text: "គេមានអនុគមន៍ $f$ កំណត់ដោយ\n$$f(x) = \\frac{x^2 - 3x + 2}{x - 1}, \\quad x \\neq 1$$\nរកលីមីត $\\lim_{x \\to 1} f(x)$។",
  },
  {
    label: "Complex numbers",
    text: "ចំនួនកុំផ្លិច $z = 1 + i\\sqrt{3}$ មានទម្រង់ត្រីកោណមាត្រ $z = 2\\left(\\cos\\frac{\\pi}{3} + i\\sin\\frac{\\pi}{3}\\right)$។ គណនា $z^{6}$។",
  },
  {
    label: "Matrix and system",
    text: "ដោះស្រាយប្រព័ន្ធ \\[\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}\\]",
  },
  {
    label: "Very wide formula (must scroll inside its box, not the page)",
    text: "$$S = \\sum_{k=1}^{n} \\left( \\frac{1}{k(k+1)} + \\frac{2^k}{3^{k+1}} + \\binom{n}{k} p^k (1-p)^{n-k} + \\int_0^{k} e^{-t^2} \\, dt \\right)$$",
  },
  {
    label: "English, money with an escaped dollar, a stray dollar",
    text: "A book costs \\$12 and a pen \\$3. Find $x$ if $2x + 3 = 12$. This $ is left alone.",
  },
  {
    label: "Hostile: link and HTML commands in maths (must show as errors, not links)",
    text: "Click $\\href{javascript:alert(1)}{here}$ or $\\url{https://example.com}$ or $\\htmlClass{x}{y}$ or $\\includegraphics{https://example.com/a.png}$.",
  },
  {
    label: "Hostile: HTML in the text (must show as text)",
    text: "<img src=x onerror=alert(1)> <b>bold?</b> <script>alert(1)</script> $1 < 2$",
  },
  {
    label: "Broken LaTeX (shown in place, page keeps working)",
    text: "ចម្លើយ $\\frac{1}{$ និង $\\undefinedcommand{x}$ ។",
  },
];

export default function MathPreview() {
  return (
    <div className="container-page max-w-3xl space-y-4 py-6">
      <h1 className="text-ink-900 text-2xl">MathText preview</h1>
      {SAMPLES.map((sample) => (
        <section key={sample.label} className="card p-4" data-sample={sample.label}>
          <h2 className="text-ink-500 mb-2 text-xs font-semibold tracking-wide uppercase">{sample.label}</h2>
          <MathText text={sample.text} className="text-ink-900 text-base" />
        </section>
      ))}
    </div>
  );
}
