import { useEffect } from "react";
import TrendingPanels from "../components/TrendingPanels";
import { t } from "../i18n/en";

/** What is popular right now: tags, schools and the most active students. */
export default function Explore() {
  useEffect(() => {
    document.title = `${t.explore.title} · ${t.common.appName}`;
  }, []);

  return (
    <div className="container-page max-w-5xl py-6 sm:py-10">
      <h1 className="text-ink-900 text-3xl sm:text-4xl">{t.explore.title}</h1>
      <p className="text-ink-500 mt-1.5 mb-6 sm:text-lg">{t.explore.intro}</p>
      <TrendingPanels className="grid items-start gap-4 md:grid-cols-3" />
    </div>
  );
}
