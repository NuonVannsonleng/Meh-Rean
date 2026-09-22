import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import Avatar from "./Avatar";
import { BookmarkIcon, HomeIcon, PlusIcon, SettingsIcon, UserIcon } from "./Icons";
import { LogoMark } from "./Logo";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `press flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
    isActive ? "bg-brand-50 text-accent" : "text-ink-700 hover:bg-surface hover:text-ink-900"
  }`;

/** Left rail for wide screens: who you are and where you can go. */
export default function SideNav() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const onSaved = new URLSearchParams(search).get("tab") === "saved";
  const onOwnProfile = Boolean(user) && pathname === `/u/${user?.username}`;

  return (
    <nav aria-label={t.nav.shortcuts} className="animate-fade space-y-4">
      {user ? (
        <Link
          to={`/u/${user.username}`}
          className="card press hover:border-brand-200 flex items-center gap-3 p-3 transition-colors"
        >
          <Avatar user={user} />
          <span className="min-w-0">
            <span className="text-ink-900 block truncate text-sm font-semibold">{user.displayName}</span>
            <span className="text-ink-500 block truncate text-xs">@{user.username}</span>
          </span>
        </Link>
      ) : (
        <div className="card ruled-paper space-y-3 p-4">
          <LogoMark className="h-10 w-10" />
          <p className="text-ink-700 text-sm">{t.feed.composerGuest}</p>
          <Link to="/signup" className="btn-primary h-10 w-full">
            {t.nav.signUp}
          </Link>
        </div>
      )}

      <ul className="space-y-0.5">
        <li>
          <NavLink to="/" end className={itemClass}>
            <HomeIcon />
            {t.nav.feed}
          </NavLink>
        </li>
        {user && (
          <>
            <li>
              <NavLink to={`/u/${user.username}?tab=saved`} className={() => itemClass({ isActive: onOwnProfile && onSaved })}>
                <BookmarkIcon />
                {t.nav.saved}
              </NavLink>
            </li>
            <li>
              <NavLink to={`/u/${user.username}`} end className={() => itemClass({ isActive: onOwnProfile && !onSaved })}>
                <UserIcon />
                {t.nav.profile}
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings" className={itemClass}>
                <SettingsIcon />
                {t.nav.settings}
              </NavLink>
            </li>
          </>
        )}
      </ul>

      {user && (
        <Link to="/create" className="btn-primary w-full">
          <PlusIcon className="h-4 w-4" />
          {t.feed.composerAction}
        </Link>
      )}

      <p className="text-ink-400 px-3 text-xs leading-relaxed">{t.footer.note}</p>
    </nav>
  );
}
