"use client";

import * as React from "react";
import { Check, Loader2, Search, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { searchBorrowers } from "@/server/actions/circulation";
import { cn, formatPeso } from "@/lib/utils";
import type { BorrowerOption } from "@/server/data/circulation";

/**
 * Borrower picker with server-side search over accounts and profiles — name,
 * e-mail, SBTR number, card number or ID number. Keyboard accessible combobox.
 */
export function BorrowerSearch({
  initial = null,
  onSelect,
}: {
  initial?: BorrowerOption | null;
  onSelect: (borrower: BorrowerOption | null) => void;
}) {
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<BorrowerOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const [selected, setSelected] = React.useState<BorrowerOption | null>(initial);
  const requestId = React.useRef(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (selected) return;
    const clean = term.trim();
    if (clean.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      const id = requestId.current + 1;
      requestId.current = id;
      setPending(true);
      const response = await searchBorrowers(clean);
      if (requestId.current !== id) return;
      setPending(false);
      if (response.ok && response.data) {
        setResults(response.data);
        setOpen(true);
        setActive(0);
        setNotice(
          response.data.length ? null : "No member matches that name, SBTR, card or ID number.",
        );
      } else {
        setResults([]);
        setNotice(response.message ?? "The member list could not be read.");
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [term, selected]);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const choose = (option: BorrowerOption) => {
    setSelected(option);
    setTerm("");
    setResults([]);
    setOpen(false);
    setNotice(null);
    onSelect(option);
  };

  const reset = () => {
    setSelected(null);
    setResults([]);
    setNotice(null);
    onSelect(null);
  };

  if (selected) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-base text-ink">{selected.full_name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-soft">
              {selected.classification} · {selected.email}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X className="size-4" /> Change
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={selected.sbtr_number ? "gold" : "outline"}>
            {selected.sbtr_number ? `SBTR ${selected.sbtr_number}` : "No SBTR"}
          </Badge>
          {selected.card_number ? <Badge variant="secondary">Card {selected.card_number}</Badge> : null}
          <Badge variant="secondary">
            {selected.active_loans}/{selected.borrowing_limit} books out
          </Badge>
          {selected.outstanding_fines > 0 ? (
            <Badge variant="warning">{formatPeso(selected.outstanding_fines)} unsettled</Badge>
          ) : null}
          {selected.is_blocked ? <Badge variant="destructive">Held at desk</Badge> : null}
          {!selected.is_active ? <Badge variant="destructive">Account disabled</Badge> : null}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <Label htmlFor="desk-borrower" className="text-sm font-semibold text-ink">
        Borrower
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-500" aria-hidden />
        <Input
          id="desk-borrower"
          role="combobox"
          aria-expanded={open}
          aria-controls="desk-borrower-list"
          aria-autocomplete="list"
          autoComplete="off"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
              setOpen(true);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && results[active]) {
              event.preventDefault();
              choose(results[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Surname, SBTR number, card number or e-mail"
          className="h-12 pl-9 text-base"
        />
        {pending ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-brand-500" aria-hidden />
        ) : null}
      </div>

      <p id="desk-borrower-status" aria-live="polite" className="text-xs text-muted-foreground">
        {notice ?? (results.length ? `${results.length} member(s) found — use the arrow keys to pick one.` : "Type at least two characters.")}
      </p>

      {open && results.length > 0 ? (
        <ul
          id="desk-borrower-list"
          role="listbox"
          aria-label="Borrower results"
          className="absolute z-20 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-lift)]"
        >
          {results.map((option, index) => (
            <li key={option.user_id} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  index === active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <UserRound className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{option.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {option.classification}
                    {option.sbtr_number ? ` · SBTR ${option.sbtr_number}` : " · no SBTR"}
                    {option.card_number ? ` · card ${option.card_number}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{option.active_loans}/{option.borrowing_limit} out</Badge>
                    {option.is_blocked ? <Badge variant="destructive">Held</Badge> : null}
                    {option.outstanding_fines > 0 ? (
                      <Badge variant="warning">{formatPeso(option.outstanding_fines)}</Badge>
                    ) : null}
                  </span>
                </span>
                <Check className="mt-1 size-4 shrink-0 text-success opacity-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!open && !results.length && !notice ? (
        <EmptyState
          className="py-8"
          icon={<UserRound className="size-6" />}
          title="No borrower selected"
          description="Search by name, SBTR number, library card number or e-mail address."
        />
      ) : null}
    </div>
  );
}
