import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-900 text-cream lg:flex lg:flex-col lg:justify-between">
        {/* Photograph behind the brand panel. It is landscape and the panel is a
            tall column, so `cover` crops the sides and the scrim carries the text. */}
        <Image
          src="/images/sign-in-image.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-brand-900/75" />
        {/* Bottom scrim: keeps the tagline + stats legible regardless of photograph */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-brand-900/95 via-brand-900/60 to-transparent" />
        <div className="relative z-10 px-12 pt-12">
          <Link href="/" className="inline-flex items-baseline gap-3">
            <span className="font-serif text-2xl tracking-tight">RCC LIBRO</span>
            <span className="rounded-full border border-gold/40 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold-soft">
              Library System
            </span>
          </Link>
        </div>
        <div className="relative z-10 max-w-lg px-12">
          <h2 className="font-serif text-3xl leading-tight text-cream">
            One catalogue, three branch libraries, every borrower accounted for.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-cream/90">
            Elementary, High School, and College &amp; Graduate School collections share a single
            circulation desk. Scan a QR code, sign the digital SBTR, and let the reminders handle
            the rest.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-cream/20 pt-6 text-center">
            {[
              { term: "Branches", value: "3" },
              { term: "Loan period", value: "7 days" },
              { term: "Book limit", value: "3 titles" },
            ].map((item) => (
              <div key={item.term}>
                <dd className="font-serif text-xl text-gold">{item.value}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cream/75">
                  {item.term}
                </dt>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative z-10 px-12 pb-10 text-xs text-cream/60">
          Republic Central Colleges — Angeles City Campus
        </p>
      </aside>

      <main className="paper-texture flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-brand-600 lg:hidden"
          >
            ← Back to RCC LIBRO
          </Link>
          <h1 className="font-serif text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 text-sm text-ink-soft">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
