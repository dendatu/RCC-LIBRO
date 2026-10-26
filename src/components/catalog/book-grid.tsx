"use client";

import { Children } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Animates the mount of a catalogue grid without animating per-interaction. */
export function BookGrid({
  children,
  className,
  columns = "sm:grid-cols-2 xl:grid-cols-3",
}: {
  children: React.ReactNode;
  className?: string;
  columns?: string;
}) {
  const items = Children.toArray(children);

  return (
    <div className={cn("grid grid-cols-1 gap-4", columns, className)}>
      {items.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
          className="h-full"
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
