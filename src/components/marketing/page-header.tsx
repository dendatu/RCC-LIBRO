import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Interior page banner for the public pages (policies, about, catalogue). */
export function PageHeader({
  eyebrow,
  title,
  intro,
  breadcrumb,
  className,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  breadcrumb?: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <section className={cn("paper-texture border-b border-brand-100", className)}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {breadcrumb ? (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-brand-300" aria-hidden /> : null}
                  {index === breadcrumb.length - 1 ? (
                    <span aria-current="page" className="font-medium text-brand-800">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href} className="transition-colors hover:text-brand-800">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-[2rem] leading-[1.12] text-ink text-balance sm:text-[2.5rem]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-ink-soft sm:text-[16.5px] sm:leading-8">
          {intro}
        </p>
      </div>
    </section>
  );
}

/** Numbered policy panel reused by the policies and about pages. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-none space-y-4 text-[15px] leading-7 text-ink-soft [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:decoration-brand-200 [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-[17px] [&_h3]:text-ink [&_li]:marker:text-brand-400 [&_strong]:text-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}
