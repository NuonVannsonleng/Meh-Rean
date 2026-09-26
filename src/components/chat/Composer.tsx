import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { useToast } from "../../context/ToastContext";
import { useDismiss } from "../../hooks/useDismiss";
import { canRecordVoice, useVoiceRecorder, type RecordedVoice } from "../../hooks/useVoiceRecorder";
import { t } from "../../i18n/en";
import { MAX_MESSAGE_LENGTH, formatDuration, kindForFile } from "../../lib/chat";
import { errorMessage } from "../../lib/errors";
import { formatFileSize } from "../../lib/format";
import { CloseIcon, FileIcon, ImageIcon, MicIcon, PaperclipIcon, PenIcon, PlusIcon, ReplyIcon, SendIcon, SmileIcon, TrashIcon } from "../Icons";
import EmojiStickerPanel from "./EmojiStickerPanel";

function StagedPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const kind = kindForFile(file);

  useEffect(() => {
    if (kind !== "image") return;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  return (
    <li className="animate-pop border-line bg-surface relative flex h-16 shrink-0 items-center gap-2 overflow-hidden rounded-xl border pr-8">
      {thumb ? (
        <img src={thumb} alt="" className="h-16 w-16 object-cover" />
      ) : (
        <span className="bg-surface-hover text-ink-500 flex h-16 w-12 items-center justify-center">
          {kind === "video" ? <ImageIcon /> : <FileIcon />}
        </span>
      )}
      {!thumb && (
        <span className="max-w-32 min-w-0">
          <span className="text-ink-900 block truncate text-xs font-semibold">{file.name}</span>
          <span className="text-ink-500 block text-[11px]">{formatFileSize(file.size)}</span>
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.messages.removeAttachment(file.name)}
        className="press bg-ink-900/70 absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full text-white"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export interface ComposerProps {
  otherName: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  staged: File[];
  onStage: (files: File[]) => void;
  onUnstage: (index: number) => void;
  replyTo: { name: string; snippet: string } | null;
  onCancelReply: () => void;
  /** Set while an existing message is being edited. */
  editing: { id: string; body: string } | null;
  onCancelEdit: () => void;
  onSendText: (body: string) => void;
  onSendFiles: (caption: string) => void;
  onSendSticker: (sticker: string) => void;
  onSendVoice: (voice: RecordedVoice) => void;
  onSaveEdit: (body: string) => void;
  onTyping: () => void;
  error: string | null;
  onClearError: () => void;
}

export default function Composer({
  otherName,
  inputRef,
  staged,
  onStage,
  onUnstage,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSendText,
  onSendFiles,
  onSendSticker,
  onSendVoice,
  onSaveEdit,
  onTyping,
  error,
  onClearError,
}: ComposerProps) {
  const inputId = useId();
  const panelId = useId();
  const { notify } = useToast();
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, menuOpen, closeMenu);

  const finishRecording = useRef<() => void>(() => {});
  const recorder = useVoiceRecorder(() => finishRecording.current());
  const recording = recorder.state !== "idle";

  finishRecording.current = () => {
    void recorder.stop().then((voice) => {
      if (voice) onSendVoice(voice);
    });
  };

  // Entering edit mode puts the message's text in the box.
  useEffect(() => {
    if (!editing) return;
    setDraft(editing.body);
    setPanelOpen(false);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  }, [editing?.id]);

  const text = draft.trim();
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = !tooLong && (Boolean(text) || (!editing && staged.length > 0));

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    if (editing) onSaveEdit(text);
    else if (staged.length) onSendFiles(text);
    else onSendText(text);
    setDraft("");
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setDraft((current) => current + emoji);
      return;
    }
    const start = input.selectionStart ?? draft.length;
    const end = input.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const startRecording = async () => {
    setPanelOpen(false);
    try {
      await recorder.start();
    } catch (failure) {
      notify(errorMessage(failure));
    }
  };

  const pick = (files: FileList | null) => {
    if (files?.length) onStage([...files]);
    setMenuOpen(false);
  };

  const cancelMode = () => {
    if (editing) {
      onCancelEdit();
      setDraft("");
    } else if (replyTo) onCancelReply();
  };

  const banner = editing
    ? { icon: <PenIcon className="h-4 w-4" />, title: t.messages.editing, detail: editing.body, cancel: t.messages.cancelEdit }
    : replyTo
      ? { icon: <ReplyIcon className="h-4 w-4" />, title: t.messages.replyingTo(replyTo.name), detail: replyTo.snippet, cancel: t.messages.cancelReply }
      : null;

  return (
    <form onSubmit={submit} className="border-line bg-surface shrink-0 border-t">
      {banner && (
        <div className="animate-rise border-line flex items-center gap-2.5 border-b px-4 py-2">
          <span className="text-accent">{banner.icon}</span>
          <span className="min-w-0 flex-1 text-xs">
            <span className="text-ink-900 block font-semibold">{banner.title}</span>
            <span className="text-ink-500 block truncate">{banner.detail}</span>
          </span>
          <button type="button" onClick={cancelMode} aria-label={banner.cancel} className="icon-btn h-8 w-8">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {staged.length > 0 && !editing && (
        <ul className="flex gap-2 overflow-x-auto px-3 pt-2.5 pb-1 sm:px-4">
          {staged.map((file, index) => (
            <StagedPreview key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => onUnstage(index)} />
          ))}
        </ul>
      )}

      {recording ? (
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3" role="group" aria-label={t.messages.recordingLabel(formatDuration(recorder.elapsed))}>
          <button type="button" onClick={recorder.cancel} aria-label={t.messages.cancelRecording} className="icon-btn text-danger-fg h-11 w-11">
            <TrashIcon />
          </button>
          <div className="bg-surface-hover flex h-11 min-w-0 flex-1 items-center gap-3 rounded-3xl px-4">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[var(--color-react-love)]" aria-hidden="true" />
            <span className="text-ink-900 shrink-0 text-sm font-semibold tabular-nums" aria-live="off">
              {formatDuration(recorder.elapsed)}
            </span>
            <span className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden="true">
              {recorder.levels.map((level, index) => (
                <span key={index} className="bg-accent w-[3px] shrink-0 rounded-full" style={{ height: `${Math.max(12, level * 100)}%` }} />
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => finishRecording.current()}
            disabled={recorder.state !== "recording"}
            aria-label={t.messages.sendVoice}
            className="btn-primary h-11 w-11 shrink-0 rounded-full p-0"
          >
            <SendIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5 px-2.5 py-2.5 sm:gap-2 sm:px-4 sm:py-3">
          {!editing && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={t.messages.attachMenu}
                className={`icon-btn h-11 w-11 transition-transform ${menuOpen ? "text-accent rotate-45" : ""}`}
              >
                <PlusIcon />
              </button>
              {menuOpen && (
                <div role="menu" className="card animate-pop absolute bottom-full left-0 z-20 mb-2 w-52 origin-bottom-left p-1.5 shadow-xl">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => mediaInput.current?.click()}
                    className="press text-ink-700 hover:bg-surface-hover flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium"
                  >
                    <ImageIcon className="text-accent h-4.5 w-4.5" />
                    {t.messages.attachPhoto}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => fileInput.current?.click()}
                    className="press text-ink-700 hover:bg-surface-hover flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium"
                  >
                    <PaperclipIcon className="text-accent h-4.5 w-4.5" />
                    {t.messages.attachFile}
                  </button>
                </div>
              )}
              <input
                ref={mediaInput}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(event) => {
                  pick(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  pick(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
          )}

          <div className="relative min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              {t.messages.composerLabel(otherName)}
            </label>
            <textarea
              ref={inputRef}
              id={inputId}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) onClearError();
                if (event.target.value) onTyping();
              }}
              onPaste={(event) => {
                const files = [...event.clipboardData.files];
                if (files.length && !editing) {
                  event.preventDefault();
                  onStage(files);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && (editing || replyTo)) {
                  event.preventDefault();
                  cancelMode();
                  return;
                }
                // Enter sends on keyboards; phones keep Enter for new lines.
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={staged.length && !editing ? t.messages.captionPlaceholder : t.messages.composerPlaceholder}
              rows={1}
              aria-invalid={tooLong || undefined}
              aria-describedby={error || tooLong ? `${inputId}-error` : undefined}
              className="input field-sizing-content h-auto max-h-40 min-h-11 resize-none rounded-3xl py-2.5 pr-11"
            />
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              aria-expanded={panelOpen}
              aria-controls={panelId}
              aria-label={t.messages.emojiAndStickers}
              className={`press absolute right-1.5 bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full ${
                panelOpen ? "text-accent bg-brand-50" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              <SmileIcon />
            </button>
          </div>

          {canSend || editing || !canRecordVoice ? (
            <button
              type="submit"
              disabled={!canSend}
              aria-label={editing ? t.messages.saveEdit : t.messages.send}
              className="btn-primary animate-pop h-11 w-11 shrink-0 rounded-full p-0"
            >
              <SendIcon className="h-4.5 w-4.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={recorder.state === "starting"}
              aria-label={t.messages.record}
              className="btn-secondary animate-pop h-11 w-11 shrink-0 rounded-full p-0"
            >
              <MicIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {(error || tooLong) && (
        <p id={`${inputId}-error`} role="alert" className="field-error -mt-1 px-5 pb-2">
          {error ?? t.messages.tooLong(text.length)}
        </p>
      )}

      {panelOpen && !recording && (
        <EmojiStickerPanel
          id={panelId}
          onEmoji={insertEmoji}
          onSticker={(sticker) => {
            setPanelOpen(false);
            onSendSticker(sticker);
          }}
        />
      )}
    </form>
  );
}
