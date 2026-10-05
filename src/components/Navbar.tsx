import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useDismiss } from "../hooks/useDismiss";
import { t } from "../i18n/en";
import Avatar from "./Avatar";
import GlobalSearch from "./GlobalSearch";
import {
  BookmarkIcon,
  ChatIcon,
  ChevronDownIcon,
  CloseIcon,
  FileTextIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "./Icons";
import { LogoMark } from "./Logo";
import ThemeSwitcher from "./ThemeSwitcher";
import UserMenu from "./UserMenu";
import VerifiedBadge from "./VerifiedBadge";

/** Unread count on top of an icon; the count itself is in the link's label. */
function UnreadDot({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      aria-hidden="true"
      className="bg-brand-600 ring-surface-muted animate-pop absolute -top-1 -right-1 min-w-4.5 rounded-full px-1 text-center text-[10px] leading-4.5 font-bold text-white ring-2"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Where the page is, after the logo: "Dashboard", "alex", "alex / Linear algebra notes". */
function Context() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const profile = /^\/u\/([^/]+)/.exec(pathname)?.[1];
  let label: ReactNode = null;
  if (pathname === "/") label = user ? t.nav.dashboard : t.nav.explore;
  else if (profile) label = <Link to={`/u/${profile}`} className="hover:underline">{decodeURIComponent(profile)}</Link>;
  else if (pathname.startsWith("/messages")) label = t.nav.messages;
  else if (pathname === "/create") label = t.nav.newNote;
  else if (pathname === "/settings") label = t.nav.settings;
  if (!label) return null;
  return <span className="text-ink-900 hidden min-w-0 truncate text-sm font-semibold sm:inline">{label}</span>;
}

const drawerLink = ({ isActive }: { isActive: boolean }) =>
  `press flex h-9 items-center gap-3 rounded-md px-2 text-sm ${
    isActive ? "bg-surface-hover text-ink-900 font-semibold" : "text-ink-700 hover:bg-surface-hover hover:text-ink-900"
  }`;

/** The slide-out menu behind ☰: every place in the app, on every screen size. */
function Drawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { user, signOut } = useAuth();
  const { unread } = useChat();
  const { notify } = useToast();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={t.nav.menuLabel}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <nav
        aria-label={t.nav.label}
        onClick={(event) => {
          // Following a link closes the menu.
          if ((event.target as HTMLElement).closest("a")) close();
        }}
        className="bg-surface border-line animate-drawer flex h-full w-[min(20rem,85vw)] flex-col border-r pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label={t.nav.logoAria} className="rounded-md">
            <LogoMark className="h-8 w-8" />
          </Link>
          <button type="button" onClick={close} aria-label={t.nav.closeMenu} className="icon-btn">
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {user && (
            <Link to={`/u/${user.username}`} className="hover:bg-surface-hover mb-2 flex items-center gap-3 rounded-md px-2 py-2">
              <Avatar user={user} size="sm" />
              <span className="min-w-0">
                <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold">
                  <span className="truncate">{user.displayName}</span>
                  {user.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                </span>
                <span className="text-ink-500 block truncate text-xs">{user.username}</span>
              </span>
            </Link>
          )}
          <ul className="space-y-0.5">
            <li>
              <NavLink to="/" end className={drawerLink}>
                <HomeIcon className="h-4 w-4" />
                {user ? t.nav.dashboard : t.nav.explore}
              </NavLink>
            </li>
            {user && (
              <>
                <li>
                  <NavLink to={`/u/${user.username}?tab=notes`} className={drawerLink}>
                    <FileTextIcon className="h-4 w-4" />
                    {t.nav.yourNotes}
                  </NavLink>
                </li>
                <li>
                  <NavLink to={`/u/${user.username}?tab=saved`} className={drawerLink}>
                    <BookmarkIcon className="h-4 w-4" />
                    {t.nav.saved}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/messages" className={drawerLink} aria-label={unread ? t.nav.messagesUnread(unread) : undefined}>
                    <ChatIcon className="h-4 w-4" />
                    {t.nav.messages}
                    {unread > 0 && (
                      <span className="bg-brand-600 ml-auto rounded-full px-1.5 text-xs leading-5 font-semibold text-white" aria-hidden="true">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </NavLink>
                </li>
                <li>
                  <NavLink to={`/u/${user.username}`} end className={drawerLink}>
                    <UserIcon className="h-4 w-4" />
                    {t.nav.yourProfile}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/settings" className={drawerLink}>
                    <SettingsIcon className="h-4 w-4" />
                    {t.nav.settings}
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          {user && (
            <Link to="/create" className="btn-primary mt-3 w-full">
              <PlusIcon className="h-4 w-4" />
              {t.nav.newNote}
            </Link>
          )}

          <div className="border-line mt-4 border-t px-1 pt-4">
            <ThemeSwitcher />
          </div>
        </div>

        <div className="border-line border-t p-2">
          {user ? (
            <button
              type="button"
              onClick={async () => {
                close();
                await signOut();
                notify(t.nav.signedOut);
              }}
              className="press text-ink-700 hover:bg-surface-hover flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm"
            >
              <LogOutIcon className="h-4 w-4" />
              {t.nav.signOut}
            </button>
          ) : (
            <div className="flex gap-2 p-1">
              <Link to="/login" className="btn-secondary flex-1">
                {t.nav.signIn}
              </Link>
              <Link to="/signup" className="btn-primary flex-1">
                {t.nav.signUp}
              </Link>
            </div>
          )}
          <Link to="/credits/logos" className="text-ink-500 hover:text-ink-900 block px-2 pt-2 text-xs hover:underline">
            {t.credits.link}
          </Link>
        </div>
      </nav>
    </dialog>
  );
}

/** "+ ▾": the things you can make. */
function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const item = "press text-ink-700 hover:bg-surface-hover hover:text-ink-900 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.nav.createMenu}
        className="press border-line text-ink-500 hover:text-ink-900 hover:bg-surface-hover flex h-8 items-center gap-0.5 rounded-md border px-1.5"
      >
        <PlusIcon className="h-4 w-4" />
        <ChevronDownIcon className="h-3 w-3" />
      </button>
      {open && (
        <div role="menu" className="card animate-pop absolute right-0 z-50 mt-1.5 w-48 origin-top-right p-1.5 shadow-lg">
          <Link role="menuitem" to="/create" onClick={close} className={item}>
            <FileTextIcon className="h-4 w-4" />
            {t.nav.newNote}
          </Link>
          <Link role="menuitem" to="/messages?compose=1" onClick={close} className={item}>
            <ChatIcon className="h-4 w-4" />
            {t.nav.newMessage}
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, status } = useAuth();
  const { unread } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const messagesLabel = unread ? t.nav.messagesUnread(unread) : t.nav.messages;

  return (
    <header className="bg-surface-muted border-line sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-[max(1rem,env(safe-area-inset-left))] sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t.nav.openMenu}
          aria-haspopup="dialog"
          className="press border-line text-ink-500 hover:text-ink-900 hover:bg-surface-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
        >
          <MenuIcon className="h-4 w-4" />
        </button>
        <Link to="/" aria-label={t.nav.logoAria} className="shrink-0 rounded-md">
          <LogoMark className="h-8 w-8" />
        </Link>
        <Context />

        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          {user ? (
            <>
              <CreateMenu />
              <Link
                to="/messages"
                aria-label={messagesLabel}
                className="press border-line text-ink-500 hover:text-ink-900 hover:bg-surface-hover relative flex h-8 w-8 items-center justify-center rounded-md border"
              >
                <ChatIcon className="h-4 w-4" />
                <UnreadDot count={unread} />
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            status === "signed-out" && (
              <>
                <Link to="/login" className="btn-ghost hidden h-8 px-2.5 sm:inline-flex">
                  {t.nav.signIn}
                </Link>
                <Link to="/signup" className="btn-secondary h-8 px-2.5">
                  {t.nav.signUp}
                </Link>
              </>
            )
          )}
        </div>
      </div>
      {menuOpen && <Drawer onClose={() => setMenuOpen(false)} />}
    </header>
  );
}
