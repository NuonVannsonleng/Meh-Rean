import { t } from "../i18n/en";

interface VerifiedBadgeProps {
  className?: string;
}

/** Blue check shown next to the names of approved accounts. */
export default function VerifiedBadge({ className = "h-4 w-4" }: VerifiedBadgeProps) {
  return (
    <span className={`text-verified inline-flex shrink-0 ${className}`} title={t.verification.badge}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" role="img" aria-label={t.verification.badge}>
        <path d="M12 1.6l2.6 2.1 3.3-.3.9 3.2 2.8 1.8-1.3 3.1 1.3 3.1-2.8 1.8-.9 3.2-3.3-.3L12 22.4l-2.6-2.1-3.3.3-.9-3.2-2.8-1.8L3.7 12.5 2.4 9.4l2.8-1.8.9-3.2 3.3.3z" />
        <path d="m8.2 12.4 2.6 2.6 5-5.2" fill="none" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
