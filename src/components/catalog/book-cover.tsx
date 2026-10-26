import Image from "next/image";
import { cn, toneFromKey } from "@/lib/utils";

type BookCoverProps = {
  title: string;
  author?: string | null;
  imageUrl?: string | null;
  imprint?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * Catalogue cover. When no artwork was accessioned we render a deterministic
 * typographic spine so the grid never shows a broken image.
 */
export function BookCover({
  title,
  author,
  imageUrl,
  imprint,
  className,
  sizes = "160px",
  priority = false,
}: BookCoverProps) {
  const wrapper = cn(
    "relative aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-cream",
    className,
  );

  if (imageUrl) {
    if (imageUrl.startsWith("/")) {
      return (
        <div className={wrapper}>
          <Image
            src={imageUrl}
            alt={`Cover of ${title}`}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover"
          />
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`Cover of ${title}`}
        className={cn(wrapper, "h-auto object-cover")}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  const tone = toneFromKey(`${title}|${author ?? ""}`);
  const [firstWord, ...rest] = title.split(/\s+/);

  return (
    <div
      className={cn(
        wrapper,
        "flex flex-col justify-between bg-gradient-to-br p-3 text-cream",
        tone,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cream/70">
          RCC LIBRO
        </span>
        <span className="h-6 w-px bg-gold/70" aria-hidden />
      </div>

      <div className="min-w-0">
        <p className="font-serif text-[13px] leading-tight font-semibold tracking-tight">
          <span>{firstWord}</span>{" "}
          <span className="text-cream/85">{rest.join(" ").slice(0, 68)}</span>
        </p>
        {author ? (
          <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-cream/75">{author}</p>
        ) : null}
      </div>

      <div className="border-t border-cream/25 pt-1.5">
        <p className="truncate text-[8px] uppercase tracking-[0.18em] text-cream/70">
          {imprint ?? "Republic Central Colleges"}
        </p>
      </div>
    </div>
  );
}
