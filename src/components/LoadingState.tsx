import { t } from "../i18n/en";

interface LoadingStateProps {
  /** Number of skeleton cards to render. */
  count?: number;
  variant?: "card" | "row";
}

function Bar({ className }: { className: string }) {
  return (
    <div
      className={`bg-surface-muted animate-shimmer rounded-md ${className}`}
    />
  );
}

export default function LoadingState({
  count = 6,
  variant = "card",
}: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        variant === "card"
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          : "space-y-3"
      }
    >
      <span className="sr-only">{t.common.loading}</span>
      {items.map((item) => (
        <div
          key={item}
          aria-hidden="true"
          style={{ animationDelay: `${item * 70}ms` }}
          className={`border-line bg-surface animate-fade rounded-2xl border p-5 ${
            variant === "card" ? "h-46" : "h-26"
          }`}
        >
          <Bar className="h-5 w-16" />
          <Bar className="mt-4 h-4 w-3/4" />
          <Bar className="mt-2.5 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
