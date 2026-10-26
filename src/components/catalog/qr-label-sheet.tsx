"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Download, Image as ImageIcon, Layers, Printer, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_NAME, INSTITUTION } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface QrLabelCopy {
  barcode: string;
  copy_number: number;
  accession_number: string | null;
  title: string;
  author: string;
  call_number: string;
  library_name: string;
  section: string;
}

const SIZES = {
  small: { box: "w-[168px]", qr: "size-24", label: "Small — 45 × 30 mm" },
  medium: { box: "w-[212px]", qr: "size-32", label: "Medium — 60 × 40 mm" },
  large: { box: "w-[268px]", qr: "size-40", label: "Large — 70 × 50 mm" },
} as const;

type SizeKey = keyof typeof SIZES;

/**
 * Printable QR label sheet. PNG labels are served by `/api/qr/:barcode`; the SVG
 * option uses the crisp vector generated server-side from `qrSvg()` for each copy.
 */
export function QrLabelSheet({
  copies,
  svgDataUrls,
}: {
  copies: QrLabelCopy[];
  svgDataUrls: Record<string, string>;
}) {
  const [size, setSize] = useState<SizeKey>("medium");
  const [format, setFormat] = useState<"png" | "svg">("png");
  const [selected, setSelected] = useState<string[]>(() => copies.map((copy) => copy.barcode));

  const barcodes = useMemo(() => new Set(selected), [selected]);
  const sheet = copies.filter((copy) => barcodes.has(copy.barcode));
  const allSelected = sheet.length === copies.length && copies.length > 0;

  function toggle(barcode: string) {
    setSelected((prev) =>
      prev.includes(barcode) ? prev.filter((item) => item !== barcode) : [...prev, barcode],
    );
  }

  function pngUrl(barcode: string, dimension: number) {
    return `/api/qr/${encodeURIComponent(barcode)}?size=${dimension}`;
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSelected(allSelected ? [] : copies.map((copy) => copy.barcode))
            }
            disabled={copies.length === 0}
          >
            {allSelected ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
            {allSelected ? "Clear selection" : `Select all ${copies.length}`}
          </Button>
          <span className="text-xs text-muted-foreground">
            {sheet.length} of {copies.length} label(s) on the sheet
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={format} onValueChange={(value) => setFormat(value as "png" | "svg")}>
            <TabsList>
              <TabsTrigger value="png">
                <ImageIcon className="size-3.5" /> PNG
              </TabsTrigger>
              <TabsTrigger value="svg" disabled={Object.keys(svgDataUrls).length === 0}>
                <Layers className="size-3.5" /> SVG
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Label htmlFor="label-size" className="sr-only">
            Label size
          </Label>
          <Select value={size} onValueChange={(value) => setSize(value as SizeKey)}>
            <SelectTrigger id="label-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SIZES) as SizeKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SIZES[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => window.print()} disabled={sheet.length === 0}>
            <Printer className="size-3.5" /> Print sheet
          </Button>
        </div>
      </div>

      {sheet.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-200 bg-parchment px-4 py-10 text-center text-sm text-muted-foreground">
          Select at least one copy to build a label sheet.
        </p>
      ) : (
        <div className="print-sheet paper-texture rounded-xl border border-border p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <p className="font-serif text-sm font-semibold text-ink">
              {APP_NAME} — copy labels
            </p>
            <p className="text-[11px] text-muted-foreground">{INSTITUTION}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {sheet.map((copy) => {
              const dim = size === "small" ? 96 : size === "medium" ? 128 : 160;
              const svg = svgDataUrls[copy.barcode];
              return (
                <button
                  key={copy.barcode}
                  type="button"
                  onClick={() => toggle(copy.barcode)}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-lg border bg-white p-3 text-left transition-colors",
                    SIZES[size].box,
                    barcodes.has(copy.barcode)
                      ? "border-brand-400 shadow-[var(--shadow-card)]"
                      : "border-border opacity-60",
                  )}
                >
                  {format === "svg" && svg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={svg} alt="" className={cn(SIZES[size].qr, "shrink-0")} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pngUrl(copy.barcode, dim * 3)}
                      alt={`QR label for ${copy.barcode}`}
                      className={cn(SIZES[size].qr, "shrink-0")}
                      loading="lazy"
                    />
                  )}

                  <span className="w-full">
                    <span className="block truncate font-serif text-[11px] font-semibold leading-tight text-ink">
                      {copy.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] leading-tight text-ink-soft">
                      {copy.author}
                    </span>
                    <span className="mt-1 block font-mono text-[9px] text-brand-700">
                      {copy.call_number}
                    </span>
                    <span className="block font-mono text-[9px] text-muted-foreground">
                      {copy.accession_number ?? copy.barcode} · copy {copy.copy_number}
                    </span>
                    <span className="mt-1 block truncate text-[8px] uppercase tracking-wide text-muted-foreground">
                      {copy.library_name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">
            Cut along the label edges and mount inside the back pocket of each book, over the
            printed call number. Scanning a label opens the copy record at{" "}
            <span className="font-mono">/book/&lt;barcode&gt;</span>.
          </p>
        </div>
      )}

      {copies.length > 0 ? (
        <div className="no-print surface-card p-4">
          <p className="mb-3 text-sm font-medium text-ink">Individual downloads</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {copies.slice(0, 40).map((copy) => (
              <div
                key={copy.barcode}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-ink">{copy.barcode}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {copy.accession_number ?? copy.title}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" asChild title="Download PNG">
                    <a href={pngUrl(copy.barcode, 512)} download={`rcc-${copy.barcode}.png`}>
                      <Download className="size-3.5" /> PNG
                    </a>
                  </Button>
                  {svgDataUrls[copy.barcode] ? (
                    <Button variant="ghost" size="sm" asChild title="Download SVG">
                      <a
                        href={svgDataUrls[copy.barcode]}
                        download={`rcc-${copy.barcode}.svg`}
                        className="text-[11px]"
                      >
                        SVG
                      </a>
                    </Button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
