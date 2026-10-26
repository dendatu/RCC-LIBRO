"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { formatNumber } from "@/lib/utils";

type Figure = {
  label: string;
  value: number;
  caption: string;
};

/** Clearly-labelled sample figures for the programme, not a live report. */
const FIGURES: Figure[] = [
  { label: "Titles catalogued", value: 21540, caption: "Unique records across the three branches" },
  { label: "Copies on the shelf", value: 38210, caption: "Barcoded and QR-stickered physical copies" },
  { label: "Members served", value: 6480, caption: "Students, faculty and staff with an active card" },
  { label: "Average loans per week", value: 465, caption: "Circulation counted over a normal school week" },
];

export function StatsBand() {
  return (
    <section aria-labelledby="figures-heading" className="relative overflow-hidden bg-ink text-cream">
      <div
        className="absolute inset-0 opacity-90"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 20%, rgba(212,163,115,0.28), transparent 45%), radial-gradient(circle at 88% 78%, rgba(111,78,55,0.55), transparent 48%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            The library in numbers
          </p>
          <h2 id="figures-heading" className="mt-3 font-serif text-3xl leading-tight text-cream text-balance sm:text-4xl">
            A catalogue big enough to need a system, small enough to know by heart
          </h2>
        </div>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {FIGURES.map((figure, index) => (
            <Stat key={figure.label} figure={figure} delay={index * 0.06} />
          ))}
        </dl>

        <p className="mt-8 max-w-xl text-[12px] leading-5 text-cream/55">
          Illustrative programme figures used to describe the scale of the library service. Live
          counts are published to librarians and administrators from the analytics dashboard once
          inventory is loaded.
        </p>
      </div>
    </section>
  );
}

function Stat({ figure, delay }: { figure: Figure; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();

  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5, delay }}
      >
        <dt className="text-[13px] font-medium uppercase tracking-[0.14em] text-gold-soft">
          {figure.label}
        </dt>
        <dd className="mt-2">
          <span className="font-serif text-4xl leading-none text-cream sm:text-[2.75rem]">
            <CountUp to={figure.value} run={inView && !reduceMotion} />
          </span>
          <span className="mt-2 block text-[13px] leading-5 text-cream/65">{figure.caption}</span>
        </dd>
      </motion.div>
    </div>
  );
}

/** Counts from zero to `to` when the band scrolls into view. */
function CountUp({ to, run }: { to: number; run: boolean }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) {
      setValue(to);
      return;
    }

    let frame = 0;
    const duration = 1500;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [run, to]);

  return <span>{formatNumber(value)}</span>;
}
