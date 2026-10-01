import { useEffect, useState } from "react";
import { t } from "../i18n/en";
import { loadLogoIndex, logoUrl } from "../lib/logos";

interface InstitutionLogoProps {
  name: string;
  domain: string | null;
  className?: string;
}

type Source = "pending" | "logo" | "favicon" | "initial";

function normalize(domain: string): string {
  return domain.toLowerCase().replace(/^www\d*\./, "");
}

/**
 * The logo of a school or university.
 *
 * First choice is the institution's real logo, downloaded from Wikimedia
 * Commons into public/logos/ and served by us (see scripts/build-logos.mjs).
 * Institutions without one fall back to their website's icon from Google's
 * favicon service: that request is made by whoever is *looking*, so it tells
 * Google this visitor viewed a page about that school, and `referrerPolicy`
 * keeps our own URL out of it. Schools typed in by hand have no domain, and
 * anything that fails to load ends on a neutral initial tile.
 */
export default function InstitutionLogo({ name, domain, className = "h-8 w-8" }: InstitutionLogoProps) {
  const key = domain ? normalize(domain) : null;
  const [source, setSource] = useState<Source>(key ? "pending" : "initial");

  useEffect(() => {
    if (!key) {
      setSource("initial");
      return;
    }
    let active = true;
    setSource("pending");
    void loadLogoIndex().then((index) => {
      if (active) setSource(index.has(key) ? "logo" : "favicon");
    });
    return () => {
      active = false;
    };
  }, [key]);

  if (!key || source === "initial" || source === "pending") {
    return (
      <span
        aria-hidden="true"
        className={`bg-surface-hover text-ink-500 flex shrink-0 items-center justify-center rounded-lg text-sm font-bold ${className}`}
      >
        {source === "pending" ? "" : name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  const fromCommons = source === "logo";
  return (
    <img
      src={fromCommons ? logoUrl(key) : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(key)}&sz=64`}
      alt={t.institution.logoAlt(name)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      width={fromCommons ? 96 : 64}
      height={fromCommons ? 96 : 64}
      onError={() => setSource(fromCommons ? "favicon" : "initial")}
      // Always a light tile: many logos are dark ink on transparency and would
      // disappear on the dark theme's surface.
      className={`border-line shrink-0 rounded-lg border bg-white object-contain p-0.5 ${className}`}
    />
  );
}
