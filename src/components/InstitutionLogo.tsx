import { useEffect, useState } from "react";
import { t } from "../i18n/en";
import { loadLogoIndex, loadOfficialLogos, logoUrl, officialLogoUrl } from "../lib/logos";

interface InstitutionLogoProps {
  name: string;
  domain: string | null;
  className?: string;
}

type Source = { kind: "pending" } | { kind: "initial" } | { kind: "commons" | "official" | "favicon"; src: string };

function normalize(domain: string): string {
  return domain.toLowerCase().replace(/^www\d*\./, "");
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/**
 * The logo of a school or university, from the best source that has one:
 *
 * 1. Its real logo from Wikimedia Commons, downloaded into public/logos/ and
 *    served by us (see scripts/build-logos.mjs).
 * 2. A hand-checked logo on its own website (public/logos/official.json),
 *    resized by the wsrv.nl image CDN.
 * 3. Its website's icon from Google's favicon service.
 *
 * 2 and 3 are requested by whoever is *looking*, so they tell those services
 * this visitor viewed a page about that school; `referrerPolicy` keeps our own
 * URL out of it. Schools typed in by hand have no domain, and when nothing
 * real is found the tile shows the name's initial rather than a stand-in.
 */
export default function InstitutionLogo({ name, domain, className = "h-8 w-8" }: InstitutionLogoProps) {
  const key = domain ? normalize(domain) : null;
  const [source, setSource] = useState<Source>({ kind: key ? "pending" : "initial" });

  useEffect(() => {
    if (!key) {
      setSource({ kind: "initial" });
      return;
    }
    let active = true;
    setSource({ kind: "pending" });
    void Promise.all([loadLogoIndex(), loadOfficialLogos()]).then(([index, official]) => {
      if (!active) return;
      const link = official.get(key);
      if (index.has(key)) setSource({ kind: "commons", src: logoUrl(key) });
      else if (link) setSource({ kind: "official", src: officialLogoUrl(link) });
      else setSource({ kind: "favicon", src: faviconUrl(key) });
    });
    return () => {
      active = false;
    };
  }, [key]);

  if (!key || source.kind === "initial" || source.kind === "pending") {
    return (
      <span
        aria-hidden="true"
        className={`bg-surface-hover text-ink-500 flex shrink-0 items-center justify-center rounded-lg text-sm font-bold ${className}`}
      >
        {source.kind === "pending" ? "" : name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  /** Each source falls through to the next one when it has nothing. */
  const next = () =>
    setSource(source.kind === "favicon" || !key ? { kind: "initial" } : { kind: "favicon", src: faviconUrl(key) });

  return (
    <img
      key={source.src}
      src={source.src}
      alt={t.institution.logoAlt(name)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      width={source.kind === "favicon" ? 64 : 96}
      height={source.kind === "favicon" ? 64 : 96}
      onError={next}
      onLoad={(event) => {
        // Google answers an unknown site with a 16px grey globe (and a real
        // but 16px icon is a blur at this size): neither is the school's logo.
        if (source.kind === "favicon" && event.currentTarget.naturalWidth <= 16) setSource({ kind: "initial" });
      }}
      // Always a light tile: many logos are dark ink on transparency and would
      // disappear on the dark theme's surface.
      className={`border-line shrink-0 rounded-lg border bg-white object-contain p-0.5 ${className}`}
    />
  );
}
