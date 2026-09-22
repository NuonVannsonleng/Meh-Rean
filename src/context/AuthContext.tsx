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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;
    api
      .getCurrentUser()
      .then((current) => {
        if (!active) return;
        setUser(current);
        setStatus(current ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (active) setStatus("signed-out");
      });
    return () => {
      active = false;
    };
  }, []);

  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    setStatus(next ? "signed-in" : "signed-out");
  }, []);

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
