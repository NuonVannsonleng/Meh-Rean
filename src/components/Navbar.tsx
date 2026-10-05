import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { t } from "../i18n/en";
import Avatar from "./Avatar";
import GlobalSearch from "./GlobalSearch";
import { BookmarkIcon, ChatIcon, HomeIcon, PlusIcon, UserIcon } from "./Icons";
import Logo from "./Logo";
import UserMenu from "./UserMenu";

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

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `press inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium ${
    isActive ? "bg-brand-50 text-accent" : "text-ink-700 hover:bg-surface-hover hover:text-ink-900"
  }`;

const tabLink = ({ isActive }: { isActive: boolean }) =>
  `press flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
    isActive ? "text-accent" : "text-ink-500"
  }`;

export default function Navbar() {
  const { user, status } = useAuth();
  const { unread } = useChat();
  const { pathname, search } = useLocation();
  const messagesLabel = unread ? t.nav.messagesUnread(unread) : t.nav.messages;
  const onOwnProfile = Boolean(user) && pathname === `/u/${user?.username}`;
  const onSaved = onOwnProfile && new URLSearchParams(search).get("tab") === "saved";
  // An open chat on a phone gets the whole screen, like any messenger.
  const inThread = pathname.startsWith("/messages/");

  return (
    <>
      <header className="bg-surface/90 border-line sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="container-page flex h-14 items-center gap-3 sm:h-16 xl:max-w-7xl">
          <Link to="/" aria-label={t.nav.logoAria} className="shrink-0 rounded-lg">
            <Logo />
          </Link>

          {user && (
            <nav aria-label={t.nav.label} className="ml-4 hidden md:block">
              <ul className="flex items-center gap-1">
                <li>
                  <NavLink to="/" end className={desktopLink}>
                    <HomeIcon className="h-4.5 w-4.5" />
                    {t.nav.home}
                  </NavLink>
                </li>
                <li>
                  <NavLink to={`/u/${user.username}?tab=saved`} className={() => desktopLink({ isActive: onSaved })}>
                    <BookmarkIcon className="h-4.5 w-4.5" />
                    {t.nav.saved}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/messages" aria-label={messagesLabel} className={desktopLink}>
                    <ChatIcon className="h-4.5 w-4.5" />
                    {t.nav.messages}
                    {unread > 0 && (
                      <span aria-hidden="true" className="bg-brand-600 rounded-full px-1.5 text-xs leading-5 font-bold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </NavLink>
                </li>
              </ul>
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            {user ? (
              <>
                {/* Tablets: messages here; phones have them in the bottom bar. */}
                <Link to="/messages" aria-label={messagesLabel} className="icon-btn relative hidden sm:inline-flex md:hidden">
                  <ChatIcon />
                  <UnreadDot count={unread} />
                </Link>
                <Link to="/create" className="btn-primary hidden h-10 sm:inline-flex">
                  <PlusIcon className="h-4 w-4" />
                  {t.nav.newNote}
                </Link>
                <UserMenu user={user} />
              </>
            ) : (
              status === "signed-out" && (
                <>
                  <Link to="/login" className="btn-ghost hidden h-10 sm:inline-flex">
                    {t.nav.signIn}
                  </Link>
                  <Link to="/signup" className="btn-primary h-10">
                    {t.nav.signUp}
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* Thumb-reach navigation on phones. */}
      <nav
        aria-label={t.nav.mobileLabel}
        className={`bg-surface/95 border-line fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden ${
          inThread ? "hidden" : ""
        }`}
      >
        <ul className="flex">
          <li className="flex flex-1">
            <NavLink to="/" end className={tabLink}>
              <HomeIcon />
              {t.nav.home}
            </NavLink>
          </li>
          {user && (
            <li className="flex flex-1">
              <NavLink to={`/u/${user.username}?tab=saved`} className={() => tabLink({ isActive: onSaved })}>
                <BookmarkIcon />
                {t.nav.saved}
              </NavLink>
            </li>
          )}
          <li className="flex flex-1">
            <NavLink to={user ? "/create" : "/signup"} className={tabLink} aria-label={t.nav.newNote}>
              <span className="bg-brand-600 flex h-9 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
                <PlusIcon className="h-5 w-5" />
              </span>
            </NavLink>
          </li>
          {user && (
            <li className="flex flex-1">
              <NavLink to="/messages" aria-label={messagesLabel} className={tabLink}>
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
              <NavLink to={`/u/${user.username}`} className={() => tabLink({ isActive: onOwnProfile && !onSaved })}>
                <Avatar user={user} size="sm" className="h-6 w-6 text-[10px]" />
                {t.nav.profile}
              </NavLink>
            ) : (
              <NavLink to="/login" className={tabLink}>
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
