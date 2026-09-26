import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getUnreadCount, subscribeToChat } from "../services/api";
import type { ChatEvent } from "../types";
import { useAuth } from "./AuthContext";

type ChatListener = (event: ChatEvent) => void;

interface ChatContextValue {
  /** Messages waiting for the signed-in person, for the navigation badge. */
  unread: number;
  refreshUnread: () => void;
  /** Hears every live chat event; returns an unsubscribe function. */
  subscribe: (listener: ChatListener) => () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/** Catches anything a dropped realtime connection missed. */
const FALLBACK_REFRESH_MS = 60_000;

/**
 * One live connection per signed-in session, shared by the navigation badge,
 * the inbox and the open thread.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set<ChatListener>());
  const refreshTimer = useRef<number | undefined>(undefined);

  const refreshUnread = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    // Bursts of events (a read marker and a message together) cost one request.
    refreshTimer.current = window.setTimeout(() => {
      getUnreadCount()
        .then(setUnread)
        .catch(() => {
          // Keep the last known count; the next refresh will try again.
        });
    }, 150);
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }

    refreshUnread();
    const unsubscribe = subscribeToChat((event) => {
      refreshUnread();
      for (const listener of listeners.current) listener(event);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(refreshUnread, FALLBACK_REFRESH_MS);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      window.clearTimeout(refreshTimer.current);
    };
  }, [userId, refreshUnread]);

  // "(3) Meh Rean" in the tab, on top of whatever title the page sets.
  useEffect(() => {
    const prefix = /^\(\d+\+?\) /;
    const apply = () => {
      const base = document.title.replace(prefix, "");
      const next = unread ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const title = document.querySelector("title");
    const observer = title ? new MutationObserver(apply) : null;
    if (title) observer?.observe(title, { childList: true, characterData: true, subtree: true });
    return () => {
      observer?.disconnect();
      document.title = document.title.replace(prefix, "");
    };
  }, [unread]);

  const subscribe = useCallback((listener: ChatListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ unread, refreshUnread, subscribe }), [unread, refreshUnread, subscribe]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used inside ChatProvider");
  return context;
}
