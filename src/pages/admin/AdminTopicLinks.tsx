import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, TrashIcon } from "../../components/Icons";
import TopicPicker from "../../components/TopicPicker";
import VerificationBadge from "../../components/VerificationBadge";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { deleteConceptLink, getConceptLinks, saveConceptLink, updateConceptLink } from "../../services/api";
import type { ConceptLink, Verification } from "../../types";

const copy = t.learning.topicLinks;

function LinkRow({ link, name, onChange, onRemove }: { link: ConceptLink; name: (id: string) => string; onChange: (next: ConceptLink) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [verification, setVerification] = useState<Verification>(link.verification);
  const [source, setSource] = useState(link.source);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (verification === "verified" && !source.trim()) return setProblem(copy.needSource);
    try {
      onChange(await updateConceptLink(link.id, { verification, source }));
      setEditing(false);
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-900 min-w-0 flex-1 text-sm">
          {name(link.fromTopic)} <span className="text-ink-500">{link.kind === "prerequisite" ? "→" : "↔"}</span> {name(link.toTopic)}
        </span>
        <VerificationBadge value={link.verification} />
        <button type="button" onClick={() => setEditing(!editing)} className="btn-ghost h-8 px-2 text-xs">
          {copy.check}
        </button>
        <button type="button" onClick={onRemove} aria-label={copy.remove(`${name(link.fromTopic)} – ${name(link.toTopic)}`)} className="text-ink-500 hover:text-danger-fg flex h-8 w-8 items-center justify-center">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      {link.source && !editing && <p className="text-ink-500 mt-1 text-xs">{copy.sourceLine(link.source)}</p>}
      {editing && (
        <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-2">
          <select value={verification} onChange={(event) => setVerification(event.target.value as Verification)} aria-label={copy.status} className="input h-9 w-auto text-sm">
            <option value="provisional">{t.questions.verification.provisional}</option>
            <option value="needs-review">{t.questions.verification["needs-review"]}</option>
            <option value="verified">{t.questions.verification.verified}</option>
          </select>
          <input value={source} onChange={(event) => setSource(event.target.value)} placeholder={copy.sourcePlaceholder} aria-label={copy.source} className="input h-9 min-w-0 flex-1 text-sm" />
          <button type="submit" className="btn-primary h-9 px-3 text-sm">
            {copy.save}
          </button>
          {problem && (
            <p role="alert" className="text-danger-fg w-full text-xs font-medium">
              {problem}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

/** BacII → Admin → Topic links (Learning OS 2.4): the knowledge graph's prerequisites and related topics. */
export default function AdminTopicLinks() {
  const { chapters } = useCurriculum();
  const [links, setLinks] = useState<ConceptLink[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<ConceptLink["kind"]>("prerequisite");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    getConceptLinks().then(setLinks).catch(() => {});
  }, []);

  const names = useMemo(
    () => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, `${chapter.number}. ${topic.nameEn}`] as const))),
    [chapters],
  );
  const order = useMemo(() => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => topic.id)).map((id, index) => [id, index])), [chapters]);
  const name = (id: string) => names.get(id) ?? id;
  const sorted = [...links].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "prerequisite" ? -1 : 1) || (order.get(a.fromTopic) ?? 0) - (order.get(b.fromTopic) ?? 0) || (order.get(a.toTopic) ?? 0) - (order.get(b.toTopic) ?? 0));

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!from || !to) return setProblem(copy.needBoth);
    setProblem(null);
    try {
      const link = await saveConceptLink({ fromTopic: from, toTopic: to, kind });
      setLinks([...links, link]);
      setFrom("");
      setTo("");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async (link: ConceptLink) => {
    if (!window.confirm(copy.removeConfirm)) return;
    setLinks(links.filter((item) => item.id !== link.id));
    await deleteConceptLink(link.id).catch(() => setLinks(links));
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.subtitle}</p>

      <form onSubmit={add} className="card mb-5 space-y-3 p-4 sm:p-5">
        <div className="flex gap-2">
          <TopicPicker chapters={chapters} value={from} onChange={setFrom} label={copy.from} />
        </div>
        <select value={kind} onChange={(event) => setKind(event.target.value as ConceptLink["kind"])} aria-label={copy.kind} className="input h-9 w-auto text-sm">
          <option value="prerequisite">{copy.kinds.prerequisite}</option>
          <option value="related">{copy.kinds.related}</option>
        </select>
        <div className="flex gap-2">
          <TopicPicker chapters={chapters} value={to} onChange={setTo} label={copy.to} />
        </div>
        {problem && (
          <p role="alert" className="text-danger-fg text-sm font-medium">
            {problem}
          </p>
        )}
        <button type="submit" className="btn-primary">
          {copy.add}
        </button>
      </form>

      <p className="text-ink-500 mb-2 text-xs">{copy.count(links.length)}</p>
      <ul className="card divide-line divide-y">
        {sorted.map((link) => (
          <LinkRow key={link.id} link={link} name={name} onChange={(next) => setLinks(links.map((item) => (item.id === next.id ? next : item)))} onRemove={() => void remove(link)} />
        ))}
      </ul>
    </div>
  );
}
