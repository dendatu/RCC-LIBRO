import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

export function formatPeso(amount: number | string | null | undefined) {
  return PESO.format(Number(amount ?? 0));
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH").format(Number(value ?? 0));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Whole days between now and `due`; negative when the item is not yet due. */
export function daysUntil(due: string | Date) {
  const target = new Date(due).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export function relativeDue(due: string | Date) {
  const diff = daysUntil(due);
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

export function initials(name?: string | null) {
  if (!name) return "RCC";
  return name
    .replace(/^(Atty\.|Dr\.|Engr\.|Hon\.)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Deterministic placeholder palette for covers/avatars when no image exists. */
export function toneFromKey(key: string) {
  const tones = [
    "from-brand-600 to-brand-800",
    "from-gold to-brand-500",
    "from-brand-400 to-brand-700",
    "from-brand-700 to-ink",
    "from-gold-soft to-brand-400",
    "from-brand-500 to-brand-800",
  ];
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  }
  return tones[hash % tones.length];
}
