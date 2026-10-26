"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "./card";

const statTones = {
  default: "bg-brand-100 text-brand-700",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/12 text-destructive",
  gold: "bg-gold/20 text-brand-700",
} as const;

const trendTones = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  gold: "text-brand-700",
} as const;

type StatTileProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: keyof typeof statTones;
  trend?: number;
  href?: string;
  className?: string;
};

function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  trend,
  href,
  className,
}: StatTileProps) {
  const hasTrend = typeof trend === "number" && trend !== 0;
  const trendUp = hasTrend && (trend as number) > 0;

  const card = (
    <Card
      className={cn(
        "gap-4 p-5",
        href && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          <span className="font-serif text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </span>
        </div>
        {icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
              statTones[tone]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {hasTrend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
              trendUp ? trendTones.success : trendTones.danger
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(trend as number)}%
          </span>
        ) : null}
        {hint ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
    </Card>
  );

  const tile = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="h-full"
    >
      {card}
    </motion.div>
  );

  if (!href) {
    return tile;
  }

  return (
    <Link href={href} className="block h-full outline-none">
      {tile}
    </Link>
  );
}

export { StatTile, statTones };
export type { StatTileProps };
