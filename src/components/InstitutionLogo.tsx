import { useEffect, useState } from "react";
import { t } from "../i18n/en";

interface InstitutionLogoProps {
  name: string;
  domain: string | null;
  className?: string;
}

/**
 * The logo of a school or university.
 *
 * Logos are fetched from Google's favicon service, keyed by the institution's
 * domain. The request is made by whoever is *looking* at a profile, once per
 * profile they open, so it tells Google that this visitor viewed a page about
 * that school; `referrerPolicy` keeps our own URL out of it. Schools typed in
 * by hand have no domain, and anything that fails to load falls back to a
 * neutral initial tile.
 */
export default function InstitutionLogo({ name, domain, className = "h-8 w-8" }: InstitutionLogoProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [domain]);

  if (!domain || failed) {
    return (
      <span
        aria-hidden="true"
        className={`bg-surface-hover text-ink-500 flex shrink-0 items-center justify-center rounded-lg text-sm font-bold ${className}`}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt={t.institution.logoAlt(name)}
      loading="lazy"
      referrerPolicy="no-referrer"
      width={64}
      height={64}
      onError={() => setFailed(true)}
      className={`border-line bg-surface shrink-0 rounded-lg border object-contain p-0.5 ${className}`}
    />
  );
}
