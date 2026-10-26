"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import "./animations.css";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink/55 backdrop-blur-[2px] data-[state=open]:animate-[rcc-fade-in_180ms_ease-out] data-[state=closed]:animate-[rcc-fade-out_150ms_ease-in]",
        className
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-parchment text-card-foreground shadow-[var(--shadow-lift)]",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 max-h-[90dvh] border-b border-border data-[state=open]:animate-[rcc-slide-in-from-top_260ms_ease-out] data-[state=closed]:animate-[rcc-slide-out-to-top_180ms_ease-in]",
        bottom:
          "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl border-t border-border data-[state=open]:animate-[rcc-slide-in-from-bottom_260ms_ease-out] data-[state=closed]:animate-[rcc-slide-out-to-bottom_180ms_ease-in]",
        left: "inset-y-0 left-0 h-full w-[min(20rem,85vw)] border-r border-border data-[state=open]:animate-[rcc-slide-in-from-left_260ms_ease-out] data-[state=closed]:animate-[rcc-slide-out-to-left_180ms_ease-in]",
        right:
          "inset-y-0 right-0 h-full w-[min(20rem,85vw)] border-l border-border data-[state=open]:animate-[rcc-slide-in-from-right_260ms_ease-out] data-[state=closed]:animate-[rcc-slide-out-to-right_180ms_ease-in]",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & {
    showCloseButton?: boolean;
  }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:pointer-events-none"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 border-b border-border px-5 py-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-t border-border px-5 py-4",
        className
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-serif text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
};
