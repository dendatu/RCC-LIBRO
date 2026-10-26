import Link from "next/link";
import { BookX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="paper-texture flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-lg text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          <BookX className="size-7" />
        </span>
        <p className="mt-6 font-mono text-sm tracking-[0.3em] text-brand-500">404</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Shelf empty</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          The page you were looking for is not in the catalogue. It may have been withdrawn, or the
          link was mistyped.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-cream hover:bg-brand-700"
          >
            Go to dashboard
          </Link>
          <Link
            href="/opac"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Search the catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
