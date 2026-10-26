"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Framework control-flow errors (redirect, notFound, refresh) surface here as
 * thrown values. They must keep propagating or role guards break.
 */
function isFrameworkError(error: Error & { digest?: string }) {
  return (
    error.digest?.startsWith("NEXT_") ||
    /NEXT_REDIRECT|INVALID_VIEWPORT|dynamic server usage/i.test(error.message ?? "")
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isFrameworkError(error)) console.error(error);
  }, [error]);

  if (isFrameworkError(error)) throw error;

  return (
    <div className="paper-texture flex min-h-dvh items-center justify-center px-5">
      <div className="surface-card w-full max-w-lg p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-5 font-serif text-2xl text-ink">The catalogue hit an unexpected error</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Nothing was lost — your loans and records are safe in the database. Try again, and if it
          keeps happening show this code to the library systems administrator.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">Reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-brand-700"
          >
            <RotateCcw className="size-4" /> Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Home className="size-4" /> Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
