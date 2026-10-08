import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "../services/api";
import type { SignInInput, SignUpInput, User } from "../types";

type AuthStatus = "loading" | "signed-in" | "signed-out";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  signIn: (input: SignInInput) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  signOut: () => Promise<void>;
  /** Replace the cached user after a profile change or account deletion. */
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The signed-in account, remembered in this browser so a returning student
 * sees their own home at once instead of the signed-out page while the
 * session is checked (renewing a token and loading the profile can take a
 * few seconds). The server's answer replaces it moments later; signing out
 * forgets it. Only the student's own details, which the session already
 * keeps in this browser, are stored.
 */
const ACCOUNT_KEY = "meh-rean:account";

function rememberedAccount(): User | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<User>) : null;
    return parsed && typeof parsed.id === "string" && typeof parsed.username === "string" ? (parsed as User) : null;
  } catch {
    return null;
  }
}

function remember(user: User | null) {
  try {
    if (user) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Private mode or storage full: the app still works, just without the head start.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(rememberedAccount);
  const [status, setStatus] = useState<AuthStatus>(() => (rememberedAccount() ? "signed-in" : "loading"));

  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    setStatus(next ? "signed-in" : "signed-out");
    remember(next);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getCurrentUser()
      .then((current) => {
        if (active) applyUser(current);
      })
      .catch(() => {
        // Offline or the server is unreachable: keep a remembered account
        // rather than signing the student out; with none, they are signed out.
        if (active) setStatus((current) => (current === "loading" ? "signed-out" : current));
      });
    return () => {
      active = false;
    };
  }, [applyUser]);

  // Stay in step with the server session (refresh, other tabs, email links).
  useEffect(() => api.subscribeToAuth(applyUser), [applyUser]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      const next = await api.signIn(input);
      applyUser(next);
      return next;
    },
    [applyUser],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const next = await api.signUp(input);
      applyUser(next);
      return next;
    },
    [applyUser],
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    applyUser(null);
  }, [applyUser]);

  const value = useMemo(
    () => ({ user, status, signIn, signUp, signOut, setUser: applyUser }),
    [user, status, signIn, signUp, signOut, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
