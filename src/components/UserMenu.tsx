import { useCallback, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDismiss } from "../hooks/useDismiss";
import { t } from "../i18n/en";
import type { User } from "../types";
import Avatar from "./Avatar";
import { BookmarkIcon, LogOutIcon, SettingsIcon, UserIcon } from "./Icons";
import ThemeSwitcher from "./ThemeSwitcher";

const itemClass =
  "press text-ink-700 hover:bg-surface-hover hover:text-ink-900 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium";

export default function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const handleSignOut = async () => {
    close();
    await signOut();
    notify(t.nav.signedOut);
    navigate("/");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t.nav.userMenu}
        className="press hover:ring-brand-200 rounded-full ring-2 ring-transparent"
      >
        <Avatar user={user} size="sm" className="sm:h-9 sm:w-9" />
      </button>

      {open && (
        <div
          id={menuId}
          className="card animate-pop absolute right-0 z-50 mt-2 w-72 origin-top-right p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="text-ink-900 truncate text-sm font-semibold">{user.displayName}</p>
              <p className="text-ink-500 truncate text-sm">@{user.username}</p>
            </div>
          </div>
          <div className="border-line my-1 border-t" />
          <nav aria-label={t.nav.userMenu}>
            <Link to={`/u/${user.username}`} onClick={close} className={itemClass}>
              <UserIcon className="h-4.5 w-4.5" />
              {t.nav.profile}
            </Link>
            <Link to={`/u/${user.username}?tab=saved`} onClick={close} className={itemClass}>
              <BookmarkIcon className="h-4.5 w-4.5" />
              {t.nav.saved}
            </Link>
            <Link to="/settings" onClick={close} className={itemClass}>
              <SettingsIcon className="h-4.5 w-4.5" />
              {t.nav.settings}
            </Link>
          </nav>
          <div className="px-1 py-2">
            <ThemeSwitcher />
          </div>
          <div className="border-line my-1 border-t" />
          <button type="button" onClick={handleSignOut} className={itemClass}>
            <LogOutIcon className="h-4.5 w-4.5" />
            {t.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
