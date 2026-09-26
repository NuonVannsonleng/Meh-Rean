import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import type { RecordedVoice } from "../hooks/useVoiceRecorder";
import { t } from "../i18n/en";
import { MAX_FILE_BYTES, MAX_FILES_PER_POST } from "../lib/attachments";
import { kindForFile, messageSnippet, preparePhoto, videoMeta } from "../lib/chat";
import { errorCode, errorMessage } from "../lib/errors";
import { formatDate } from "../lib/format";
import {
  editMessage,
  getThread,
  joinConversation,
  markConversationRead,
  reactToMessage,
  sendMessage,
  unsendMessage,
} from "../services/api";
import type {
  Attachment,
  ConversationChannel,
  Message,
  MessageAttachment,
  OutgoingMessage,
  ReactionType,
  ThreadView,
} from "../types";
import Avatar from "./Avatar";
import Composer from "./chat/Composer";
import MessageBubble, { isPending, type Bubble, type PendingMessage } from "./chat/MessageBubble";
import { ArrowLeftIcon, UploadIcon } from "./Icons";
import { Lightbox } from "./PostAttachments";
import VerifiedBadge from "./VerifiedBadge";

/** Messages closer together than this from one sender share a bubble group. */
const GROUP_GAP_MS = 5 * 60_000;
/** How close to the bottom still counts as "following the conversation". */
const STICK_THRESHOLD_PX = 160;
/** "Typing…" fades this long after the last signal. */
const TYPING_TIMEOUT_MS = 4000;

type ThreadState =
  | { status: "loading" }
  | { status: "ready"; thread: ThreadView }
  | { status: "not-found" }
  | { status: "self" }
  | { status: "error" };

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t.messages.today;
  if (date.toDateString() === yesterday.toDateString()) return t.messages.yesterday;
  return formatDate(iso);
}

/** Array.prototype.findLast, which older Safari lacks. */
function lastWhere(messages: Message[], test: (message: Message) => boolean): Message | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (test(messages[index])) return messages[index];
  }
  return undefined;
}

function snippetOf(message: Message): string {
  return messageSnippet({
    ...message,
    deleted: Boolean(message.deletedAt),
    attachmentName: message.attachment?.name,
    duration: message.attachment?.duration,
  });
}

/** A local preview of a file that is still uploading. */
function previewOf(file: File, meta: OutgoingMessage["meta"] = {}): MessageAttachment {
  const url = URL.createObjectURL(file);
  return { path: "", url, downloadUrl: url, name: file.name, mimeType: file.type, size: file.size, ...meta };
}

