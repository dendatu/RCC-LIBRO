"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SOFT_EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in seconds, used to stagger siblings. */
  delay?: number;
  /** Vertical offset the element rises from. */
  y?: number;
};

/** Scroll-triggered fade + rise. Collapses to a plain fade when the user asked for less motion. */
export function Reveal({ children, className, delay = 0, y = 22 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: reduceMotion ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0.25 : 0.6, delay, ease: SOFT_EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Eyebrow + heading + intro copy, shared by every landing section. */
export function SectionIntro({
  eyebrow,
  title,
  intro,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl leading-tight text-ink text-balance sm:text-4xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 text-[15px] leading-7 text-ink-soft text-balance sm:text-base">
          {intro}
        </p>
      ) : null}
    </div>
  );
}
