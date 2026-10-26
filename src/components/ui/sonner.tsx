"use client";

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

function Toaster({ className, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!flex !items-start !gap-3 !rounded-xl !p-4 !font-sans !shadow-[var(--shadow-lift)]",
          title: "!text-sm !font-semibold",
          description: "!text-xs !opacity-85",
          actionButton:
            "!rounded-lg !bg-primary !px-2.5 !py-1 !text-xs !font-medium !text-primary-foreground",
          cancelButton:
            "!rounded-lg !bg-secondary !px-2.5 !py-1 !text-xs !font-medium !text-secondary-foreground",
        },
      }}
      className={cn("group", className)}
      style={
        {
          "--normal-bg": "var(--color-card)",
          "--normal-text": "var(--color-foreground)",
          "--normal-border": "var(--color-border)",
          "--success-bg": "color-mix(in oklab, var(--color-success) 12%, white)",
          "--success-text": "var(--color-success)",
          "--success-border": "color-mix(in oklab, var(--color-success) 32%, white)",
          "--warning-bg": "color-mix(in oklab, var(--color-warning) 12%, white)",
          "--warning-text": "var(--color-warning)",
          "--warning-border": "color-mix(in oklab, var(--color-warning) 32%, white)",
          "--error-bg": "color-mix(in oklab, var(--color-destructive) 12%, white)",
          "--error-text": "var(--color-destructive)",
          "--error-border": "color-mix(in oklab, var(--color-destructive) 32%, white)",
          "--info-bg": "color-mix(in oklab, var(--color-info) 12%, white)",
          "--info-text": "var(--color-info)",
          "--info-border": "color-mix(in oklab, var(--color-info) 32%, white)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
