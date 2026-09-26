import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import ChatThread from "../components/ChatThread";
import { ChatIcon, FileIcon, ImageIcon, MicIcon, PenIcon, SmileIcon, VideoIcon } from "../components/Icons";
import NewMessageDialog from "../components/NewMessageDialog";
import VerifiedBadge from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { t } from "../i18n/en";
import { messageSnippet } from "../lib/chat";
import { formatRelativeTime } from "../lib/format";
import { getConversations } from "../services/api";
import type { ConversationSummary, MessageKind } from "../types";

/** A small mark before non-text previews in the inbox. */
const PREVIEW_ICONS: Partial<Record<MessageKind, typeof ChatIcon>> = {
  image: ImageIcon,
  video: VideoIcon,
  voice: MicIcon,
  file: FileIcon,
  sticker: SmileIcon,
};

type InboxState =
  | { status: "loading" }
  | { status: "ready"; conversations: ConversationSummary[] }
  | { status: "error" };

function Inbox({ state, onRetry, activeUsername }: {
  state: InboxState;
  onRetry: () => void;
  activeUsername: string | undefined;
}) {
  const { user } = useAuth();

  if (state.status === "loading") {
    return (
      <ul aria-busy="true" className="space-y-1 p-2">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-3 py-2.5">
            <span className="animate-shimmer bg-surface-hover h-10 w-10 rounded-full" />
            <span className="flex-1 space-y-2">
              <span className="animate-shimmer bg-surface-hover block h-3 w-1/2 rounded" />
              <span className="animate-shimmer bg-surface-hover block h-3 w-3/4 rounded" />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-6 text-center">
        <p className="text-ink-700 text-sm">{t.messages.loadError}</p>
        <button type="button" onClick={onRetry} className="btn-secondary mt-3 h-10">
          {t.common.tryAgain}
        </button>
      </div>
    );
  }

  if (!state.conversations.length) {
    return (
      <div className="animate-rise flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="bg-surface-hover text-ink-500 flex h-12 w-12 items-center justify-center rounded-full">
          <ChatIcon />
        </span>
        <h2 className="text-ink-900 font-semibold">{t.messages.emptyTitle}</h2>
        <p className="text-ink-500 max-w-xs text-sm">{t.messages.emptyBody}</p>
      </div>
    );
  }

  return (
    <ul aria-label={t.messages.inboxLabel} className="space-y-0.5 p-2">
      {state.conversations.map((conversation) => {
        const { other, lastMessage, unread } = conversation;
        const fromMe = lastMessage.senderId === user?.id;
        const PreviewIcon = lastMessage.deleted ? undefined : PREVIEW_ICONS[lastMessage.kind];
        const active = activeUsername?.toLowerCase() === other.username;
        return (
          <li key={conversation.id}>
            <NavLink
              to={`/messages/${other.username}`}
              aria-current={active ? "page" : undefined}
              className={`press flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                active ? "bg-brand-50" : "hover:bg-surface-hover"
              }`}
            >
              <span className="relative">
                <Avatar user={other} />
                {unread > 0 && (
                  <span className="bg-brand-600 ring-surface absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-ink-900 flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold">
                    <span className="truncate">{other.displayName}</span>
                    {other.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </span>
                  <time dateTime={lastMessage.createdAt} className="text-ink-500 shrink-0 text-xs">
                    {formatRelativeTime(lastMessage.createdAt)}
                  </time>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      unread ? "text-ink-900 font-semibold" : "text-ink-500"
                    }`}
                  >
                    {fromMe && t.messages.you}
                    {PreviewIcon && <PreviewIcon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
                    {messageSnippet(lastMessage)}
                  </span>
                  {unread > 0 && (
                    <span className="bg-brand-600 shrink-0 rounded-full px-1.5 text-[11px] leading-5 font-bold text-white">
                      <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
                      <span className="sr-only">{t.messages.unreadCount(unread)}</span>
                    </span>
                  )}
                </span>
              </span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

export default function Messages() {
  const { username } = useParams();
  const { subscribe } = useChat();
  const [state, setState] = useState<InboxState>({ status: "loading" });
  const [composing, setComposing] = useState(false);
  const refreshTimer = useRef<number | undefined>(undefined);

  const load = useCallback(() => {
    getConversations()
      .then((conversations) => setState({ status: "ready", conversations }))
      .catch(() => setState((current) => (current.status === "ready" ? current : { status: "error" })));
  }, []);

  useEffect(() => {
    load();
    // Any live event can reorder the inbox or change a count; one reload
    // covers them all without re-deriving the list on the client.
    const unsubscribe = subscribe(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(load, 250);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(refreshTimer.current);
    };
  }, [load, subscribe]);

  // Opening a thread marks it read, which the inbox reflects on its next load.
  useEffect(() => {
    if (!username) return;
    const timer = window.setTimeout(load, 800);
    return () => window.clearTimeout(timer);
  }, [username, load]);

  return (
    <div className="container-page flex min-h-0 flex-1 gap-4 py-0 max-md:px-0 md:py-4 xl:max-w-7xl">
      <aside
        aria-label={t.messages.inboxLabel}
        className={`md:card bg-surface min-h-0 w-full flex-col md:flex md:w-80 md:shrink-0 lg:w-96 ${username ? "hidden" : "flex"}`}
      >
        <div className="border-line flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <h1 className="text-ink-900 font-display text-xl font-extrabold tracking-tight">{t.messages.title}</h1>
          <button
            type="button"
            onClick={() => setComposing(true)}
            aria-haspopup="dialog"
            className="btn-secondary h-9 px-3"
          >
            <PenIcon className="h-4 w-4" />
            {t.messages.newMessage}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Inbox state={state} onRetry={load} activeUsername={username} />
        </div>
      </aside>

      <section
        aria-label={t.messages.title}
        className={`md:card bg-surface min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${username ? "flex" : "hidden md:flex"}`}
      >
        {username ? (
          <ChatThread key={username.toLowerCase()} username={username} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="bg-brand-50 text-accent animate-pop flex h-14 w-14 items-center justify-center rounded-full">
              <ChatIcon className="h-6 w-6" />
            </span>
            <h2 className="text-ink-900 text-lg font-semibold">{t.messages.pickTitle}</h2>
            <p className="text-ink-500 max-w-sm text-sm">{t.messages.pickBody}</p>
            <button type="button" onClick={() => setComposing(true)} className="btn-primary mt-1">
              <PenIcon className="h-4 w-4" />
              {t.messages.newMessage}
            </button>
          </div>
        )}
      </section>

      {composing && <NewMessageDialog onClose={() => setComposing(false)} />}
    </div>
  );
}
