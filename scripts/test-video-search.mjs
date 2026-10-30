#!/usr/bin/env node
/**
 * The video finder's searches and scoring (no network, no database):
 * Khmer searches first, built from key terms rather than the question's own
 * sentence; English only where it helps; the same past-paper exercise and key
 * terms in the title score highest; Shorts sink. Also the no-AI fallback.
 *
 * Usage: npm run test:video-search
 */
import { asciiDigits, planSearches, quotedTerms, scoreVideo } from "../api/bacii-videos.ts";
import { fallbackSearches, searchWords } from "../src/lib/exerciseTerms.ts";

const results = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    results.push(["✓", name, detail ?? ""]);
  } catch (error) {
    results.push(["✗", name, String(error?.message ?? error)]);
  }
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const KHMER = /[ក-៿]/;

// An essay question in Khmer literature; the model's first search copied the question.
const essay = {
  subject: "khmer-literature",
  exercise_text: "ចូរពន្យល់ពីភាពស្មោះត្រង់ក្នុងស្នេហារបស់ទុំ និងទាវ ក្នុងរឿង «ទុំទាវ» តាមយោបល់របស់អ្នក។",
  search_queries: ["ចូរពន្យល់ពីភាពស្មោះត្រង់ក្នុងស្នេហារបស់ទុំ និងទាវ ក្នុងរឿង", "Tum Teav essay"],
  key_terms_km: ["ទុំទាវ", "ភាពស្មោះត្រង់"],
  key_terms_en: ["Tum Teav", "faithfulness"],
  topic_km: "រឿងទុំទាវ",
  topic_en: "The story of Tum Teav",
};

check("an essay: the copied question is dropped; Khmer searches come from the key terms", () => {
  const plan = planSearches(essay);
  assert(plan.length === 2, `${plan.length} searches`);
  assert(plan.every((item) => item.language === "km" && KHMER.test(item.query)), JSON.stringify(plan));
  assert(!plan.some((item) => item.query.startsWith("ចូរ")), "the question's sentence is still searched");
  assert(plan[0].query.includes("ទុំទាវ") && plan[0].query.includes("អក្សរសាស្ត្រខ្មែរ"), plan[0].query);
  return plan.map((item) => item.query).join(" | ");
});

check("Khmer literature and history get no English search", () => {
  const history = planSearches({ subject: "history", search_queries: ["ប្រវត្តិវិទ្យា ថ្នាក់ទី១២ សង្គ្រាមលោកលើកទី២", "World War II grade 12"], key_terms_km: ["សង្គ្រាមលោកលើកទី២"], topic_km: "សង្គ្រាមលោកលើកទី២" });
  assert(history.every((item) => item.language === "km"), JSON.stringify(history));
});

check("mathematics: two Khmer searches first, then one English", () => {
  const plan = planSearches({
    subject: "mathematics",
    search_queries: ["របៀបដោះស្រាយ អាំងតេក្រាលដោយផ្នែក", "integration by parts"],
    key_terms_km: ["អាំងតេក្រាលដោយផ្នែក"],
    key_terms_en: ["integration by parts"],
    topic_km: "អាំងតេក្រាលដោយផ្នែក",
    exercise_text: "Calculate I = ∫ x e^x dx from 0 to 1",
  });
  assert(plan.length === 3, `${plan.length} searches`);
  assert(plan[0].language === "km" && plan[1].language === "km" && plan[2].language === "en", JSON.stringify(plan));
  assert(plan[2].query === "integration by parts", plan[2].query);
});

check("no Khmer search from the model: one is built, and it comes first", () => {
  const plan = planSearches({ subject: "physics", search_queries: ["projectile motion"], key_terms_km: ["ចលនាគ្រាប់កាំភ្លើង"], key_terms_en: ["projectile motion"], topic_km: "ចលនាគ្រាប់កាំភ្លើង" });
  assert(plan[0].language === "km" && plan[0].query.includes("ចលនាគ្រាប់កាំភ្លើង"), JSON.stringify(plan));
  assert(plan.some((item) => item.language === "en"), "English missing");
});

