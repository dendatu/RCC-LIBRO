import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-brand-700",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:border-brand-300 hover:bg-cream-dark",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:border-brand-300 hover:bg-muted hover:text-accent-foreground",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-danger/90 focus-visible:ring-destructive/40",
        gold: "bg-gold text-brand-900 shadow-[0_14px_32px_-16px_rgba(212,163,115,0.85)] hover:bg-gold-soft focus-visible:ring-gold/60",
        link: "text-primary underline-offset-4 hover:text-brand-700 hover:underline",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
        default: "h-9 px-4 py-2",
        lg: "h-11 gap-2 rounded-lg px-6 text-sm",
        icon: "size-9 rounded-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const shared = {
    "data-slot": "button",
    "data-variant": variant ?? "default",
    "data-size": size ?? "default",
    className: cn(buttonVariants({ variant, size }), className),
  };

  if (asChild) {
    return (
      <Slot {...shared} {...(type ? { type } : null)} {...props} />
    );
  }

  return (
    <button type={type ?? "button"} {...shared} {...props} />
  );
}

export { Button, buttonVariants };
