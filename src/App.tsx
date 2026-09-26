import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import { t } from "./i18n/en";
import CreatePost from "./pages/CreatePost";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";
import PostDetail from "./pages/PostDetail";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";

export default function App() {
  const { pathname } = useLocation();
  // Chat fills the screen exactly: the thread scrolls, not the page.
  const fullHeight = pathname === "/messages" || pathname.startsWith("/messages/");
  // An open thread on a phone gets the whole screen, like any messenger.
  const inThread = pathname.startsWith("/messages/");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className={`flex flex-col ${fullHeight ? "h-dvh" : "min-h-dvh"}`}>
      <a
        href="#main"
        className="bg-brand-600 sr-only rounded-lg px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        {t.common.skipToContent}
      </a>

      <Navbar />

      <main
        id="main"
        key={fullHeight ? "messages" : pathname}
        className={`animate-page flex-1 ${fullHeight ? "flex min-h-0 flex-col" : ""} ${
          inThread
            ? "pb-[env(safe-area-inset-bottom)] sm:pb-0"
            : fullHeight
              ? // Exactly the bottom bar's height, so the inbox meets it with no gap.
                "pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0"
              : "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0"
        }`}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/create"
            element={
              <RequireAuth>
                <CreatePost />
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route
            path="/messages/:username"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className={`border-line bg-surface mt-12 hidden border-t ${fullHeight ? "" : "sm:block"}`}>
        <div className="container-page text-ink-500 flex flex-col gap-1 py-6 text-sm sm:flex-row sm:justify-between">
          <p>{t.footer.note}</p>
          <p>{t.footer.local}</p>
        </div>
      </footer>
    </div>
  );
}
