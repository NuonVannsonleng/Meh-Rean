import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { LockIcon } from "./Icons";
import RequireAuth from "./RequireAuth";

/**
 * Pages only admins use. This only decides what to show: the database
 * refuses writes from anyone else regardless (row level security).
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminOnly>{children}</AdminOnly>
    </RequireAuth>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.isAdmin) return children;
  return (
    <div className="container-page max-w-xl py-16 text-center">
      <LockIcon className="text-ink-400 mx-auto mb-3 h-8 w-8" />
      <p className="text-ink-700">{t.admin.onlyAdmins}</p>
    </div>
  );
}
