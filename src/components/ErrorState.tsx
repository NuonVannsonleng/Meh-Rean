import { t } from "../i18n/en";
import { AlertIcon } from "./Icons";

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
}

export default function ErrorState({ title, body, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="card animate-rise flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="bg-danger-bg text-danger-fg animate-pop flex h-12 w-12 items-center justify-center rounded-full">
        <AlertIcon className="h-6 w-6" />
      </span>
      <h2 className="text-ink-900 text-lg font-semibold">{title ?? t.error.title}</h2>
      <p className="text-ink-500 max-w-sm text-sm">{body ?? t.error.body}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary mt-2">
          {t.common.tryAgain}
        </button>
      )}
    </div>
  );
}
