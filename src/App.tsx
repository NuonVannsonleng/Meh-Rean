import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import LoadingState from "./components/LoadingState";
import { t } from "./i18n/en";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// The home page ships in the main file; every other page is downloaded when
// it is first opened, so a phone on mobile data starts with less.
const Bacii = lazy(() => import("./pages/Bacii"));
const BaciiVideos = lazy(() => import("./pages/BaciiVideos"));
const BaciiPapers = lazy(() => import("./pages/BaciiPapers"));
const BaciiPaper = lazy(() => import("./pages/BaciiPaper"));
const BaciiPractice = lazy(() => import("./pages/BaciiPractice"));
const BaciiExam = lazy(() => import("./pages/BaciiExam"));
const BaciiAttempt = lazy(() => import("./pages/BaciiAttempt"));
const BaciiMistakes = lazy(() => import("./pages/BaciiMistakes"));
const BaciiToday = lazy(() => import("./pages/BaciiToday"));
const BaciiPlan = lazy(() => import("./pages/BaciiPlan"));
const BaciiSolve = lazy(() => import("./pages/BaciiSolve"));
const BaciiMyVideos = lazy(() => import("./pages/BaciiMyVideos"));
const LiveHub = lazy(() => import("./pages/live/LiveHub"));
const LearningProfilePage = lazy(() => import("./pages/LearningProfilePage"));
const TopicPage = lazy(() => import("./pages/learning/TopicPage"));
const ConceptMapPage = lazy(() => import("./pages/learning/ConceptMapPage"));
const AdaptivePractice = lazy(() => import("./pages/learning/AdaptivePractice"));
const JourneyPage = lazy(() => import("./pages/learning/JourneyPage"));
const RevisionPage = lazy(() => import("./pages/learning/RevisionPage"));
const HistoryPage = lazy(() => import("./pages/learning/HistoryPage"));
const CompanionPage = lazy(() => import("./pages/learning/CompanionPage"));
const LiveQuizEditor = lazy(() => import("./pages/live/LiveQuizEditor"));
const LiveHost = lazy(() => import("./pages/live/LiveHost"));
const LivePlay = lazy(() => import("./pages/live/LivePlay"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const LogoCredits = lazy(() => import("./pages/LogoCredits"));
const Login = lazy(() => import("./pages/Login"));
const Messages = lazy(() => import("./pages/Messages"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Signup = lazy(() => import("./pages/Signup"));

/** Admin pages: downloaded only by the admins who open them. */
const AdminQuestions = lazy(() => import("./pages/admin/AdminQuestions"));
const QuestionEditor = lazy(() => import("./pages/admin/QuestionEditor"));
const AdminChannels = lazy(() => import("./pages/admin/AdminChannels"));
const AdminQuizzes = lazy(() => import("./pages/admin/AdminQuizzes"));
const AdminTopicVideos = lazy(() => import("./pages/admin/AdminTopicVideos"));
const AdminTopicLinks = lazy(() => import("./pages/admin/AdminTopicLinks"));

const adminPage = (page: ReactNode) => (
  <RequireAdmin>
    <Suspense
      fallback={
        <div className="container-page max-w-3xl py-8">
          <LoadingState count={2} variant="block" />
        </div>
      }
    >
      {page}
    </Suspense>
  </RequireAdmin>
);

/** Development-only tools; the condition is false in production builds, so they are left out. */
const MathPreview = import.meta.env.DEV ? lazy(() => import("./pages/dev/MathPreview")) : null;

export default function App() {
  const { pathname } = useLocation();
  // Chat fills the screen exactly: the thread scrolls, not the page.
  const fullHeight = pathname === "/messages" || pathname.startsWith("/messages/");
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
        <Suspense
          fallback={
            <div className="container-page max-w-3xl py-8">
              <LoadingState count={2} variant="block" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/credits/logos" element={<LogoCredits />} />
            <Route path="/bacii" element={<Bacii />} />
            <Route path="/bacii/videos" element={<BaciiVideos />} />
            <Route path="/bacii/papers" element={<BaciiPapers />} />
            <Route path="/bacii/papers/:id" element={<BaciiPaper />} />
            <Route path="/bacii/practice" element={<BaciiPractice />} />
            <Route
              path="/bacii/papers/:id/exam"
              element={
                <RequireAuth>
                  <BaciiExam />
                </RequireAuth>
              }
            />
            <Route
              path="/bacii/attempts/:id"
              element={
                <RequireAuth>
                  <BaciiAttempt />
                </RequireAuth>
              }
            />
            <Route path="/bacii/solve" element={<BaciiSolve />} />
            <Route path="/live" element={<RequireAuth><LiveHub /></RequireAuth>} />
            <Route path="/learning/profile" element={<RequireAuth><LearningProfilePage /></RequireAuth>} />
            <Route path="/learning/topics/:topicId" element={<TopicPage />} />
            <Route path="/learning/map" element={<ConceptMapPage />} />
            <Route path="/learning/practice" element={<RequireAuth><AdaptivePractice /></RequireAuth>} />
            <Route path="/learning/journey" element={<RequireAuth><JourneyPage /></RequireAuth>} />
            <Route path="/learning/revision" element={<RequireAuth><RevisionPage /></RequireAuth>} />
            <Route path="/learning/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
            <Route path="/learning/companion" element={<RequireAuth><CompanionPage /></RequireAuth>} />
            <Route path="/live/quizzes/new" element={<RequireAuth><LiveQuizEditor key="new" /></RequireAuth>} />
            <Route path="/live/quizzes/:id" element={<RequireAuth><LiveQuizEditor /></RequireAuth>} />
            <Route path="/live/host/:id" element={<RequireAuth><LiveHost /></RequireAuth>} />
            <Route path="/live/play/:id" element={<RequireAuth><LivePlay /></RequireAuth>} />
            <Route
              path="/bacii/my-videos"
              element={
                <RequireAuth>
                  <BaciiMyVideos />
                </RequireAuth>
              }
            />
            <Route
              path="/bacii/plan"
              element={
                <RequireAuth>
                  <BaciiPlan />
                </RequireAuth>
              }
            />
            <Route
              path="/bacii/today"
              element={
                <RequireAuth>
                  <BaciiToday />
                </RequireAuth>
              }
            />
            <Route
              path="/bacii/mistakes"
              element={
                <RequireAuth>
                  <BaciiMistakes />
                </RequireAuth>
              }
            />
            <Route path="/bacii/admin/questions" element={adminPage(<AdminQuestions />)} />
            <Route path="/bacii/admin/channels" element={adminPage(<AdminChannels />)} />
            <Route path="/bacii/admin/quizzes" element={adminPage(<AdminQuizzes />)} />
            <Route path="/bacii/admin/topic-videos" element={adminPage(<AdminTopicVideos />)} />
            <Route path="/bacii/admin/topic-links" element={adminPage(<AdminTopicLinks />)} />
            <Route path="/bacii/admin/questions/new" element={adminPage(<QuestionEditor key="new" />)} />
            <Route path="/bacii/admin/questions/:id" element={adminPage(<QuestionEditor />)} />
            <Route
              path="/post/:id/edit"
              element={
                <RequireAuth>
                  <CreatePost />
                </RequireAuth>
              }
            />
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
            {MathPreview && (
              <Route
                path="/dev/math"
                element={
                  <Suspense fallback={null}>
                    <MathPreview />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <footer className={`border-line bg-surface mt-12 hidden border-t ${fullHeight ? "" : "sm:block"}`}>
        <div className="container-page text-ink-500 flex flex-col gap-1 py-6 text-sm sm:flex-row sm:justify-between">
          <p>
            {t.footer.note}{" "}
            <Link to="/credits/logos" className="hover:text-ink-700 underline underline-offset-2">
              {t.credits.link}
            </Link>
          </p>
          <p>{t.footer.local}</p>
        </div>
      </footer>
    </div>
  );
}
