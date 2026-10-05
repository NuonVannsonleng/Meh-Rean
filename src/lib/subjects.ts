import type { Subject } from "../types";

/**
 * A fixed colour per subject, shown as a dot beside a note the way a code host
 * marks a project's language, so a list can be scanned by subject at a glance.
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
