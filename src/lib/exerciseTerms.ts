// Searches built from an exercise without AI, for when the video finder is
// unavailable. Searching an essay question's own sentence finds nothing
// useful, so: the quoted names first (in essay questions, «…» marks the work
// or the quotation), else the text with its instruction words removed.

/** Words that ask for something rather than name it; no video title has them. */
const INSTRUCTION_WORDS = [
  "ចូរ",
  "ពន្យល់",
  "បកស្រាយ",
  "អធិប្បាយ",
  "វិភាគ",
  "បង្ហាញ",
  "គណនា",
  "ស្រាយបញ្ជាក់",
  "តើ",
  "ហេតុអ្វី",
  "យ៉ាងដូចម្តេច",
  "ដូចម្តេច",
  "អ្វីខ្លះ",
  "ឲ្យ",
  "អោយ",
  "ឱ្យ",
  "លើកឧទាហរណ៍",
  "តាមយោបល់របស់អ្នក",
  "សម្រាប់អ្នក",
];

const ENGLISH_INSTRUCTIONS = /\b(explain|discuss|describe|analy[sz]e|calculate|compute|find|show that|prove|why|how|what|give|write|according to|your opinion)\b/gi;

/** Short quoted phrases («…», “…”, "…"). */
export function quotedTerms(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/[«“"]([^«»“”"\n]{2,40})[»”"]/g)) found.add(match[1].trim());
  return [...found].slice(0, 3);
}

/** The exercise without instruction words, punctuation or extra spaces, cut to a search's length. */
export function searchWords(text: string, max = 60): string {
  let rest = text.replace(/\$[^$]*\$/g, " ");
  for (const word of INSTRUCTION_WORDS) rest = rest.split(word).join(" ");
  rest = rest
    .replace(ENGLISH_INSTRUCTIONS, " ")
    .replace(/[?？!។៕:;,.«»“”"()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return rest.length > max ? rest.slice(0, max).replace(/\s+\S*$/, "") : rest;
}

/** A Khmer and an English YouTube search for the exercise, Khmer first. */
export function fallbackSearches(text: string, subjectKm: string, subjectEn: string): { km: string; en: string; hasWords: boolean } {
  const quoted = quotedTerms(text);
  const words = quoted.length ? quoted.join(" ") : searchWords(text);
  const km = [words, subjectKm, words ? "ថ្នាក់ទី១២" : "បាក់ឌុប ថ្នាក់ទី១២"].filter(Boolean).join(" ");
  const en = [words, subjectEn, words ? "lesson" : "BacII grade 12 lesson"].filter(Boolean).join(" ");
  return { km, en, hasWords: Boolean(words) };
}
