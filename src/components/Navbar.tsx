import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { t } from "../i18n/en";
import Avatar from "./Avatar";
import { BookmarkIcon, ChatIcon, HomeIcon, PlusIcon, UserIcon } from "./Icons";
import GlobalSearch from "./GlobalSearch";
import Logo from "./Logo";
import UserMenu from "./UserMenu";

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `press inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium ${
    isActive ? "bg-brand-50 text-accent" : "text-ink-700 hover:bg-surface-hover hover:text-ink-900"
  }`;

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `press flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
    isActive ? "text-accent" : "text-ink-500"
  }`;

/** Unread count on top of an icon; the count itself is in the link's label. */
function UnreadDot({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden="true"
      className="bg-brand-600 ring-surface animate-pop absolute -top-1.5 -right-2 min-w-4.5 rounded-full px-1 text-center text-[10px] leading-4.5 font-bold text-white ring-2"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Navbar() {
  const { user, status } = useAuth();
  const { unread } = useChat();
  const { pathname, search } = useLocation();
  const inThread = pathname.startsWith("/messages/");
  const messagesLabel = unread ? t.nav.messagesUnread(unread) : t.nav.messages;
  const onOwnProfile = Boolean(user) && pathname === `/u/${user?.username}`;
  const onSaved = onOwnProfile && new URLSearchParams(search).get("tab") === "saved";

  return (
    <>
      <header className="bg-surface/85 border-line sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="container-page flex h-14 items-center justify-between gap-3 sm:h-16 xl:max-w-7xl [@media(max-height:500px)]:h-12">
          <Link
            to="/"
            aria-label={t.nav.logoAria}
            className="rounded-lg"
          >
            <Logo />
          </Link>

          <nav aria-label={t.nav.label} className="hidden md:block">
            <ul className="flex items-center gap-1">
              <li>
                <NavLink to="/" end className={desktopLink}>
                  <HomeIcon className="h-4.5 w-4.5" />
                  {t.nav.feed}
                </NavLink>
              </li>
              {user && (
                <li>
                  <NavLink to={`/u/${user.username}?tab=saved`} className={() => desktopLink({ isActive: onSaved })}>
                    <BookmarkIcon className="h-4.5 w-4.5" />
                    {t.nav.saved}
                  </NavLink>
                </li>
              )}
              {user && (
                <li>
                  <NavLink to="/messages" aria-label={messagesLabel} className={desktopLink}>
                    <span className="relative">
                      <ChatIcon className="h-4.5 w-4.5" />
                      <UnreadDot count={unread} />
                    </span>
                    {t.nav.messages}
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <GlobalSearch />
            {user ? (
              <>
                {/* Tablets get the icon here; phones have it in the bottom bar. */}
                <Link to="/messages" aria-label={messagesLabel} className="icon-btn relative hidden sm:inline-flex md:hidden">
                  <ChatIcon />
                  <UnreadDot count={unread} />
                </Link>
                <Link to="/create" className="btn-primary hidden h-10 sm:inline-flex">
                  <PlusIcon className="h-4 w-4" />
                  {t.nav.create}
                </Link>
                <UserMenu user={user} />
              </>
            ) : (
              status === "signed-out" && (
                <>
                  <Link to="/login" className="btn-ghost hidden h-10 px-3 sm:inline-flex">
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
        className={`bg-surface/95 border-line fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden ${
          inThread ? "hidden" : ""
        }`}
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
          {user && (
            <li className="flex flex-1">
              <NavLink to="/messages" aria-label={messagesLabel} className={mobileLink}>
                <span className="relative">
                  <ChatIcon />
                  <UnreadDot count={unread} />
                </span>
                {t.nav.messages}
              </NavLink>
            </li>
          )}
          <li className="flex flex-1">
            {user ? (
              <NavLink to={`/u/${user.username}`} className={() => mobileLink({ isActive: onOwnProfile && !onSaved })}>
                <Avatar user={user} size="sm" className="h-6 w-6 text-[11px]" />
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
