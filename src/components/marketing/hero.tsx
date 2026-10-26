"use client";

import NextLink from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { LibraryBig, LogIn, Search } from "lucide-react";
import { INSTITUTION } from "@/lib/constants";
import { MarketingButton } from "./button";
import { LoanDueCard, QrScanCard } from "./hero-art";

const TRUST_STATS = [
  { value: "3", label: "branch libraries, one catalogue" },
  { value: "20,000+", label: "catalogued items and barcoded copies" },
  { value: "SBTR", label: "Student Book Tracer Records digitised" },
];

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      <div className="paper-texture absolute inset-0 -z-10" aria-hidden />
      <div
        className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-gold/25 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <motion.p
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700"
          >
            <LibraryBig className="h-3.5 w-3.5 text-gold" aria-hidden />
            {INSTITUTION}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-[2rem] leading-[1.1] text-ink text-balance sm:text-[2.75rem] lg:text-[3.25rem]"
          >
            One shelf for the whole college: search it, borrow from it, track it.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.14 }}
            className="mt-5 max-w-xl text-[15px] leading-7 text-ink-soft sm:text-[17px] sm:leading-8"
          >
            RCC LIBRO keeps the holdings of the Elementary, High School and College &amp; Graduate
            School libraries in a single record. A pupil finds a home reader in seconds, a librarian
            releases a loan with one scan, and no borrower ever has to guess when a book is due.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <MarketingButton href="/catalog" size="lg" className="w-full sm:w-auto">
              <Search className="h-4 w-4" aria-hidden />
              Search the catalogue
            </MarketingButton>
            <MarketingButton href="/login" variant="outline" size="lg" className="w-full sm:w-auto">
              <LogIn className="h-4 w-4 text-brand-500" aria-hidden />
              Sign in with Google
            </MarketingButton>
          </motion.div>

          <p className="mt-3 text-[13px] text-ink-soft">
            Members of RCC sign in with their school e-mail address.{" "}
            <NextLink
              href="/register"
              className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-500"
            >
              Not enrolled yet? Request a card instead.
            </NextLink>
          </p>

          <dl className="mt-10 grid gap-4 border-t border-brand-100 pt-6 sm:grid-cols-3">
            {TRUST_STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.08 }}
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="font-serif text-2xl text-brand-700">{stat.value}</span>
                  <span className="mt-1 block text-[13px] leading-5 text-ink-soft">{stat.label}</span>
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <img
            src="/images/hero-image.png"
            alt="Library"
            className="h-auto w-full drop-shadow-[0_28px_45px_rgba(47,32,21,0.18)]"
          />

          <Float delay={0.4} y={reduceMotion ? 0 : 10} className="left-0 top-6 sm:-left-8 sm:top-10">
            <LoanDueCard />
          </Float>
          <Float
            delay={0.7}
            y={reduceMotion ? 0 : 8}
            className="bottom-4 right-0 sm:-right-6 sm:bottom-10"
          >
            <QrScanCard />
          </Float>
        </motion.div>
      </div>
    </section>
  );
}

function Float({
  children,
  className,
  delay,
  y,
}: {
  children: React.ReactNode;
  className: string;
  delay: number;
  y: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: y === 0 ? 0 : y + 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay }}
      className={`absolute z-10 ${className}`}
    >
      <motion.div
        animate={y === 0 ? undefined : { y: [0, -9, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
