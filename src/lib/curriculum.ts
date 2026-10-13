import type { CurriculumChapter, CurriculumSubject, CurriculumTopic, Verification } from "../types";

/**
 * The curriculum seed (src/data/curriculum/*.json) is written nested, the way
 * people read it: version → track → subject → chapter → topic. This turns it
 * into flat rows with stable ids, for the browser-only store and for
 * scripts/build-curriculum-seed.mjs, which writes the same rows to SQL.
 *
 * Plain TypeScript with type-only imports, so Node can run it directly.
 */

interface SeedTopic {
  slug: string;
  nameEn: string;
  nameKm: string;
  verification?: Verification;
}

interface SeedChapter {
  slug: string;
  nameEn: string;
  nameKm: string;
  verification?: Verification;
  source?: string;
  topics?: SeedTopic[];
}

interface SeedSubject {
  subjectKey: string;
  nameEn: string;
  nameKm: string;
  chapters: SeedChapter[];
}

interface SeedTrack {
  key: string;
  nameEn: string;
  nameKm: string;
  subjects: SeedSubject[];
}

export interface CurriculumSeed {
  version: {
    id: string;
    titleEn: string;
    titleKm: string;
    country: string;
    grade: number;
    verification: Verification;
    source: string;
    notes?: string;
  };
  tracks: SeedTrack[];
}

export interface CurriculumTrackRow {
  id: string;
  versionId: string;
  key: string;
  nameEn: string;
  nameKm: string;
  sort: number;
}

export interface FlatCurriculum {
  version: CurriculumSeed["version"];
  tracks: CurriculumTrackRow[];
  subjects: CurriculumSubject[];
  chapters: CurriculumChapter[];
}

const VERIFICATION_VALUES = new Set<string>(["verified", "provisional", "needs-review"]);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KHMER = /[ក-៿]/;

/** Flattens a seed and checks it; throws with every problem found. */
export function flattenCurriculum(seed: CurriculumSeed): FlatCurriculum {
  const problems: string[] = [];
  const ids = new Set<string>();
  const claim = (id: string) => {
    if (ids.has(id)) problems.push(`duplicate id ${id}`);
    ids.add(id);
  };
  const names = (where: string, entry: { nameEn: string; nameKm: string }) => {
    if (!entry.nameEn?.trim()) problems.push(`${where}: missing English name`);
    if (!KHMER.test(entry.nameKm ?? "")) problems.push(`${where}: missing Khmer name`);
  };
  const slug = (where: string, value: string) => {
    if (!SLUG.test(value ?? "")) problems.push(`${where}: bad slug "${value}"`);
  };
  const verification = (where: string, value: string) => {
    if (!VERIFICATION_VALUES.has(value)) problems.push(`${where}: unknown verification "${value}"`);
    return value as Verification;
  };

  const { version } = seed;
  verification(version.id, version.verification);
  const tracks: CurriculumTrackRow[] = [];
  const subjects: CurriculumSubject[] = [];
  const chapters: CurriculumChapter[] = [];

  seed.tracks.forEach((track, trackIndex) => {
    const trackId = `${version.id}-${track.key}`;
    slug(trackId, track.key);
    names(trackId, track);
    claim(trackId);
    tracks.push({ id: trackId, versionId: version.id, key: track.key, nameEn: track.nameEn, nameKm: track.nameKm, sort: trackIndex + 1 });

    track.subjects.forEach((subject, subjectIndex) => {
      const subjectId = `${trackId}-${subject.subjectKey}`;
      slug(subjectId, subject.subjectKey);
      names(subjectId, subject);
      claim(subjectId);
      subjects.push({
        id: subjectId,
        trackId,
        trackKey: track.key,
        trackNameEn: track.nameEn,
        trackNameKm: track.nameKm,
        grade: version.grade,
        subjectKey: subject.subjectKey,
        nameEn: subject.nameEn,
        nameKm: subject.nameKm,
        sort: subjectIndex + 1,
      });

      subject.chapters.forEach((chapter, chapterIndex) => {
        const chapterId = `${subjectId}-${chapter.slug}`;
        slug(chapterId, chapter.slug);
        names(chapterId, chapter);
        claim(chapterId);
        const chapterVerification = verification(chapterId, chapter.verification ?? version.verification);
        const source = chapter.source ?? version.source;
        if (chapterVerification === "verified" && !chapter.source) problems.push(`${chapterId}: verified without its own source`);

        const topics: CurriculumTopic[] = (chapter.topics ?? []).map((topic, topicIndex) => {
          const topicId = `${chapterId}-${topic.slug}`;
          slug(topicId, topic.slug);
          names(topicId, topic);
          claim(topicId);
          const topicVerification = verification(topicId, topic.verification ?? chapterVerification);
          // A topic is never more verified than its chapter.
          if (topicVerification === "verified" && chapterVerification !== "verified") {
            problems.push(`${topicId}: verified inside an unverified chapter`);
          }
          return {
            id: topicId,
            chapterId,
            nameEn: topic.nameEn,
            nameKm: topic.nameKm,
            sort: topicIndex + 1,
            verification: topicVerification,
          };
        });

        chapters.push({
          id: chapterId,
          subjectId,
          number: chapterIndex + 1,
          nameEn: chapter.nameEn,
          nameKm: chapter.nameKm,
          verification: chapterVerification,
          source,
          topics,
        });
      });
    });
  });

  if (problems.length) throw new Error(`Curriculum seed is invalid:\n- ${problems.join("\n- ")}`);
  return { version, tracks, subjects, chapters };
}
