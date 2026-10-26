import { BadgeCheck, CalendarClock } from "lucide-react";
import { MarketingPill } from "./button";

/**
 * Hero illustration: arched window, two shelf boards and a reading lamp, drawn
 * with gradients and inline SVG so the page needs no image files.
 */
export function ShelvesArt() {
  return (
    <svg
      viewBox="0 0 520 460"
      className="h-auto w-full drop-shadow-[0_28px_45px_rgba(47,32,21,0.18)]"
      role="img"
      aria-label="Illustration of library shelves with book spines under an arched window"
    >
      <defs>
        <linearGradient id="hero-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbf8f2" />
          <stop offset="100%" stopColor="#e8dfcd" />
        </linearGradient>
        <linearGradient id="hero-arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a373" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#6f4e37" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="hero-board" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5b3f2c" />
          <stop offset="55%" stopColor="#6f4e37" />
          <stop offset="100%" stopColor="#46301f" />
        </linearGradient>
        <linearGradient id="hero-lamp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6c9a8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#e6c9a8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="8" y="8" width="504" height="444" rx="28" fill="url(#hero-panel)" />
      <rect
        x="8.75"
        y="8.75"
        width="502.5"
        height="442.5"
        rx="27.25"
        fill="none"
        stroke="#dcc5b4"
        strokeWidth="1.5"
      />

      {/* arched window behind the shelves */}
      <path
        d="M110 196v-72a150 150 0 0 1 300 0v72Z"
        fill="url(#hero-arch)"
        stroke="#c9a68c"
        strokeWidth="2"
      />
      <path d="M260 46v150M185 70v126M335 70v126" stroke="#c9a68c" strokeWidth="1.5" opacity="0.6" />

      <ShelfRow y={196} books={SHELF_TOP} />
      <ShelfRow y={306} books={SHELF_BOTTOM} />

      {/* shelf carcass */}
      <rect x="86" y="396" width="348" height="14" rx="4" fill="url(#hero-board)" />
      <rect x="86" y="150" width="12" height="260" rx="4" fill="#5b3f2c" opacity="0.85" />
      <rect x="422" y="150" width="12" height="260" rx="4" fill="#5b3f2c" opacity="0.85" />

      {/* card catalogue drawer */}
      <rect x="120" y="412" width="120" height="26" rx="6" fill="#46301f" opacity="0.9" />
      <rect x="152" y="422" width="56" height="6" rx="3" fill="#d4a373" />

      {/* reading lamp */}
      <path d="M330 412v-52" stroke="#2d2d2d" strokeWidth="4" strokeLinecap="round" />
      <path d="M306 362h48l-14-26h-20l-14 26Z" fill="#6f4e37" />
      <ellipse cx="330" cy="418" rx="34" ry="7" fill="#2f2015" opacity="0.55" />
      <path d="M296 368h68l-30 44h-8l-30-44Z" fill="url(#hero-lamp)" />
    </svg>
  );
}

type Spine = { x: number; w: number; h: number; fill: string; lean?: boolean };

const PALETTE = {
  brand: "#6f4e37",
  dark: "#46301f",
  ink: "#2d2d2d",
  gold: "#d4a373",
  soft: "#e6c9a8",
  cream: "#f5f0e6",
  sage: "#3f7d5a",
  blue: "#3f6578",
  clay: "#a83a34",
};

const SHELF_TOP: Spine[] = [
  { x: 104, w: 16, h: 74, fill: PALETTE.brand },
  { x: 124, w: 12, h: 66, fill: PALETTE.gold },
  { x: 140, w: 20, h: 80, fill: PALETTE.dark },
  { x: 164, w: 14, h: 70, fill: PALETTE.soft },
  { x: 182, w: 18, h: 62, fill: PALETTE.blue },
  { x: 204, w: 12, h: 78, fill: PALETTE.clay },
  { x: 220, w: 22, h: 68, fill: PALETTE.brand },
  { x: 246, w: 14, h: 74, fill: PALETTE.cream },
  { x: 264, w: 18, h: 64, fill: PALETTE.gold },
  { x: 286, w: 12, h: 76, fill: PALETTE.dark },
  { x: 302, w: 20, h: 70, fill: PALETTE.sage },
  { x: 326, w: 14, h: 62, fill: PALETTE.brand },
  { x: 344, w: 24, h: 78, fill: PALETTE.soft },
  { x: 372, w: 12, h: 66, fill: PALETTE.ink },
  { x: 388, w: 16, h: 72, fill: PALETTE.gold },
];

const SHELF_BOTTOM: Spine[] = [
  { x: 104, w: 20, h: 68, fill: PALETTE.soft },
  { x: 128, w: 12, h: 76, fill: PALETTE.brand },
  { x: 144, w: 24, h: 62, fill: PALETTE.ink },
  { x: 172, w: 14, h: 72, fill: PALETTE.gold },
  { x: 190, w: 18, h: 66, fill: PALETTE.dark },
  { x: 212, w: 12, h: 78, fill: PALETTE.sage },
  { x: 228, w: 20, h: 64, fill: PALETTE.clay },
  { x: 252, w: 14, h: 74, fill: PALETTE.brand },
  { x: 270, w: 22, h: 68, fill: PALETTE.cream },
  { x: 296, w: 12, h: 70, fill: PALETTE.blue },
  { x: 312, w: 18, h: 62, fill: PALETTE.gold },
  { x: 334, w: 16, h: 76, fill: PALETTE.dark },
  { x: 354, w: 22, h: 66, fill: PALETTE.soft },
  { x: 380, w: 12, h: 72, fill: PALETTE.brand },
  { x: 396, w: 14, h: 58, fill: PALETTE.gold, lean: true },
];

function ShelfRow({ y, books }: { y: number; books: Spine[] }) {
  return (
    <g>
      {books.map((spine) => (
        <g key={`${spine.x}-${y}`} transform={spine.lean ? `rotate(9 ${spine.x} ${y})` : undefined}>
          <rect
            x={spine.x}
            y={y - spine.h}
            width={spine.w}
            height={spine.h}
            rx="2.5"
            fill={spine.fill}
          />
          <rect
            x={spine.x + 2}
            y={y - spine.h + 8}
            width={Math.max(spine.w - 4, 2)}
            height="3"
            rx="1.5"
            fill={PALETTE.cream}
            opacity="0.55"
          />
        </g>
      ))}
      <rect x="92" y={y} width="336" height="12" rx="4" fill="url(#hero-board)" />
    </g>
  );
}

/** Floating "loan due date" card shown beside the shelves. */
export function LoanDueCard() {
  return (
    <div className="surface-card w-[15.5rem] p-4 sm:w-64">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-500">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Active loan
        </span>
        <MarketingPill tone="gold">7-day loan</MarketingPill>
      </div>

      <p className="mt-3 font-serif text-[15px] leading-snug text-ink">
        Noli Me Tangere
      </p>
      <p className="text-[12px] text-ink-soft">José Rizal · Filipiniana, CGS</p>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-ink-soft">
          <span>Due 21 Oct 2026</span>
          <span className="font-medium text-warning">2 days left</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-dark">
          <div className="h-full w-[72%] rounded-full bg-brand-500" />
        </div>
      </div>

      <p className="mt-3 border-t border-brand-100 pt-2.5 text-[11px] leading-5 text-ink-soft">
        Reminder e-mail sent: 7, 3 and 1 day before due.
      </p>
    </div>
  );
}

/** Floating QR scan card: every catalogued copy carries a QR sticker. */
export function QrScanCard() {
  return (
    <div className="surface-card flex w-[13.5rem] items-center gap-3 p-4 sm:w-56">
      <QrMotif />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-500">
          Scan at the desk
        </p>
        <p className="mt-1 font-serif text-[15px] leading-tight text-ink">Copy QR-4F19</p>
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-success">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Shelf location verified
        </p>
      </div>
    </div>
  );
}

const QR_CELL = 6;
const QR_MODULES = 19;

/** Decorative QR pattern. Deterministic, so server and client markup always match. */
function QrMotif() {
  const size = QR_MODULES * QR_CELL;
  const cells: { x: number; y: number }[] = [];

  for (let row = 0; row < QR_MODULES; row += 1) {
    for (let col = 0; col < QR_MODULES; col += 1) {
      const finder = inFinder(row, col);
      const on = finder ?? ((row * 5 + col * 3 + ((row * col) % 7)) % 3 === 0);
      if (on) cells.push({ x: col * QR_CELL, y: row * QR_CELL });
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-14 w-14 shrink-0" role="img" aria-label="Sample QR code on a book sticker">
      <rect width={size} height={size} rx="4" fill="#fbf8f2" />
      {cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x + 0.6}
          y={cell.y + 0.6}
          width={QR_CELL - 1.2}
          height={QR_CELL - 1.2}
          fill="#2f2015"
        />
      ))}
    </svg>
  );
}

/** Three finder squares so the motif reads as a real QR code. */
function inFinder(row: number, col: number): boolean | null {
  const corners = [
    [0, 0],
    [0, QR_MODULES - 7],
    [QR_MODULES - 7, 0],
  ];

  for (const [top, left] of corners) {
    if (row >= top && row < top + 7 && col >= left && col < left + 7) {
      const dr = row - top;
      const dc = col - left;
      const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
      return ring === 2 || ring === 0;
    }
  }

  return null;
}
