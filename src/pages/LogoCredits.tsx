import { useEffect, useMemo, useState } from "react";
import InstitutionLogo from "../components/InstitutionLogo";
import { SearchIcon } from "../components/Icons";
import { t } from "../i18n/en";
import { loadInstitutions, normalizeText } from "../lib/institutions";
import { loadLogoCredits, type LogoCredit } from "../lib/logos";

/** Rows rendered per "Show more"; the full list runs to thousands. */
const PAGE = 60;

interface Row extends LogoCredit {
  domain: string;
  name: string;
  haystack: string;
}

/**
 * Where every university logo came from. Many Commons logos are CC BY-SA,
 * which asks for the author and licence to be credited; this page does that.
 */
export default function LogoCredits() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    document.title = `${t.credits.title} · ${t.common.appName}`;
    let active = true;
    Promise.all([loadLogoCredits(), loadInstitutions().catch(() => null)])
      .then(([credits, data]) => {
        if (!active) return;
        const names = new Map(data?.institutions.map((item) => [item.domain.toLowerCase().replace(/^www\d*\./, ""), item.name]));
        const next = Object.entries(credits)
          .map(([domain, credit]) => {
            const name = credit.name ?? names.get(domain) ?? domain;
            return { ...credit, domain, name, haystack: normalizeText(`${name} ${domain} ${credit.license} ${credit.author}`) };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setRows(next);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      document.title = t.common.appName;
    };
  }, []);

  const filtered = useMemo(() => {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    return (rows ?? []).filter((row) => terms.every((term) => row.haystack.includes(term)));
  }, [rows, query]);

  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <h1 className="text-ink-900 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t.credits.title}</h1>

      <h2 className="text-ink-900 mt-6 text-lg font-semibold">{t.credits.schoolsHeading}</h2>
      <ul className="text-ink-700 mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>{t.credits.schoolsUniversities}</li>
        <li>{t.credits.schoolsWikidata}</li>
        <li>
          {t.credits.schoolsOsmBefore}
          {/* The ODbL asks for this credit and a link to the licence. */}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="link font-medium">
            {t.credits.schoolsOsmLink}
          </a>
          {t.credits.schoolsOsmAfter}
        </li>
      </ul>

      <h2 className="text-ink-900 mt-8 text-lg font-semibold">{t.credits.logosHeading}</h2>
      <p className="text-ink-700 mt-2">{t.credits.intro}</p>
      <p className="text-ink-500 mt-2 text-sm">{t.credits.trademark}</p>

      <label className="relative mt-6 block">
        <span className="sr-only">{t.credits.search}</span>
        <SearchIcon className="text-ink-400 pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE);
          }}
          placeholder={t.credits.search}
          className="input pl-11"
        />
      </label>

      {failed ? (
        <p className="text-ink-500 mt-6 text-sm">{t.error.body}</p>
      ) : rows === null ? (
        <p role="status" className="text-ink-500 mt-6 text-sm">
          {t.common.loading}
        </p>
      ) : (
        <>
          <p className="text-ink-500 mt-4 text-sm" aria-live="polite">
            {t.credits.count(filtered.length)}
          </p>
          <ul className="divide-line border-line bg-surface mt-3 divide-y rounded-2xl border">
            {filtered.slice(0, shown).map((row) => (
              <li key={row.domain} className="flex items-start gap-3 px-4 py-3">
                <InstitutionLogo name={row.name} domain={row.domain} className="h-10 w-10" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-ink-900 font-semibold">{row.name}</p>
                  <p className="text-ink-500 break-words">
                    <a href={row.page} target="_blank" rel="noopener noreferrer" className="link font-medium">
                      {row.file.replace(/^File:/, "")}
                    </a>
                    {" · "}
                    {row.license || t.credits.unknownLicense}
                    {row.author && ` · ${t.credits.by(row.author)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((count) => count + PAGE * 4)} className="btn-secondary mt-4 w-full">
              {t.credits.more(filtered.length - shown)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
