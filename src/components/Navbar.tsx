import { NavLink } from "react-router-dom";
import { t } from "../i18n/en";
import { BooksIcon, UploadIcon } from "./Icons";

const linkBase =
  "press inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50 hover:text-brand-700";

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${linkBase} bg-brand-50 text-brand-700`
    : `${linkBase} text-ink-700`;
}

export default function Navbar() {
  return (
    <header className="bg-surface/90 border-line sticky top-0 z-40 border-b backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between gap-3 sm:h-16">
        <NavLink
          to="/"
          aria-label={t.nav.logoAria}
          className="text-ink-900 hover:text-brand-700 group flex items-center gap-2 rounded-lg text-base font-bold tracking-tight transition-colors duration-200 sm:text-lg"
        >
          <span className="bg-brand-600 group-hover:bg-brand-700 flex h-8 w-8 items-center justify-center rounded-lg text-white transition-[background-color,transform] duration-200 group-hover:scale-105">
            <BooksIcon className="h-[18px] w-[18px]" />
          </span>
          <span>{t.common.appName}</span>
        </NavLink>

        <nav aria-label={t.nav.label}>
          <ul className="flex items-center gap-1">
            <li>
              <NavLink to="/" end className={linkClass}>
                {t.nav.courses}
              </NavLink>
            </li>
            <li>
              <NavLink to="/upload" className={linkClass}>
                <UploadIcon className="h-4 w-4" />
                {t.nav.upload}
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
