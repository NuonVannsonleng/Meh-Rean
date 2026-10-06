import { t } from "../i18n/en";
import { SUBJECTS, type Subject } from "../types";

/**
 * A fixed colour per main subject, used as a dot and as a note card's spine,
 * so a list can be scanned by subject at a glance.
 */
export const SUBJECT_COLORS: Record<Subject, string> = {
  mathematics: "#3572a5",
  "computer-science": "#f1e05a",
  engineering: "#e34c26",
  physics: "#563d7c",
  chemistry: "#2b7489",
  biology: "#4f9d4a",
  medicine: "#d73a49",
  business: "#b07219",
  economics: "#c6538c",
  languages: "#00add8",
  literature: "#a97bff",
  history: "#8b5a2b",
  arts: "#f97583",
  law: "#555555",
  other: "#8b949e",
};

/**
 * Specific subjects, each filed under one of the 15 main ones. A note stores
 * the specific id (e.g. "anatomy") in the same subject field as a main one;
 * it takes its colour from its main subject and shows up when that main
 * subject is filtered.
 */
const MORE: Record<Subject, [id: string, label: string][]> = {
  mathematics: [
    ["algebra", "Algebra"],
    ["calculus", "Calculus"],
    ["linear-algebra", "Linear Algebra"],
    ["statistics", "Statistics"],
    ["probability", "Probability"],
    ["discrete-mathematics", "Discrete Mathematics"],
    ["geometry", "Geometry"],
    ["trigonometry", "Trigonometry"],
    ["number-theory", "Number Theory"],
    ["differential-equations", "Differential Equations"],
  ],
  "computer-science": [
    ["programming", "Programming"],
    ["data-structures", "Data Structures & Algorithms"],
    ["databases", "Databases"],
    ["web-development", "Web Development"],
    ["mobile-development", "Mobile App Development"],
    ["computer-networks", "Computer Networks"],
    ["operating-systems", "Operating Systems"],
    ["artificial-intelligence", "Artificial Intelligence"],
    ["machine-learning", "Machine Learning"],
    ["data-science", "Data Science"],
    ["cybersecurity", "Cybersecurity"],
    ["software-engineering", "Software Engineering"],
    ["computer-graphics", "Computer Graphics"],
    ["information-technology", "Information Technology"],
  ],
  engineering: [
    ["civil-engineering", "Civil Engineering"],
    ["mechanical-engineering", "Mechanical Engineering"],
    ["electrical-engineering", "Electrical Engineering"],
    ["electronics", "Electronics"],
    ["chemical-engineering", "Chemical Engineering"],
    ["architecture", "Architecture"],
    ["industrial-engineering", "Industrial Engineering"],
    ["environmental-engineering", "Environmental Engineering"],
    ["aerospace-engineering", "Aerospace Engineering"],
    ["robotics", "Robotics"],
    ["telecommunications", "Telecommunications"],
  ],
  physics: [
    ["mechanics", "Mechanics"],
    ["thermodynamics", "Thermodynamics"],
    ["electromagnetism", "Electricity & Magnetism"],
    ["optics", "Optics & Waves"],
    ["quantum-physics", "Quantum Physics"],
    ["astronomy", "Astronomy"],
    ["nuclear-physics", "Nuclear Physics"],
  ],
  chemistry: [
    ["organic-chemistry", "Organic Chemistry"],
    ["inorganic-chemistry", "Inorganic Chemistry"],
    ["physical-chemistry", "Physical Chemistry"],
    ["biochemistry", "Biochemistry"],
    ["analytical-chemistry", "Analytical Chemistry"],
  ],
  biology: [
    ["genetics", "Genetics"],
    ["microbiology", "Microbiology"],
    ["ecology", "Ecology"],
    ["botany", "Botany"],
    ["zoology", "Zoology"],
    ["molecular-biology", "Molecular Biology"],
    ["environmental-science", "Environmental Science"],
    ["earth-science", "Earth Science"],
    ["agriculture", "Agriculture"],
    ["veterinary-science", "Veterinary Science"],
  ],
  medicine: [
    ["anatomy", "Anatomy"],
    ["physiology", "Physiology"],
    ["pharmacology", "Pharmacology"],
    ["pathology", "Pathology"],
    ["nursing", "Nursing"],
    ["dentistry", "Dentistry"],
    ["pharmacy", "Pharmacy"],
    ["public-health", "Public Health"],
    ["nutrition", "Nutrition"],
    ["midwifery", "Midwifery"],
  ],
  business: [
    ["accounting", "Accounting"],
    ["finance", "Finance"],
    ["marketing", "Marketing"],
    ["management", "Management"],
    ["entrepreneurship", "Entrepreneurship"],
    ["human-resources", "Human Resources"],
    ["banking", "Banking"],
    ["hospitality-tourism", "Hospitality & Tourism"],
    ["logistics", "Logistics & Supply Chain"],
    ["international-business", "International Business"],
  ],
  economics: [
    ["microeconomics", "Microeconomics"],
    ["macroeconomics", "Macroeconomics"],
    ["econometrics", "Econometrics"],
    ["development-economics", "Development Economics"],
  ],
  languages: [
    ["english", "English"],
    ["khmer", "Khmer"],
    ["chinese", "Chinese"],
    ["japanese", "Japanese"],
    ["korean", "Korean"],
    ["french", "French"],
    ["german", "German"],
    ["spanish", "Spanish"],
    ["vietnamese", "Vietnamese"],
    ["linguistics", "Linguistics"],
    ["ielts-toefl", "IELTS & TOEFL"],
  ],
  literature: [
    ["khmer-literature", "Khmer Literature"],
    ["english-literature", "English Literature"],
    ["creative-writing", "Creative Writing"],
    ["poetry", "Poetry"],
  ],
  history: [
    ["khmer-history", "Khmer History"],
    ["world-history", "World History"],
    ["asian-history", "Asian History"],
    ["archaeology", "Archaeology"],
  ],
  arts: [
    ["graphic-design", "Graphic Design"],
    ["music", "Music"],
    ["fine-arts", "Fine Arts & Drawing"],
    ["photography", "Photography"],
    ["film-media", "Film & Media"],
    ["fashion-design", "Fashion Design"],
    ["interior-design", "Interior Design"],
    ["animation", "Animation"],
  ],
  law: [
    ["constitutional-law", "Constitutional Law"],
    ["criminal-law", "Criminal Law"],
    ["international-law", "International Law"],
    ["business-law", "Business Law"],
  ],
  other: [
    ["psychology", "Psychology"],
    ["sociology", "Sociology"],
    ["philosophy", "Philosophy"],
    ["political-science", "Political Science"],
    ["international-relations", "International Relations"],
    ["education", "Education & Teaching"],
    ["geography", "Geography"],
    ["journalism", "Journalism"],
    ["communication", "Communication"],
    ["religious-studies", "Religious Studies"],
    ["anthropology", "Anthropology"],
    ["social-work", "Social Work"],
    ["physical-education", "Physical Education"],
    ["morality-civics", "Morality & Civics"],
    ["exam-prep", "Grade 12 Exam Prep"],
    ["study-skills", "Study Skills"],
  ],
};

export interface SubjectEntry {
  id: string;
  label: string;
  category: Subject;
}

/** Every specific subject, grouped in the order of the main ones. */
export const MORE_SUBJECTS: SubjectEntry[] = SUBJECTS.flatMap((category) =>
  MORE[category].map(([id, label]) => ({ id, label, category })),
);

const byId = new Map(MORE_SUBJECTS.map((entry) => [entry.id, entry]));

export function isMainSubject(id: string): id is Subject {
  return (SUBJECTS as readonly string[]).includes(id);
}

/** The main subject a note's subject is filed under. */
export function subjectCategory(id: string): Subject {
  if (isMainSubject(id)) return id;
  return byId.get(id)?.category ?? "other";
}

export function subjectLabel(id: string): string {
  if (isMainSubject(id)) return t.subjects[id];
  // An id this build does not know still reads as words.
  return byId.get(id)?.label ?? id.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function subjectColor(id: string): string {
  return SUBJECT_COLORS[subjectCategory(id)];
}

/** A main subject and every specific subject filed under it, for filtering. */
export function subjectMembers(category: Subject): string[] {
  return [category, ...MORE_SUBJECTS.filter((entry) => entry.category === category).map((entry) => entry.id)];
}
