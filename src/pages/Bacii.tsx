import { useEffect, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { GraduationIcon, VideoIcon } from "../components/Icons";
import { t } from "../i18n/en";

interface BaciiOption {
  to: string;
  title: string;
  titleKm: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}

/** Everything in the BacII section; a new tool is one more entry here. */
const OPTIONS: BaciiOption[] = [
  {
    to: "/bacii/videos",
    title: t.bacii.videos.optionTitle,
    titleKm: t.bacii.videos.optionTitleKm,
    description: t.bacii.videos.optionDescription,
    Icon: VideoIcon,
  },
];

/** The BacII section: tools for Grade 12 students preparing for the national exam. */
export default function Bacii() {
  useEffect(() => {
    document.title = `${t.bacii.title} · ${t.common.appName}`;
  }, []);

  return (
    <div className="container-page max-w-4xl py-6 sm:py-10">
      <header className="mb-8 flex items-start gap-4">
        <span className="bg-ribbon-50 text-ribbon-fg flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
          <GraduationIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">{t.bacii.grade}</p>
          <h1 className="text-ink-900 text-3xl sm:text-4xl">
            {t.bacii.title} <span className="text-ink-500 font-normal">· {t.bacii.titleKm}</span>
          </h1>
          <p className="text-ink-500 mt-1 text-sm sm:text-base">{t.bacii.tagline}</p>
        </div>
      </header>

      <nav aria-label={t.bacii.optionsLabel}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map(({ to, title, titleKm, description, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="card press group hover:border-brand-500 flex h-full flex-col gap-3 p-5 transition-colors"
              >
                <span className="bg-brand-50 text-accent flex h-11 w-11 items-center justify-center rounded-xl">
                  <Icon className="h-5.5 w-5.5" />
                </span>
                <span>
                  <span className="font-display text-ink-900 group-hover:text-accent block text-lg font-bold">{title}</span>
                  <span className="text-ink-500 block text-sm">{titleKm}</span>
                </span>
                <span className="text-ink-700 text-sm leading-relaxed">{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
