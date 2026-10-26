"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE, PUBLIC_NAV } from "@/lib/constants";
import { MarketingButton } from "./button";

/**
 * Sticky public header: wordmark, section navigation, OPAC quick search and the
 * two entry points into the app (sign in / library card).
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 12);
  });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled
          ? "border-brand-100 bg-parchment/92 backdrop-blur-md shadow-[0_10px_30px_-24px_rgba(47,32,21,0.6)]"
          : "border-transparent bg-parchment/70 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:text-cream"
        >
          Skip to content
        </a>

        <Link href="/" className="group flex items-center gap-3" aria-label={`${APP_NAME} home`}>
          <WordMark />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-serif text-lg text-ink transition-colors group-hover:text-brand-700">
              {APP_NAME}
            </span>
            <span className="text-[11px] tracking-wide text-ink-soft">{APP_TAGLINE}</span>
          </span>
        </Link>

        <nav aria-label="Public pages" className="ml-6 hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/catalog"
            className="hidden items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-3 py-2 text-[13px] text-ink-soft transition-colors hover:border-brand-300 hover:text-brand-800 xl:inline-flex"
          >
            <Search className="h-4 w-4 text-brand-500" aria-hidden />
            <span>Search the OPAC…</span>
            <kbd className="rounded border border-brand-100 bg-cream px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
              /catalog
            </kbd>
          </Link>

          <MarketingButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </MarketingButton>
          <MarketingButton href="/register" variant="primary" size="sm" className="hidden md:inline-flex">
            Get a library card
          </MarketingButton>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-public-nav"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-100 bg-white/80 text-brand-700 transition-colors hover:border-brand-300 lg:hidden"
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen ? (
          <motion.div
            id="mobile-public-nav"
            key="mobile-public-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-brand-100 bg-parchment lg:hidden"
          >
            <nav aria-label="Mobile public navigation" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
              <ul className="grid gap-1">
                {PUBLIC_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-brand-50"
                    >
                      {item.label}
                      <span className="text-xs font-normal text-brand-300">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MarketingButton href="/login" variant="outline" size="md">
                  Sign in
                </MarketingButton>
                <MarketingButton href="/register" variant="primary" size="md">
                  Get a library card
                </MarketingButton>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink-soft">
                Reference and periodicals read in the library only. Students need an active SBTR to
                borrow.
              </p>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/** Open-book monogram under a college arch, drawn inline so it needs no image asset. */
function WordMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="libro-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6f4e37" />
          <stop offset="100%" stopColor="#2f2015" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="39" rx="12" fill="url(#libro-mark-bg)" />
      <path
        d="M20 9.5c4.2 0 7.4 2.1 7.4 2.1v13.9s-3.2-2.1-7.4-2.1-7.4 2.1-7.4 2.1V11.6S15.8 9.5 20 9.5Z"
        fill="#f5f0e6"
        opacity="0.94"
      />
      <path d="M20 11v14.4" stroke="#2f2015" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 30h16" stroke="#d4a373" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 33.2h12" stroke="#d4a373" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
