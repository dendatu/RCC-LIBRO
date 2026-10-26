import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CircleX,
  History,
  ScanLine,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VerifyCardForm } from "@/components/member/card-actions";
import { APP_NAME, INSTITUTION } from "@/lib/constants";
import { formatPeso, initials } from "@/lib/utils";
import { resolveCardStanding } from "@/server/data/member";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cardNumber: string }>;
}): Promise<Metadata> {
  const { cardNumber } = await params;
  const decoded = decodeURIComponent(cardNumber);
  const standing = await resolveCardStanding(decoded).catch(() => null);

  return {
    title: standing ? `Card ${standing.card_number}` : "Card verification",
    description: standing
      ? `RCC LIBRO borrower card verification for ${standing.full_name}.`
      : "Scan or enter an RCC LIBRO card number to verify borrowing privileges.",
  };
}

export default async function CardVerificationPage({
  params,
}: {
  params: Promise<{ cardNumber: string }>;
}) {
  const { cardNumber } = await params;
  const decoded = decodeURIComponent(cardNumber).trim();
  if (!decoded) notFound();

  const standing = await resolveCardStanding(decoded);
  if (!standing) notFound();

  const clear = !standing.is_blocked && standing.account_status === "active";
  const reasons: string[] = [];
  if (standing.is_blocked) reasons.push(standing.block_reason ?? "Unresolved penalties or overdue loans.");
  if (standing.overdue_loans > 0) reasons.push(`${standing.overdue_loans} book(s) past their due date.`);
  if (standing.outstanding_fines > 0)
    reasons.push(`${formatPeso(standing.outstanding_fines)} in unsettled penalties.`);
  if (!clear && standing.account_status !== "active")
    reasons.push(`Account status: ${standing.account_status}.`);

  return (
    <main className="paper-texture min-h-dvh px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-500">
            {APP_NAME} · card verification
          </p>
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">
            {clear ? "This card is in good standing" : "This card is on hold"}
          </h1>
          <p className="text-sm text-ink-soft">{INSTITUTION}</p>
        </header>

        <article
          className={`print-sheet overflow-hidden rounded-2xl border shadow-[var(--shadow-card)] ${
            clear ? "border-success/40 bg-card" : "border-destructive/40 bg-card"
          }`}
        >
          <div
            className={`flex items-start gap-4 px-6 py-6 text-cream ${
              clear ? "bg-success" : "bg-destructive"
            }`}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cream/20 font-serif text-base font-semibold">
              {initials(standing.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-serif text-xl leading-tight">{standing.full_name}</p>
              <p className="mt-1 text-xs text-cream/85">{standing.classification}</p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-cream/15 px-2.5 py-0.5 text-[11px] font-medium">
                {clear ? <ShieldCheck className="size-3" /> : <CircleX className="size-3" />}
                {clear ? "Privileges active" : "Privileges suspended"}
              </p>
            </div>
          </div>

          <CardContent className="space-y-4 px-6 py-5">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Card number
                </dt>
                <dd className="font-mono text-ink">{standing.card_number}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  SBTR number
                </dt>
                <dd className="font-mono text-ink">{standing.sbtr_number ?? "Issued at the desk"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Account status
                </dt>
                <dd className="text-ink">{standing.account_status}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Open loans
                </dt>
                <dd className="text-ink">{standing.active_loans}</dd>
              </div>
            </dl>

            <Separator />

            {clear ? (
              <ul className="space-y-2 text-sm text-ink-soft">
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 text-success" />
                  No overdue books on this record.
                </li>
                <li className="flex items-start gap-2">
                  <Wallet className="mt-0.5 size-4 text-success" />
                  Outstanding penalties: {formatPeso(standing.outstanding_fines)}.
                </li>
                <li className="flex items-start gap-2">
                  <History className="mt-0.5 size-4 text-brand-500" />
                  Borrowing details are visible to the borrower and library staff only.
                </li>
              </ul>
            ) : (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="size-4" />
                  Why this card is held
                </p>
                <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                  {reasons.map((reason) => (
                    <li key={reason}>· {reason}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-soft">
                  Settle at any branch circulation desk. The hold lifts automatically once the record
                  is clear.
                </p>
              </div>
            )}
          </CardContent>
        </article>

        <Card>
          <CardHeader>
            <CardTitle>Verify another card</CardTitle>
            <CardDescription>
              Enter the number printed under the QR, or scan the label with a phone camera.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <VerifyCardForm />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <ScanLine className="size-3" />
                Privacy: name, classification and standing only
              </Badge>
              <Button asChild variant="link" size="sm">
                <Link href="/login">Sign in to my library account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          If this is not your card, close the page. Report a lost card at any RCC branch desk.
        </p>
      </div>
    </main>
  );
}
