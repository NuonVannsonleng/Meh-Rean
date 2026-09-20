import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { t } from "./i18n/en";
import CourseDetail from "./pages/CourseDetail";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Upload from "./pages/Upload";

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-brand-600 sr-only rounded-lg px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        {t.common.skipToContent}
      </a>

      <Navbar />

      <main id="main" key={pathname} className="animate-fade flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="border-line bg-surface mt-12 border-t">
        <div className="container-page text-ink-500 py-6 text-sm">
          {t.footer.note}
        </div>
      </footer>
    </div>
  );
}
