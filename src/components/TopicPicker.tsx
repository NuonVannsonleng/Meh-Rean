import { t } from "../i18n/en";
import type { CurriculumChapter } from "../types";

/** A select of every topic, grouped by chapter. */
export default function TopicPicker({
  chapters,
  value,
  onChange,
  label,
  exclude = [],
}: {
  chapters: CurriculumChapter[];
  value: string;
  onChange: (topicId: string) => void;
  label: string;
  exclude?: string[];
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="input h-9 min-w-0 flex-1 text-sm">
      <option value="">{t.learning.chooseTopic}</option>
      {chapters.map((chapter) => (
        <optgroup key={chapter.id} label={`${chapter.number}. ${chapter.nameEn}`}>
          {chapter.topics
            .filter((topic) => !exclude.includes(topic.id))
            .map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.nameEn}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
