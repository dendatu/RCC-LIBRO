import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-cream shadow-[0_14px_30px_-18px_rgba(47,32,21,0.9)] hover:bg-brand-700",
  gold: "bg-gold text-brand-900 shadow-[0_14px_30px_-18px_rgba(212,163,115,0.95)] hover:bg-gold-soft",
  outline:
    "border border-brand-200 bg-white/80 text-brand-800 hover:border-brand-400 hover:bg-brand-50",
  ghost: "text-ink-soft hover:bg-brand-50 hover:text-brand-800",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type MarketingButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  ariaLabel?: string;
  type?: "button" | "submit";
  onClick?: () => void;
};

/** Self-contained marketing button: renders an anchor when `href` is given. */
export function MarketingButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  ariaLabel,
  type = "button",
  onClick,
}: MarketingButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** Small pill used for chips, tags and status labels. */
export function MarketingPill({
  children,
  className,
  tone = "brand",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "brand" | "gold" | "ink" | "success" | "info" | "warning" | "danger" | "muted";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-100 text-brand-800",
    gold: "bg-gold-soft text-brand-900",
    ink: "bg-ink/90 text-cream",
    success: "bg-success/12 text-success",
    info: "bg-info/12 text-info",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/12 text-danger",
    muted: "bg-cream-dark text-ink-soft",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