function TypingIndicator({ name, other }: { name: string; other: ThreadView["other"] }) {
  return (
    <div className="animate-fade mt-3 flex items-end gap-2">
      <Avatar user={other} size="sm" />
      <div className="bg-surface-hover flex h-9 items-center gap-1 rounded-2xl px-3.5" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="bg-ink-400 h-2 w-2 animate-bounce rounded-full"
            style={{ animationDelay: `${dot * 140}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>
      <span className="sr-only">{t.messages.typing(name)}</span>
    </div>
  );
}

export default function ChatThread({ username }: { username: string }) {
  const { user } = useAuth();
  const { subscribe, refreshUnread } = useChat();
  const { notify } = useToast();
  const [state, setState] = useState<ThreadState>({ status: "loading" });
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [staged, setStaged] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: Attachment[]; index: number } | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const lastMarked = useRef<string>("");
  const channel = useRef<ConversationChannel | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  /** What each pending bubble was, so a failed send can be retried. */
  const outgoing = useRef(new Map<string, OutgoingMessage>());

  const thread = state.status === "ready" ? state.thread : null;
  const conversationId = thread?.conversationId ?? null;
  const me = user?.id ?? "";

  const load = useCallback(async () => {
    try {
      const next = await getThread(username);
      setState({ status: "ready", thread: next });
    } catch (error) {
      const code = errorCode(error);
      setState({ status: code === "NOT_FOUND" ? "not-found" : code === "FORBIDDEN" ? "self" : "error" });
    }
  }, [username]);

  useEffect(() => {
    setState({ status: "loading" });
    setPending([]);
    setStaged([]);
    setReplyTo(null);
    setEditing(null);
    setSendError(null);
    setOtherTyping(false);
    stickToBottom.current = true;
    lastMarked.current = "";
    void load();
  }, [load]);

  /** Applies a change to the loaded thread, if there is one. */
  const updateThread = useCallback((change: (view: ThreadView) => ThreadView) => {
    setState((current) => (current.status === "ready" ? { status: "ready", thread: change(current.thread) } : current));
  }, []);

  const addMessage = useCallback(
    (message: Message) =>
      updateThread((view) =>
        view.messages.some((item) => item.id === message.id)
          ? view
          : { ...view, conversationId: message.conversationId, messages: [...view.messages, message] },
      ),
    [updateThread],
  );

  const patchMessage = useCallback(
    (id: string, change: (message: Message) => Message) =>
      updateThread((view) => ({
        ...view,
        messages: view.messages.map((item) => (item.id === id ? change(item) : item)),
      })),
    [updateThread],
  );

  // Opening the thread (or receiving a message while it is on screen) reads it.
  const markRead = useCallback(() => {
    if (!thread?.conversationId || document.visibilityState !== "visible") return;
    const latestIncoming = lastWhere(thread.messages, (message) => message.senderId !== me);
    if (!latestIncoming || latestIncoming.createdAt <= lastMarked.current) return;
    lastMarked.current = latestIncoming.createdAt;
    markConversationRead(thread.conversationId)
      .then(refreshUnread)
      .catch(() => {
        lastMarked.current = "";
      });
  }, [thread, me, refreshUnread]);

  useEffect(() => {
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  // "Typing…" in both directions, once the conversation exists.
  useEffect(() => {
    if (!conversationId) return;
    const joined = joinConversation(conversationId, () => {
      setOtherTyping(true);
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
    });
    channel.current = joined;
    return () => {
      joined.leave();
      channel.current = null;
      window.clearTimeout(typingTimer.current);
    };
  }, [conversationId]);

  // Live updates for this conversation only.
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === "message") {
          const { message } = event;
          setState((current) => {
            if (current.status !== "ready") return current;
            const view = current.thread;
            if (view.conversationId && message.conversationId !== view.conversationId) return current;
            // The first message of a brand-new conversation: only from the other person;
            // the viewer's own is added by the send that made it.
            if (!view.conversationId && message.senderId !== view.other.id) return current;
            if (view.messages.some((item) => item.id === message.id)) return current;
            if (message.senderId === view.other.id) {
              setOtherTyping(false);
              window.clearTimeout(typingTimer.current);
            }
            return {
              status: "ready",
              thread: { ...view, conversationId: message.conversationId, messages: [...view.messages, message] },
            };
          });
        } else if (event.type === "updated") {
          const { message } = event;
          patchMessage(message.id, (existing) => ({
            ...message,
            // Reactions arrive on their own events and are cleared by an unsend.
            reactions: message.deletedAt ? {} : existing.reactions,
          }));
        } else if (event.type === "reaction") {
          patchMessage(event.messageId, (existing) => {
            const reactions = { ...existing.reactions };
            if (event.reaction) reactions[event.userId] = event.reaction;
            else delete reactions[event.userId];
            return { ...existing, reactions };
          });
        } else {
          updateThread((view) => {
            if (event.conversationId !== view.conversationId) return view;
            const otherReadAt = event.reads[view.other.id];
            return otherReadAt && otherReadAt !== view.otherReadAt ? { ...view, otherReadAt } : view;
          });
        }
      }),
    [subscribe, patchMessage, updateThread],
  );

  // Keep the newest message in view while the reader is following along,
  // including when a photo finishes loading and grows the list.
  const bubbles: Bubble[] = thread ? [...thread.messages, ...pending] : [];
  const lastBubbleId = bubbles[bubbles.length - 1]?.id;

  const scrollToEnd = useCallback(() => {
    const element = scroller.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, []);

  useLayoutEffect(scrollToEnd, [lastBubbleId, state.status, otherTyping, scrollToEnd]);

  useEffect(() => {
    const content = list.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(scrollToEnd);
    observer.observe(content);
    return () => observer.disconnect();
  }, [state.status, scrollToEnd]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX;
  };

  // ---- Sending ----

  /** Puts a bubble on screen straight away, before the server has it. */
  const stagePending = (input: OutgoingMessage, preview: MessageAttachment | null): string => {
    const id = `pending-${crypto.randomUUID()}`;
    outgoing.current.set(id, input);
    const bubble: PendingMessage = {
      id,
      conversationId: conversationId ?? "",
      senderId: me,
      kind: input.kind,
      body: input.body ?? "",
      attachment: preview,
      sticker: input.sticker ?? null,
      replyToId: input.replyToId ?? null,
      reactions: {},
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    stickToBottom.current = true;
    setPending((current) => [...current, bubble]);
    return id;
  };

  const sendPending = async (id: string) => {
    const input = outgoing.current.get(id);
    if (!input) return;
    setPending((current) => current.map((item) => (item.id === id ? { ...item, failed: false } : item)));
    try {
      const sent = await sendMessage(username, input);
      addMessage(sent);
      outgoing.current.delete(id);
      setPending((current) => {
        const done = current.find((item) => item.id === id);
        if (done?.attachment?.url.startsWith("blob:")) URL.revokeObjectURL(done.attachment.url);
        return current.filter((item) => item.id !== id);
      });
    } catch (error) {
      const code = errorCode(error);
      setSendError(code === "FILE_TOO_LARGE" || code === "MESSAGE_TOO_LONG" ? errorMessage(error) : t.messages.sendError);
      setPending((current) => current.map((item) => (item.id === id ? { ...item, failed: true } : item)));
    }
  };

  const discardPending = (id: string) => {
    outgoing.current.delete(id);
    setPending((current) => {
      const gone = current.find((item) => item.id === id);
      if (gone?.attachment?.url.startsWith("blob:")) URL.revokeObjectURL(gone.attachment.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const send = (input: Omit<OutgoingMessage, "replyToId">, preview: MessageAttachment | null = null) => {
    setSendError(null);
    const id = stagePending({ ...input, replyToId: replyTo?.id ?? null }, preview);
    setReplyTo(null);
    void sendPending(id);
  };

  const sendFiles = async (caption: string) => {
    const files = staged;
    setStaged([]);
    setSendError(null);
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);

    // Every bubble appears at once; the uploads then go in order.
    const ids: string[] = [];
    for (const [index, original] of files.entries()) {
      const kind = kindForFile(original);
      let file = original;
      let meta: OutgoingMessage["meta"] = {};
      if (kind === "image") {
        const prepared = await preparePhoto(original);
        file = prepared.file;
        meta = { width: prepared.width, height: prepared.height };
      } else if (kind === "video") {
        meta = await videoMeta(original);
      }
      const first = index === 0;
      ids.push(
        stagePending(
          { kind, file, meta, body: first ? caption : "", replyToId: first ? replyId : null },
          previewOf(file, meta),
        ),
      );
    }
    for (const id of ids) await sendPending(id);
  };

  const sendVoice = (voice: RecordedVoice) => {
    const meta = { duration: voice.duration, waveform: voice.waveform };
    send({ kind: "voice", file: voice.file, meta }, previewOf(voice.file, meta));
  };

  const stage = (files: File[]) => {
    if (editing) return;
    const fitting = files.filter((file) => {
      if (file.size <= MAX_FILE_BYTES) return true;
      notify(t.messages.fileTooLarge(file.name));
      return false;
    });
    setStaged((current) => {
      const next = [...current, ...fitting];
      if (next.length > MAX_FILES_PER_POST) notify(t.messages.tooManyFiles);
      return next.slice(0, MAX_FILES_PER_POST);
    });
    inputRef.current?.focus();
  };

  // ---- Message actions ----

  const react = async (message: Message, reaction: ReactionType | null) => {
    setSelected(null);
    const before = message.reactions;
    patchMessage(message.id, (existing) => {
      const reactions = { ...existing.reactions };
      if (reaction) reactions[me] = reaction;
      else delete reactions[me];
      return { ...existing, reactions };
    });
    try {
      await reactToMessage(message.id, reaction);
    } catch {
      patchMessage(message.id, (existing) => ({ ...existing, reactions: before }));
      notify(t.messages.reactError);
    }
  };

  const saveEdit = async (body: string) => {
    const target = editing;
    setEditing(null);
    if (!target || body === target.body) return;
    patchMessage(target.id, (existing) => ({ ...existing, body, editedAt: new Date().toISOString() }));
    try {
      const saved = await editMessage(target.id, body);
      patchMessage(target.id, (existing) => ({ ...saved, reactions: existing.reactions }));
    } catch {
      patchMessage(target.id, (existing) => ({ ...existing, body: target.body, editedAt: target.editedAt }));
      notify(t.messages.editError);
    }
  };

  const unsend = async (message: Message) => {
    setSelected(null);
    if (replyTo?.id === message.id) setReplyTo(null);
    if (editing?.id === message.id) setEditing(null);
    patchMessage(message.id, (existing) => ({
      ...existing,
      body: "",
      attachment: null,
      sticker: null,
      reactions: {},
      deletedAt: new Date().toISOString(),
    }));
    try {
      await unsendMessage(message.id);
      notify(t.messages.unsent);
    } catch {
      notify(t.messages.unsendError);
      void load();
    }
  };

  const copy = async (message: Message) => {
    setSelected(null);
    try {
      await navigator.clipboard.writeText(message.body);
      notify(t.messages.copied);
    } catch {
      // Clipboard blocked: nothing useful to add.
    }
  };

  const jumpTo = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(messageId);
    window.setTimeout(() => setHighlighted((current) => (current === messageId ? null : current)), 1600);
  };

  const openImage = (message: Message) => {
    if (!thread) return;
    const photos = thread.messages.filter((item) => item.kind === "image" && item.attachment && !item.deletedAt);
    const images: Attachment[] = photos.map((item) => ({
      id: item.id,
      name: item.attachment?.name ?? "",
      mimeType: item.attachment?.mimeType ?? "",
      size: item.attachment?.size ?? 0,
      kind: "image",
      url: item.attachment?.url ?? "",
    }));
    const index = photos.findIndex((item) => item.id === message.id);
    if (index >= 0) setLightbox({ images, index });
  };

  // ---- Drag and drop ----

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

  if (state.status === "loading") {
    return (
      <div role="status" className="text-ink-500 flex flex-1 items-center justify-center text-sm">
        {t.common.loading}
      </div>
    );
  }

  if (state.status !== "ready" || !thread) {
    const message =
      state.status === "not-found"
        ? t.apiErrors.NOT_FOUND
        : state.status === "self"
          ? t.messages.cannotMessageSelf
          : t.messages.loadError;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-ink-700 text-sm">{message}</p>
        <div className="flex gap-2">
          <Link to="/messages" className="btn-secondary h-10">
            {t.messages.back}
          </Link>
          {state.status === "error" && (
            <button type="button" onClick={() => void load()} className="btn-primary h-10">
              {t.common.tryAgain}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { other } = thread;
  const byId = new Map(thread.messages.map((message) => [message.id, message]));
  const lastOwn = lastWhere(thread.messages, (message) => message.senderId === me && !message.deletedAt);
  const seen = Boolean(lastOwn && thread.otherReadAt && thread.otherReadAt >= lastOwn.createdAt);
  const nameOf = (id: string) => (id === me ? t.messages.youName : other.displayName);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!hasFiles(event) || editing) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (hasFiles(event) && !editing) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDragging(false);
        stage([...event.dataTransfer.files]);
      }}
    >
      <header className="border-line flex shrink-0 items-center gap-2 border-b px-2 py-2 sm:px-4">
        <Link to="/messages" aria-label={t.messages.back} className="icon-btn md:hidden">
          <ArrowLeftIcon />
        </Link>
        <Link
          to={`/u/${other.username}`}
          aria-label={t.messages.viewProfile(other.displayName)}
          className="press hover:bg-surface-hover flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5"
        >
          <Avatar user={other} />
          <span className="min-w-0">
            <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold">
              <span className="truncate">{other.displayName}</span>
              {other.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
            </span>
            <span className={`block truncate text-xs ${otherTyping ? "text-accent font-medium" : "text-ink-500"}`}>
              {otherTyping ? t.messages.typing(other.displayName.split(" ")[0]) : `@${other.username}${other.school ? ` · ${other.school}` : ""}`}
            </span>
          </span>
        </Link>
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-label={t.messages.title}
      >
        <div ref={list}>
          {bubbles.length === 0 ? (
            <div className="animate-rise flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <Avatar user={other} size="lg" />
              <p className="text-ink-900 font-semibold">{t.messages.threadEmpty(other.displayName)}</p>
              <p className="text-ink-500 max-w-xs text-sm">{t.messages.threadEmptyBody}</p>
            </div>
          ) : (
            <ol className="flex flex-col">
              {bubbles.map((message, index) => {
                const previous = bubbles[index - 1];
                const next = bubbles[index + 1];
                const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                const stickerLike = (item: Bubble | undefined) => item?.kind === "sticker";
                const joinsPrevious =
                  !newDay &&
                  previous?.senderId === message.senderId &&
                  !stickerLike(previous) &&
                  !message.replyToId &&
                  Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_GAP_MS;
                const joinsNext =
                  next?.senderId === message.senderId &&
                  !stickerLike(next) &&
                  !next.replyToId &&
                  dayLabel(next.createdAt) === dayLabel(message.createdAt) &&
                  Date.parse(next.createdAt) - Date.parse(message.createdAt) < GROUP_GAP_MS;
                const replyTarget = message.replyToId ? (byId.get(message.replyToId) ?? null) : undefined;
                const pendingBubble = isPending(message) ? message : null;

                return (
                  <li key={message.id} className="flex flex-col">
                    {newDay && (
                      <p className="text-ink-500 my-3 text-center text-xs font-medium">{dayLabel(message.createdAt)}</p>
                    )}
                    <MessageBubble
                      message={message}
                      me={me}
                      other={other}
                      joinsPrevious={joinsPrevious}
                      joinsNext={joinsNext}
                      replyTarget={replyTarget}
                      selected={selected === message.id}
                      highlighted={highlighted === message.id}
                      onSelect={(open) => setSelected(open ? message.id : null)}
                      onOpenImage={openImage}
                      onReact={(reaction) => void react(message, reaction)}
                      onReply={() => {
                        setSelected(null);
                        setEditing(null);
                        setReplyTo(message);
                        inputRef.current?.focus();
                      }}
                      onCopy={() => void copy(message)}
                      onEdit={() => {
                        setSelected(null);
                        setReplyTo(null);
                        setStaged([]);
                        setEditing(message);
                      }}
                      onUnsend={() => void unsend(message)}
                      onJump={jumpTo}
                      onRetry={pendingBubble ? () => void sendPending(pendingBubble.id) : undefined}
                      onDiscard={pendingBubble ? () => discardPending(pendingBubble.id) : undefined}
                      footer={
                        message.id === lastOwn?.id && !pending.length && selected !== message.id ? (
                          <p className="text-ink-500 animate-fade mt-1 text-right text-xs">
                            {seen ? t.messages.seen : t.messages.sent}
                          </p>
                        ) : null
                      }
                    />
                  </li>
                );
              })}
            </ol>
          )}
          {otherTyping && <TypingIndicator name={other.displayName} other={other} />}
        </div>
      </div>

      <Composer
        otherName={other.displayName}
        inputRef={inputRef}
        staged={staged}
        onStage={stage}
        onUnstage={(index) => setStaged((current) => current.filter((_, position) => position !== index))}
        replyTo={replyTo ? { name: nameOf(replyTo.senderId), snippet: snippetOf(replyTo) } : null}
        onCancelReply={() => setReplyTo(null)}
        editing={editing ? { id: editing.id, body: editing.body } : null}
        onCancelEdit={() => setEditing(null)}
        onSendText={(body) => send({ kind: "text", body })}
        onSendFiles={(caption) => void sendFiles(caption)}
        onSendSticker={(sticker) => send({ kind: "sticker", sticker })}
        onSendVoice={sendVoice}
        onSaveEdit={(body) => void saveEdit(body)}
        onTyping={() => channel.current?.typing()}
        error={sendError}
        onClearError={() => setSendError(null)}
      />

      {dragging && (
        <div className="bg-surface/85 border-accent pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed backdrop-blur-sm">
          <UploadIcon className="text-accent h-8 w-8" />
          <p className="text-ink-900 font-semibold">{t.messages.dropFiles}</p>
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          title={other.displayName}
          onIndex={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
