import type { ReactNode } from "react";
import { t } from "../i18n/en";
import Logo from "./Logo";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="container-page flex max-w-md flex-col py-8 sm:py-14">
      <div className="mb-6 text-center">
        <Logo stacked animated className="mb-5" />
        <h1 className="text-ink-900 text-2xl font-display font-extrabold tracking-tight">{title}</h1>
        <p className="text-ink-500 mt-2">{subtitle}</p>
      </div>
      <div className="card p-5 sm:p-7">{children}</div>
      <p className="text-ink-700 mt-6 text-center text-sm">{footer}</p>
      <p className="text-ink-400 mt-3 text-center text-xs">{t.auth.localNotice}</p>
    </div>
  );
}
