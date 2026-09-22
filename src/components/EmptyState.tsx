import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ title, body, icon, action }: EmptyStateProps) {
  return (
    <div className="border-line bg-surface animate-rise flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      {icon && (
        <span className="bg-surface-hover text-ink-500 animate-pop flex h-12 w-12 items-center justify-center rounded-full">
          {icon}
        </span>
      )}
      <h2 className="text-ink-900 text-lg font-semibold">{title}</h2>
      <p className="text-ink-500 max-w-sm text-sm">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
