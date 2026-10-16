// Knowledge graph rules (Learning OS 1.1): topics are the concepts, linked
// by prerequisites and "related" links. The same checks run in the database
// (guard_concept_link) and in scripts/test-concept-links.mjs.

export type ConceptLinkKind = "prerequisite" | "related";

export interface ConceptLinkInput {
  /** For a prerequisite: the topic needed first. */
  fromTopic: string;
  toTopic: string;
  kind: ConceptLinkKind;
}

export interface LinkSeed {
  subjectId: string;
  verification: "provisional" | "verified" | "needs-review";
  source: string;
  links: { from: string; to: string; kind: ConceptLinkKind }[];
}

/** Full topic ids from a seed file's short ids. Related links are stored in a fixed order. */
export function expandLinks(seed: LinkSeed): ConceptLinkInput[] {
  return seed.links.map((link) => {
    const fromTopic = `${seed.subjectId}-${link.from}`;
    const toTopic = `${seed.subjectId}-${link.to}`;
    return link.kind === "related" && toTopic < fromTopic ? { fromTopic: toTopic, toTopic: fromTopic, kind: "related" } : { fromTopic, toTopic, kind: link.kind };
  });
}

/** Problems with a set of links: unknown topics, self links, duplicates, prerequisite cycles. */
export function linkProblems(links: ConceptLinkInput[], topicIds: Set<string>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    for (const id of [link.fromTopic, link.toTopic]) if (!topicIds.has(id)) problems.push(`unknown topic ${id}`);
    if (link.fromTopic === link.toTopic) problems.push(`${link.fromTopic} links to itself`);
    const key = `${link.kind}:${link.fromTopic}>${link.toTopic}`;
    if (seen.has(key)) problems.push(`duplicate ${key}`);
    seen.add(key);
  }
  const cycle = findPrerequisiteCycle(links);
  if (cycle) problems.push(`prerequisite cycle: ${cycle.join(" → ")}`);
  return problems;
}

/** A cycle of prerequisites, if there is one (a topic needed for itself). */
export function findPrerequisiteCycle(links: ConceptLinkInput[]): string[] | null {
  const next = new Map<string, string[]>();
  for (const link of links) if (link.kind === "prerequisite") next.set(link.fromTopic, [...(next.get(link.fromTopic) ?? []), link.toTopic]);
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];
  const visit = (node: string): string[] | null => {
    if (state.get(node) === "done") return null;
    if (state.get(node) === "visiting") return [...path.slice(path.indexOf(node)), node];
    state.set(node, "visiting");
    path.push(node);
    for (const to of next.get(node) ?? []) {
      const found = visit(to);
      if (found) return found;
    }
    path.pop();
    state.set(node, "done");
    return null;
  };
  for (const node of next.keys()) {
    const found = visit(node);
    if (found) return found;
  }
  return null;
}

/** Every prerequisite of a topic, nearest first, at most `depth` steps back. */
export function prerequisitesOf(topicId: string, links: ConceptLinkInput[], depth = 10): { topicId: string; distance: number }[] {
  const before = new Map<string, string[]>();
  for (const link of links) if (link.kind === "prerequisite") before.set(link.toTopic, [...(before.get(link.toTopic) ?? []), link.fromTopic]);
  const found = new Map<string, number>();
  let frontier = [topicId];
  for (let distance = 1; distance <= depth && frontier.length; distance += 1) {
    const nextFrontier: string[] = [];
    for (const node of frontier) {
      for (const prerequisite of before.get(node) ?? []) {
        if (prerequisite === topicId || found.has(prerequisite)) continue;
        found.set(prerequisite, distance);
        nextFrontier.push(prerequisite);
      }
    }
    frontier = nextFrontier;
  }
  return [...found].map(([id, distance]) => ({ topicId: id, distance })).sort((a, b) => a.distance - b.distance || a.topicId.localeCompare(b.topicId));
}

/** Topics that need this one, nearest first, at most `depth` steps on. */
export function dependentsOf(topicId: string, links: ConceptLinkInput[], depth = 10): { topicId: string; distance: number }[] {
  const reversed = links.map((link) => ({ ...link, fromTopic: link.toTopic, toTopic: link.fromTopic }));
  return prerequisitesOf(topicId, reversed, depth);
}

/** Topics linked as "related", in either direction. */
export function relatedTo(topicId: string, links: ConceptLinkInput[]): string[] {
  return links
    .filter((link) => link.kind === "related" && (link.fromTopic === topicId || link.toTopic === topicId))
    .map((link) => (link.fromTopic === topicId ? link.toTopic : link.fromTopic))
    .sort();
}

/**
 * The topics in an order that respects prerequisites, otherwise keeping the
 * curriculum's own order (`topicIds` is given in curriculum order).
 */
export function studyOrder(topicIds: string[], links: ConceptLinkInput[]): string[] {
  const position = new Map(topicIds.map((id, index) => [id, index]));
  const needs = new Map(topicIds.map((id) => [id, 0]));
  const next = new Map<string, string[]>();
  for (const link of links) {
    if (link.kind !== "prerequisite" || !position.has(link.fromTopic) || !position.has(link.toTopic)) continue;
    needs.set(link.toTopic, (needs.get(link.toTopic) ?? 0) + 1);
    next.set(link.fromTopic, [...(next.get(link.fromTopic) ?? []), link.toTopic]);
  }
  const ready = topicIds.filter((id) => needs.get(id) === 0);
  const order: string[] = [];
  while (ready.length) {
    ready.sort((a, b) => position.get(a)! - position.get(b)!);
    const id = ready.shift()!;
    order.push(id);
    for (const to of next.get(id) ?? []) {
      needs.set(to, needs.get(to)! - 1);
      if (needs.get(to) === 0) ready.push(to);
    }
  }
  // A cycle (never stored, but be safe): keep the rest in curriculum order.
  return [...order, ...topicIds.filter((id) => !order.includes(id))];
}

/** How many prerequisite steps lead to each topic (0 for a starting point): the map's columns. */
export function prerequisiteLevels(topicIds: string[], links: ConceptLinkInput[]): Map<string, number> {
  const level = new Map(topicIds.map((id) => [id, 0]));
  for (const id of studyOrder(topicIds, links)) {
    for (const link of links) {
      if (link.kind === "prerequisite" && link.fromTopic === id && level.has(link.toTopic)) {
        level.set(link.toTopic, Math.max(level.get(link.toTopic)!, level.get(id)! + 1));
      }
    }
  }
  return level;
}

/**
 * Prerequisites (at any depth) the student has not shown yet: with too
 * little evidence, or worth more practice. Nearest first.
 */
export function missingPrerequisites(
  topicId: string,
  links: ConceptLinkInput[],
  statusOf: (topicId: string) => "unknown" | "work-on" | "practising" | "going-well",
): { topicId: string; distance: number; status: "unknown" | "work-on" }[] {
  return prerequisitesOf(topicId, links).flatMap((item) => {
    const status = statusOf(item.topicId);
    return status === "unknown" || status === "work-on" ? [{ ...item, status }] : [];
  });
}
