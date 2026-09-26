import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { formatDate, formatDateTime } from "../lib/format";
import { getThread, markConversationRead, sendMessage, unsendMessage } from "../services/api";
import type { Message, ThreadView } from "../types";
import Avatar from "./Avatar";
import { ArrowLeftIcon, SendIcon, TrashIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

/** Mirrors the message body check in supabase/schema.sql. */
const MAX_LENGTH = 2000;
/** Messages closer together than this from one sender share a bubble group. */
const GROUP_GAP_MS = 5 * 60_000;
/** How close to the bottom still counts as "following the conversation". */
const STICK_THRESHOLD_PX = 120;

type ThreadState =
  | { status: "loading" }
  | { status: "ready"; thread: ThreadView }
  | { status: "not-found" }
  | { status: "self" }
  | { status: "error" };

/** A message still on its way to the server. */
interface PendingMessage extends Message {
  pending: true;
}

type Bubble = Message | PendingMessage;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t.messages.today;
  if (date.toDateString() === yesterday.toDateString()) return t.messages.yesterday;
  return formatDate(iso);
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Plain text with web links made clickable. Nothing else is interpreted. */
function MessageText({ body }: { body: string }) {
  const parts = body.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2 break-all"
            onClick={(event) => event.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Array.prototype.findLast, which older Safari lacks. */
function lastWhere(messages: Message[], test: (message: Message) => boolean): Message | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (test(messages[index])) return messages[index];
  }
  return undefined;
}

function isPending(message: Bubble): message is PendingMessage {
  return "pending" in message;
}

export default function ChatThread({ username }: { username: string }) {
  const { user } = useAuth();
  const { subscribe, refreshUnread } = useChat();
  const { notify } = useToast();
  const inputId = useId();
  const [state, setState] = useState<ThreadState>({ status: "loading" });
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const lastMarked = useRef<string>("");

  const thread = state.status === "ready" ? state.thread : null;
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
    setDraft("");
    setSendError(null);
    stickToBottom.current = true;
    lastMarked.current = "";
    void load();
  }, [load]);

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

  // Live updates for this conversation only.
  useEffect(
    () =>
      subscribe((event) => {
        setState((current) => {
          if (current.status !== "ready") return current;
          const view = current.thread;

          if (event.type === "message") {
            const { message } = event;
            if (view.conversationId && message.conversationId !== view.conversationId) return current;
            if (!view.conversationId) {
              // The first message of a brand-new conversation, from either side.
              if (message.senderId !== view.other.id && message.senderId !== me) return current;
              if (message.senderId === me) return current; // sendMessage() adds it
            }
            if (view.messages.some((item) => item.id === message.id)) return current;
            return {
              status: "ready",
              thread: {
                ...view,
                conversationId: message.conversationId,
                messages: [...view.messages, message],
              },
            };
          }

          if (event.type === "unsent") {
            if (!view.messages.some((item) => item.id === event.messageId)) return current;
            return {
              status: "ready",
              thread: { ...view, messages: view.messages.filter((item) => item.id !== event.messageId) },
            };
          }

          if (event.conversationId !== view.conversationId) return current;
          const otherReadAt = event.reads[view.other.id];
          if (!otherReadAt || otherReadAt === view.otherReadAt) return current;
          return { status: "ready", thread: { ...view, otherReadAt } };
        });
      }),
    [subscribe, me],
  );

  // Keep the newest message in view while the reader is following along.
  const bubbles: Bubble[] = thread ? [...thread.messages, ...pending] : [];
  const lastBubbleId = bubbles[bubbles.length - 1]?.id;

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [lastBubbleId, state.status]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX;
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !thread || text.length > MAX_LENGTH) return;

    const temp: PendingMessage = {
      id: `pending-${crypto.randomUUID()}`,
      conversationId: thread.conversationId ?? "",
      senderId: me,
      body: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setPending((current) => [...current, temp]);
    setDraft("");
    setSendError(null);
    stickToBottom.current = true;
    inputRef.current?.focus();

    try {
      const sent = await sendMessage(username, text);
      setState((current) => {
        if (current.status !== "ready") return current;
        const view = current.thread;
        // Realtime may already have delivered it.
        const messages = view.messages.some((item) => item.id === sent.id)
          ? view.messages
          : [...view.messages, sent];
        return { status: "ready", thread: { ...view, conversationId: sent.conversationId, messages } };
      });
    } catch (error) {
      setSendError(errorCode(error) === "MESSAGE_TOO_LONG" ? errorMessage(error) : t.messages.sendError);
      // Give the words back so nothing typed is lost.
      setDraft((current) => (current ? current : text));
    } finally {
      setPending((current) => current.filter((item) => item.id !== temp.id));
    }
  };

  const unsend = async (message: Message) => {
    setSelected(null);
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            thread: { ...current.thread, messages: current.thread.messages.filter((item) => item.id !== message.id) },
          }
        : current,
    );
    try {
      await unsendMessage(message.id);
      notify(t.messages.unsent);
    } catch {
      notify(t.messages.unsendError);
      void load();
    }
  };

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
  const lastOwn = lastWhere(thread.messages, (message) => message.senderId === me);
  const seen = Boolean(lastOwn && thread.otherReadAt && thread.otherReadAt >= lastOwn.createdAt);
  const tooLong = draft.trim().length > MAX_LENGTH;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
            <span className="text-ink-500 block truncate text-xs">
              @{other.username}
              {other.school && ` · ${other.school}`}
            </span>
          </span>
        </Link>
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-label={t.messages.title}
      >
        {bubbles.length === 0 ? (
          <div className="animate-rise flex h-full flex-col items-center justify-center gap-3 text-center">
            <Avatar user={other} size="lg" />
            <p className="text-ink-900 font-semibold">{t.messages.threadEmpty(other.displayName)}</p>
            <p className="text-ink-500 max-w-xs text-sm">{t.messages.threadEmptyBody}</p>
          </div>
        ) : (
          <ol className="flex flex-col">
            {bubbles.map((message, index) => {
              const previous = bubbles[index - 1];
              const next = bubbles[index + 1];
              const mine = message.senderId === me;
              const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
              const joinsPrevious =
                !newDay &&
                previous?.senderId === message.senderId &&
                Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_GAP_MS;
              const joinsNext =
                next?.senderId === message.senderId &&
                dayLabel(next.createdAt) === dayLabel(message.createdAt) &&
                Date.parse(next.createdAt) - Date.parse(message.createdAt) < GROUP_GAP_MS;
              const sending = isPending(message);
              const open = selected === message.id;

              return (
                <li key={message.id} className="flex flex-col">
                  {newDay && (
                    <p className="text-ink-500 my-3 text-center text-xs font-medium">{dayLabel(message.createdAt)}</p>
                  )}
                  <div
                    className={`animate-fade flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${
                      joinsPrevious ? "mt-0.5" : "mt-3"
                    }`}
                  >
                    {!mine && (
                      <span className="w-8 shrink-0" aria-hidden="true">
                        {!joinsNext && <Avatar user={other} size="sm" />}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => !sending && setSelected(open ? null : message.id)}
                      aria-expanded={sending ? undefined : open}
                      title={formatDateTime(message.createdAt)}
                      className={`max-w-[min(80%,34rem)] rounded-2xl px-3.5 py-2 text-left text-[15px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere] transition-opacity sm:text-sm ${
                        mine
                          ? `bg-brand-600 text-white ${joinsPrevious ? "rounded-tr-md" : ""} ${joinsNext ? "rounded-br-md" : ""}`
                          : `bg-surface-hover text-ink-900 ${joinsPrevious ? "rounded-tl-md" : ""} ${joinsNext ? "rounded-bl-md" : ""}`
                      } ${sending ? "opacity-60" : ""}`}
                    >
                      <span className="sr-only">{mine ? t.messages.you : `${other.displayName}: `}</span>
                      <MessageText body={message.body} />
                    </button>
                  </div>

                  {(open || sending) && (
                    <div
                      className={`animate-fade text-ink-500 mt-1 flex items-center gap-3 text-xs ${
                        mine ? "justify-end" : "pl-10"
                      }`}
                    >
                      <time dateTime={message.createdAt}>
                        {sending ? t.messages.sending : timeFormat.format(new Date(message.createdAt))}
                      </time>
                      {mine && !sending && (
                        <button
                          type="button"
                          onClick={() => void unsend(message)}
                          className="touch-target hover:text-danger-fg inline-flex items-center gap-1 font-medium"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {t.messages.unsend}
                        </button>
                      )}
                    </div>
                  )}

                  {message.id === lastOwn?.id && !pending.length && !open && (
                    <p className="text-ink-500 animate-fade mt-1 text-right text-xs">
                      {seen ? t.messages.seen : t.messages.sent}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form
        onSubmit={submit}
        className="border-line shrink-0 border-t px-3 py-2.5 sm:px-4 sm:py-3"
      >
        <label htmlFor={inputId} className="sr-only">
          {t.messages.composerLabel(other.displayName)}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            id={inputId}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (sendError) setSendError(null);
            }}
            onKeyDown={(event) => {
              // Enter sends on keyboards; phones keep Enter for new lines.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={t.messages.composerPlaceholder}
            rows={1}
            aria-invalid={tooLong || undefined}
            aria-describedby={sendError || tooLong ? `${inputId}-error` : undefined}
            className="input field-sizing-content h-auto max-h-40 min-h-11 flex-1 resize-none rounded-3xl py-2.5"
          />
          <button
            type="submit"
            disabled={!draft.trim() || tooLong}
            aria-label={t.messages.send}
            className="btn-primary h-11 w-11 shrink-0 rounded-full p-0"
          >
            <SendIcon className="h-4.5 w-4.5" />
          </button>
        </div>
        {(sendError || tooLong) && (
          <p id={`${inputId}-error`} role="alert" className="field-error px-2">
            {sendError ?? t.messages.tooLong(draft.trim().length)}
          </p>
        )}
      </form>
    </div>
  );
}
