import { useEffect, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, BookmarkIcon, ChatIcon, GraduationIcon, PlusIcon, SearchIcon, UserIcon } from "../components/Icons";
import Photo from "../components/Photo";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { BACII_TOOLS } from "../lib/baciiTools";

interface Step {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action: string;
  to: string;
}

/** The guide for new students: what Meh Rean is and how to use it, each step one tap from the real page. */
export default function Guide() {
  const { user } = useAuth();
  const copy = t.guide;
  const steps = copy.steps;
  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
  }, [copy.title]);

  const list: Step[] = [
    { Icon: UserIcon, ...steps.account, action: user ? steps.account.signedIn : steps.account.guest, to: user ? "/settings" : "/signup" },
    { Icon: SearchIcon, ...steps.find, to: "/" },
    { Icon: BookmarkIcon, ...steps.save, to: user ? `/u/${user.username}?tab=saved` : "/" },
    { Icon: ChatIcon, ...steps.ask, to: "/messages" },
    { Icon: PlusIcon, ...steps.share, to: "/create" },
    { Icon: GraduationIcon, ...steps.follow, to: "/u/library_bacii" },
  ];

  return (
    <div className="container-page max-w-3xl space-y-6 py-6 sm:py-10">
      <header className="card overflow-hidden">
        <Photo name="share" sizes="(min-width: 768px) 720px, 100vw" eager className="aspect-[5/2] w-full sm:aspect-[3/1]" />
        <div className="p-5 sm:p-7">
          <h1 className="text-ink-900 text-3xl sm:text-4xl">{copy.title}</h1>
          <p className="text-ink-500 mt-1.5 sm:text-lg">{copy.intro}</p>
        </div>
      </header>

      <section className="card p-5 sm:p-6" aria-labelledby="guide-what">
        <h2 id="guide-what" className="font-display text-ink-900 text-xl font-bold">
          {copy.whatTitle}
        </h2>
        <p className="text-ink-700 mt-2 leading-relaxed">{copy.what}</p>
      </section>

      <section aria-labelledby="guide-steps">
        <h2 id="guide-steps" className="font-display text-ink-900 mb-3 text-xl font-bold">
          {copy.stepsTitle}
        </h2>
        <ol className="space-y-3">
          {list.map(({ Icon, title, body, action, to }, index) => (
            <li key={title} className="card flex gap-4 p-4 sm:p-5">
              <span className="bg-brand-600 font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white" aria-hidden="true">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="sr-only">{copy.stepLabel(index + 1)}</p>
                <h3 className="text-ink-900 flex items-center gap-2 font-semibold sm:text-lg">
                  <Icon className="text-accent h-4.5 w-4.5 shrink-0" />
                  {title}
                </h3>
                <p className="text-ink-500 mt-1 text-sm leading-relaxed sm:text-base">{body}</p>
                <Link to={to} className="pill mt-3">
                  {action}
                  <ArrowLeftIcon className="ml-1.5 h-3.5 w-3.5 rotate-180" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="guide-bacii">
        <h2 id="guide-bacii" className="font-display text-ink-900 text-xl font-bold">
          {copy.baciiTitle}
        </h2>
        <p className="text-ink-500 mt-1 mb-3">{copy.baciiIntro}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {BACII_TOOLS.map(({ to, title, description, Icon }) => (
            <li key={to}>
              <Link to={to} className="card press hover:border-brand-500 flex h-full gap-3 p-4 transition-colors">
                <span className="bg-brand-50 text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-ink-900 block font-semibold">{title}</span>
                  <span className="text-ink-500 mt-1 line-clamp-2 block text-sm">{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/bacii" className="btn-secondary mt-3 h-10 px-4 text-sm">
          {copy.baciiOpen}
        </Link>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="guide-learning">
        <h2 id="guide-learning" className="font-display text-ink-900 text-xl font-bold">
          {copy.learningTitle}
        </h2>
        <p className="text-ink-700 mt-2 leading-relaxed">{copy.learningBody}</p>
        <Link to="/learning" className="pill mt-3">
          {copy.learningOpen}
        </Link>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="guide-tips">
        <h2 id="guide-tips" className="font-display text-ink-900 text-xl font-bold">
          {copy.tipsTitle}
        </h2>
        <ul className="text-ink-700 mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
          {copy.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <section className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <h2 className="font-display text-ink-900 text-xl font-bold">{copy.readyTitle}</h2>
        <div className="flex flex-wrap gap-2">
          {user ? (
            <Link to="/" className="btn-secondary h-10 px-4 text-sm">
              {copy.goHome}
            </Link>
          ) : (
            <Link to="/signup" className="btn-primary h-10 px-4 text-sm">
              {copy.join}
            </Link>
          )}
          <Link to="/bacii" className={`${user ? "btn-primary" : "btn-secondary"} h-10 px-4 text-sm`}>
            {copy.goBacii}
          </Link>
        </div>
      </section>
    </div>
  );
}
