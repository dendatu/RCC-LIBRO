"use client";

import * as React from "react";
import { Loader2, ScanBarcode, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupCopy, type CopyLookup } from "@/server/actions/circulation";

/**
 * Desk barcode entry. A hardware scanner terminates with Enter, so that path
 * resolves immediately; typed or pasted text (including a scanned QR link)
 * resolves after a short pause. The result is announced through aria-live.
 */
export function BarcodeField({
  initial = "",
  autoFocus = false,
  onResolve,
}: {
  initial?: string;
  autoFocus?: boolean;
  onResolve: (result: CopyLookup | null, term: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestId = React.useRef(0);

  const resolve = React.useCallback(
    async (term: string) => {
      const clean = term.trim();
      const id = requestId.current + 1;
      requestId.current = id;

      if (clean.length < 3) {
        onResolve(null, clean);
        setMessage(clean ? "Type at least three characters." : null);
        return;
      }

      setPending(true);
      const result = await lookupCopy(clean);
      if (requestId.current !== id) return;
      setPending(false);

      if (result.ok && result.data) {
        setMessage(null);
        onResolve(result.data, clean);
      } else {
        onResolve(null, clean);
        setMessage(result.message ?? "That copy could not be found.");
      }
    },
    [onResolve],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void resolve(value);
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clear = () => {
    requestId.current += 1;
    setValue("");
    setMessage(null);
    onResolve(null, "");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="desk-barcode" className="text-sm font-semibold text-ink">
        Scan the copy label
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-brand-500"
            aria-hidden
          />
          <Input
            id="desk-barcode"
            ref={inputRef}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            name="barcode"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void resolve(value);
              }
            }}
            placeholder="BC-000123 · accession no. · paste a QR link"
            aria-invalid={Boolean(message)}
            aria-describedby="desk-barcode-status"
            className="h-14 pr-11 pl-11 text-lg font-mono tracking-wide"
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clear}
              className="absolute top-1/2 right-1 size-11 -translate-y-1/2"
              aria-label="Clear the barcode field"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        <Button type="button" size="lg" variant="secondary" onClick={() => void resolve(value)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ScanBarcode className="size-4" />}
          <span className="hidden sm:inline">Look up</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Copy barcodes and accession numbers both work. Press Enter to issue once a borrower is selected.
      </p>
      <div id="desk-barcode-status" aria-live="polite" className="space-y-2">
        {pending ? <p className="text-xs text-muted-foreground">Reading the label…</p> : null}
        {message ? (
          <Alert variant="warning">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
