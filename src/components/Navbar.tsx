import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import Avatar from "./Avatar";
import { BookmarkIcon, HomeIcon, LogoIcon, PlusIcon, UserIcon } from "./Icons";
import UserMenu from "./UserMenu";

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `press inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium ${
    isActive ? "bg-brand-50 text-accent" : "text-ink-700 hover:bg-surface-hover hover:text-ink-900"
  }`;

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `press flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
    isActive ? "text-accent" : "text-ink-500"
  }`;

export default function Navbar() {
  const { user, status } = useAuth();

  return (
    <>
      <header className="bg-surface/85 border-line sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="container-page flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link
            to="/"
            aria-label={t.nav.logoAria}
            className="text-ink-900 group flex items-center gap-2 rounded-lg text-lg font-bold tracking-tight"
          >
            <span className="bg-brand-600 group-hover:bg-brand-700 flex h-8 w-8 items-center justify-center rounded-lg text-white transition-[background-color,transform] duration-200 group-hover:-rotate-6">
              <LogoIcon className="h-4.5 w-4.5" />
            </span>
            <span>{t.common.appName}</span>
          </Link>

          <nav aria-label={t.nav.label} className="hidden sm:block">
            <ul className="flex items-center gap-1">
              <li>
                <NavLink to="/" end className={desktopLink}>
                  <HomeIcon className="h-4.5 w-4.5" />
                  {t.nav.feed}
                </NavLink>
              </li>
              {user && (
                <li>
                  <NavLink to={`/u/${user.username}?tab=saved`} className={desktopLink}>
                    <BookmarkIcon className="h-4.5 w-4.5" />
                    {t.nav.saved}
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/create" className="btn-primary hidden h-10 sm:inline-flex">
                  <PlusIcon className="h-4 w-4" />
                  {t.nav.create}
                </Link>
                <UserMenu user={user} />
              </>
            ) : (
              status === "signed-out" && (
                <>
                  <Link to="/login" className="btn-ghost h-10 px-3">
                    {t.nav.signIn}
                  </Link>
                  <Link to="/signup" className="btn-primary h-10 px-3.5">
                    {t.nav.signUp}
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* Thumb-reach navigation on phones */}
      <nav
        aria-label={t.nav.mobileLabel}
        className="bg-surface/95 border-line fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <ul className="flex">
          <li className="flex flex-1">
            <NavLink to="/" end className={mobileLink}>
              <HomeIcon />
              {t.nav.feed}
            </NavLink>
          </li>
          <li className="flex flex-1">
            <NavLink to="/create" className={mobileLink}>
              <span className="bg-brand-600 flex h-8 w-11 items-center justify-center rounded-xl text-white shadow-sm">
                <PlusIcon className="h-5 w-5" />
              </span>
              <span className="sr-only">{t.nav.create}</span>
            </NavLink>
          </li>
          <li className="flex flex-1">
            {user ? (
              <NavLink to={`/u/${user.username}`} className={mobileLink}>
                <Avatar user={user} size="sm" className="h-6 w-6 text-[10px]" />
                {t.nav.profile}
              </NavLink>
            ) : (
              <NavLink to="/login" className={mobileLink}>
                <UserIcon />
                {t.nav.signIn}
              </NavLink>
            )}
          </li>
        </ul>
      </nav>
    </>
  );
}
