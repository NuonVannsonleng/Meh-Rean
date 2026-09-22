import { t } from "../i18n/en";

interface LoadingStateProps {
  count?: number;
  variant?: "post" | "block";
}

function Bar({ className }: { className: string }) {
  return <div className={`bg-surface-hover animate-shimmer rounded-md ${className}`} />;
}

export default function LoadingState({ count = 3, variant = "post" }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, index) => index);

  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{t.common.loading}</span>
      {items.map((item) => (
        <div
          key={item}
          aria-hidden="true"
          style={{ animationDelay: `${item * 70}ms` }}
          className="card animate-fade p-4 sm:p-5"
        >
          {variant === "post" ? (
            <>
              <div className="flex items-center gap-3">
                <Bar className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bar className="h-3.5 w-32" />
                  <Bar className="h-3 w-48" />
                </div>
              </div>
              <Bar className="mt-5 h-5 w-3/4" />
              <Bar className="mt-3 h-4 w-full" />
              <Bar className="mt-2 h-4 w-2/3" />
              <Bar className="mt-5 h-40 w-full rounded-xl" />
            </>
          ) : (
            <>
              <Bar className="h-5 w-1/3" />
              <Bar className="mt-4 h-4 w-3/4" />
              <Bar className="mt-2.5 h-4 w-1/2" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
