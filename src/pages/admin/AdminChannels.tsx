import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import { t } from "../../i18n/en";
import { BACII_SUBJECTS } from "../../lib/bacii";
import { CHANNEL_ID_PATTERN } from "../../lib/channels";
import { subjectLabel } from "../../lib/subjects";
import { deleteVideoChannel, getVideoChannels, saveVideoChannel } from "../../services/api";
import type { VideoChannel } from "../../types";

const copy = t.admin.channels;
const EMPTY = { channelId: "", name: "", language: "km" as "km" | "en", subjectKeys: [] as string[], note: "" };

/** BacII → Admin → Trusted channels: whose videos the finder puts first (roadmap 4.3). */
export default function AdminChannels() {
  const [channels, setChannels] = useState<VideoChannel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setFailed(false);
    getVideoChannels()
      .then(setChannels)
      .catch(() => setFailed(true));
  };
  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const channelId = form.channelId.trim();
    if (!CHANNEL_ID_PATTERN.test(channelId)) return setProblem(copy.badId);
    if (!form.name.trim()) return setProblem(copy.needName);
    setProblem(null);
    setSaving(true);
    try {
      await saveVideoChannel({ ...form, channelId, name: form.name.trim(), note: form.note.trim() });
      setForm(EMPTY);
      load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (channel: VideoChannel) => {
    if (!window.confirm(copy.removeConfirm(channel.name))) return;
    await deleteVideoChannel(channel.channelId).catch(() => {});
    load();
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.subtitle}</p>

      <form onSubmit={submit} className="card mb-5 space-y-3 p-4 sm:p-5" aria-labelledby="add-channel">
        <h2 id="add-channel" className="font-display text-ink-900 text-lg font-bold">
          {copy.add}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-ink-700 block text-sm font-medium">
            {copy.channelId}
            <input value={form.channelId} onChange={(event) => setForm({ ...form, channelId: event.target.value })} className="input mt-1 h-10 font-mono" spellCheck={false} />
            <span className="text-ink-500 mt-1 block text-xs font-normal">{copy.channelIdHint}</span>
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.name}
            <input value={form.name} maxLength={100} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input mt-1 h-10" />
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.language}
            <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value as "km" | "en" })} className="input mt-1 h-10">
              <option value="km">{t.questions.languages.km}</option>
              <option value="en">{t.questions.languages.en}</option>
            </select>
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.note}
            <input value={form.note} maxLength={300} onChange={(event) => setForm({ ...form, note: event.target.value })} className="input mt-1 h-10" />
          </label>
        </div>
        <fieldset>
          <legend className="text-ink-700 text-sm font-medium">{copy.subjects}</legend>
          <p className="text-ink-500 mb-1.5 text-xs">{copy.subjectsHint}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {BACII_SUBJECTS.map((subject) => (
              <label key={subject.id} className="text-ink-700 inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.subjectKeys.includes(subject.id)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      subjectKeys: event.target.checked ? [...form.subjectKeys, subject.id] : form.subjectKeys.filter((key) => key !== subject.id),
                    })
                  }
                />
                {subjectLabel(subject.id)}
              </label>
            ))}
          </div>
        </fieldset>
        {problem && (
          <p role="alert" className="text-danger-fg text-sm font-medium">
            {problem}
          </p>
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {copy.save}
        </button>
      </form>

      {failed ? (
        <ErrorState onRetry={load} />
      ) : !channels ? (
        <LoadingState count={2} variant="block" />
      ) : channels.length === 0 ? (
        <p className="card text-ink-700 p-4 text-sm">{copy.none}</p>
      ) : (
        <ul className="card divide-line divide-y">
          {channels.map((channel) => (
            <li key={channel.channelId} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <a
                  href={`https://www.youtube.com/channel/${channel.channelId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-900 text-sm font-semibold hover:underline"
                >
                  {channel.name}
                </a>
                <p className="text-ink-500 text-xs">
                  {`${t.questions.languages[channel.language]} · ${channel.subjectKeys.length ? channel.subjectKeys.map(subjectLabel).join(", ") : copy.allSubjects}`}
                  {channel.note && ` · ${channel.note}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(channel)}
                aria-label={copy.remove(channel.name)}
                className="text-ink-500 hover:text-danger-fg flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
