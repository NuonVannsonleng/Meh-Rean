import { Link } from "react-router-dom";
import { t } from "../i18n/en";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center py-20 text-center sm:py-28">
      <p className="text-brand-600 animate-pop text-5xl font-bold tracking-tight sm:text-6xl">
        {t.notFound.code}
      </p>
      <h1 className="text-ink-900 animate-rise mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
        {t.notFound.title}
      </h1>
      <p className="text-ink-500 mt-2 max-w-sm text-sm sm:text-base">
        {t.notFound.body}
      </p>
      <Link
        to="/"
        className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 press animate-rise mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
      >
        {t.notFound.action}
      </Link>
    </div>
  );
}
