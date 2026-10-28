import { useState } from "react";
import { t } from "../i18n/en";
import { DEVELOPER_CONTACT } from "../lib/contact";
import { BulbIcon, CloseIcon } from "./Icons";

/** Closing hides it for this visit only (session storage): every new visit shows it again. */
const HIDDEN_KEY = "mehrean.demoNoticeHidden";

function hiddenNow(): boolean {
  try {
    return sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** The demo reminder at the top of every page, with the developer's contacts. */
export default function DemoNotice() {
  const [hidden, setHidden] = useState(hiddenNow);
  if (hidden) return null;
  const copy = t.demo;
  const hide = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      // Storage can be blocked; the reminder simply shows again next visit.
    }
  };
  return (
    <aside aria-label={copy.title} className="bg-brand-50 border-line border-b" data-testid="demo-notice">
      <div className="container-page flex items-start gap-2.5 py-2 text-sm sm:items-center">
        <BulbIcon className="text-accent mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
        <p className="text-ink-700 min-w-0 flex-1 leading-snug">
          <strong className="text-ink-900 font-semibold">{copy.title}</strong> {copy.body} {copy.contact}{" "}
          <a href={DEVELOPER_CONTACT.emailUrl} className="link font-semibold" title={DEVELOPER_CONTACT.email}>
            {copy.email}
          </a>{" "}
          {copy.or}{" "}
          <a href={DEVELOPER_CONTACT.telegramUrl} target="_blank" rel="noopener noreferrer" className="link font-semibold" title={DEVELOPER_CONTACT.telegram}>
            {copy.telegram}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={hide}
          aria-label={copy.hide}
          className="text-ink-500 hover:bg-surface-hover hover:text-ink-900 -my-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