check("no key terms: the quoted work in the question is used", () => {
  assert(JSON.stringify(quotedTerms(essay.exercise_text)) === JSON.stringify(["ទុំទាវ"]), JSON.stringify(quotedTerms(essay.exercise_text)));
  const plan = planSearches({ ...essay, search_queries: [essay.search_queries[0]], key_terms_km: [] });
  assert(plan[0].query.includes("ទុំទាវ"), plan[0].query);
});

check("Khmer digits are read as numbers", () => {
  assert(asciiDigits("កំណែវិញ្ញាសាបាក់ឌុប ២០២៣") === "កំណែវិញ្ញាសាបាក់ឌុប 2023", asciiDigits("២០២៣"));
});

const paper = { key_terms_km: ["អាំងតេក្រាល"], topic_km: "អាំងតេក្រាល", bacii_year: 2023, exercise_number: "2" };
const video = (title, extra = {}) => ({ title, description: "", tags: [], durationSeconds: 900, ...extra });

check("the same past-paper exercise (Khmer digits) scores above another year's", () => {
  const same = scoreVideo(video("កំណែវិញ្ញាសាបាក់ឌុប ២០២៣ គណិតវិទ្យា លំហាត់ទី២ អាំងតេក្រាល"), paper);
  const otherExercise = scoreVideo(video("កំណែវិញ្ញាសាបាក់ឌុប ២០២៣ គណិតវិទ្យា លំហាត់ទី៤"), paper);
  const otherYear = scoreVideo(video("កំណែវិញ្ញាសាបាក់ឌុប ២០២១ គណិតវិទ្យា លំហាត់ទី២"), paper);
  assert(same > otherExercise && otherExercise > otherYear, `${same} / ${otherExercise} / ${otherYear}`);
  return `${same} > ${otherExercise} > ${otherYear}`;
});

check("a key term in the title beats one only in the description; Shorts sink", () => {
  const inTitle = scoreVideo(video("ពន្យល់រឿង ទុំទាវ"), essay);
  const inDescription = scoreVideo(video("អក្សរសាស្ត្រខ្មែរ ថ្នាក់ទី១២", { description: "មេរៀន ទុំទាវ" }), essay);
  const short = scoreVideo(video("ពន្យល់រឿង ទុំទាវ", { durationSeconds: 45 }), essay);
  assert(inTitle > inDescription && inTitle > short, `${inTitle} / ${inDescription} / ${short}`);
});

check("spacing does not matter: 'ទុំ ទាវ' matches 'ទុំទាវ'", () => {
  assert(scoreVideo(video("រឿង ទុំ ទាវ"), essay) >= 3, "not matched");
});

check("fallback without AI: the quoted work, not the essay sentence", () => {
  const { km, en } = fallbackSearches(essay.exercise_text, "អក្សរសាស្ត្រខ្មែរ", "Khmer literature");
  assert(km === "ទុំទាវ អក្សរសាស្ត្រខ្មែរ ថ្នាក់ទី១២", km);
  assert(en.startsWith("ទុំទាវ"), en);
});

check("fallback: instruction words are removed when nothing is quoted", () => {
  const words = searchWords("ចូរពន្យល់ពីមូលហេតុនៃសង្គ្រាមលោកលើកទី២ ។");
  assert(!words.includes("ចូរ") && !words.includes("ពន្យល់") && words.includes("សង្គ្រាមលោកលើកទី២"), words);
  assert(searchWords("Explain why the Angkor empire declined?") === "the Angkor empire declined", searchWords("Explain why the Angkor empire declined?"));
});

check("fallback with only a photo: the subject", () => {
  const { km, hasWords } = fallbackSearches("", "ប្រវត្តិវិទ្យា", "History");
  assert(!hasWords && km === "ប្រវត្តិវិទ្យា បាក់ឌុប ថ្នាក់ទី១២", km);
});

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter(([mark]) => mark === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
