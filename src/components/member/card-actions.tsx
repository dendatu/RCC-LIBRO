"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CardActions({
  qrDataUrl,
  fileName,
}: {
  qrDataUrl: string;
  fileName: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={qrDataUrl} download={fileName}>
          <Download className="size-4" />
          Download QR (PNG)
        </a>
      </Button>
      <Button variant="gold" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print A7 card
      </Button>
    </div>
  );
}

/** Staff-only helper: jump to the desk verification page for any card number. */
export function VerifyCardForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const card = value.trim();
        if (card) router.push(`/card/${encodeURIComponent(card)}`);
      }}
    >
      <Label htmlFor="verify-card">Verify another card</Label>
      <div className="flex gap-2">
        <Input
          id="verify-card"
          name="verify-card"
          placeholder="RCC-A1B2C3"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" size="default" disabled={value.trim().length === 0}>
          <ScanLine className="size-4" />
          Check
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Opens the standing verdict at /card/&#123;number&#125; — the same page a scanned QR resolves
        to.
      </p>
    </form>
  );
}
