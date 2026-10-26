import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  IdCard,
  QrCode,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shell/page-header";
import { CardActions, VerifyCardForm } from "@/components/member/card-actions";
import { APP_NAME, INSTITUTION, POLICY, classificationLabel } from "@/lib/constants";
import { borrowerCardUrl, qrDataUrl } from "@/lib/qr";
import { formatDate, initials } from "@/lib/utils";
import { isStaff, requireMember } from "@/lib/rbac";
import { branchAccessFor } from "@/server/data/member";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Library card",
  description: "Your QR-coded RCC LIBRO borrower card.",
};

export default async function CardPage() {
  const member = await requireMember();
  const profile = member.profile;
  const cardNumber = profile?.card_number ?? null;
  const classification = classificationLabel(profile ?? {});
  const branches = branchAccessFor(profile ?? null);
  const payload = cardNumber ? borrowerCardUrl(cardNumber) : null;
  const qr = payload ? await qrDataUrl(payload, 320) : null;

  const blocked = Boolean(member.record?.is_blocked);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My library"
        title="Digital library card"
        description="Show this QR at any RCC branch desk. It resolves to your card verification page and links every loan to your record."
        actions={
          qr && cardNumber ? (
            <CardActions qrDataUrl={qr} fileName={`rcc-library-card-${cardNumber}.png`} />
          ) : (
            <Button asChild variant="gold" size="sm">
              <Link href="/dashboard/profile?onboard=1">Complete my profile</Link>
            </Button>
          )
        }
      />

      {!cardNumber ? (
        <Card className="no-print">
          <CardContent>
            <EmptyState
              icon={<IdCard className="size-7" />}
              title="No card number issued yet"
              description="Your classification must be on file before a card is printed. Save your profile, then ask a librarian to issue the card number."
              action={
                <>
                  <Button asChild size="sm">
                    <Link href="/dashboard/profile?onboard=1">Set up my profile</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/policies">Borrowing policy</Link>
                  </Button>
                </>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {cardNumber && qr ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <article className="print-sheet mx-auto flex w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl border border-brand-300 bg-brand-600 text-cream shadow-[var(--shadow-lift)]">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-soft">
                  {APP_NAME}
                </p>
                <p className="mt-0.5 font-serif text-lg leading-tight">Borrower Card</p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-700/70 text-xs font-semibold text-gold-soft">
                {initials(member.user.full_name)}
              </span>
            </div>

            <div className="px-5 pb-5 pt-4">
              <p className="truncate font-serif text-xl leading-tight">{member.user.full_name}</p>
              <p className="mt-1 text-xs text-cream/85">{classification}</p>
              <Separator className="my-4 bg-cream/25" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
                <dt className="text-cream/70">Card no.</dt>
                <dd className="font-mono">{cardNumber}</dd>
                <dt className="text-cream/70">SBTR</dt>
                <dd className="font-mono">{profile?.sbtr_number ?? "pending desk issue"}</dd>
                <dt className="text-cream/70">Branches</dt>
                <dd>{branches.join(" · ")}</dd>
                <dt className="text-cream/70">Member since</dt>
                <dd>{formatDate(member.user.created_at)}</dd>
              </dl>
            </div>

            <div className="flex items-center gap-4 border-t border-cream/20 bg-brand-700/50 px-5 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt={`QR code linking to the verification page for card ${cardNumber}`}
                className="size-24 shrink-0 rounded-md bg-cream p-1"
              />
              <div className="min-w-0 text-[10px] leading-relaxed text-cream/80">
                <p className="font-semibold uppercase tracking-wide text-gold-soft">Scan at the desk</p>
                <p className="mt-1 break-all">{payload}</p>
                <p className="mt-1">Valid while your record is free of overdue loans and penalties.</p>
              </div>
            </div>
          </article>

          <div className="space-y-6">
            <Card className="no-print">
              <CardHeader>
                <CardTitle>What this card carries</CardTitle>
                <CardDescription>
                  The QR encodes only your card number — never your e-mail or contact details.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 text-brand-600" />
                  <span>
                    <strong className="font-medium text-ink">Identity.</strong> The desk scans it to
                    pull your record instead of typing your name.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <Building2 className="mt-0.5 size-4 text-brand-600" />
                  <span>
                    <strong className="font-medium text-ink">Branch access.</strong> {branches.join(", ")}.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <ScrollText className="mt-0.5 size-4 text-brand-600" />
                  <span>
                    <strong className="font-medium text-ink">Tracer record.</strong> Loans stamp onto
                    SBTR {profile?.sbtr_number ?? "—"} until returned.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <UserRound className="mt-0.5 size-4 text-brand-600" />
                  <span>
                    <strong className="font-medium text-ink">Privileges.</strong> Up to{" "}
                    {member.record?.borrowing_limit ?? POLICY.maxBooks} titles for{" "}
                    {member.record?.loan_period_days ?? POLICY.loanDays} days.
                  </span>
                </p>
              </CardContent>
            </Card>

            {blocked ? (
              <Alert variant="destructive" className="no-print">
                <ShieldAlert className="size-4" />
                <AlertTitle>The card is suspended</AlertTitle>
                <AlertDescription>
                  {member.record?.block_reason ??
                    "Overdue loans or unsettled penalties are holding this card."}{" "}
                  Settle at the desk and the suspension lifts automatically.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="no-print">
                <ShieldCheck className="size-4" />
                <AlertTitle>Card active</AlertTitle>
                <AlertDescription>
                  {formatStanding(member)}
                </AlertDescription>
              </Alert>
            )}

            <Card className="no-print">
              <CardHeader>
                <CardTitle>Printing and use</CardTitle>
                <CardDescription>
                  The sheet prints at A7 (74 × 105 mm). Cut along the border and slide it into a card
                  sleeve.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <QrCode className="size-3" />
                  Error correction level M
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/sbtr">My SBTR</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/card/${encodeURIComponent(cardNumber)}`}>
                    Preview the verification page
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {isStaff(member) ? (
              <Card className="no-print">
                <CardHeader>
                  <CardTitle>Desk tools</CardTitle>
                  <CardDescription>
                    Staff can check any card number — the verdict page is the same one a scan opens.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VerifyCardForm />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {!cardNumber ? (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>How a card is issued</CardTitle>
            <CardDescription>Card numbers are six-character codes assigned at the desk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-soft">
            <p>
              Save your classification under My profile. A librarian links your SBTR or faculty ID,
              assigns the card number, and the QR on this page activates.
            </p>
            <p className="text-[11px] text-muted-foreground">{INSTITUTION}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatStanding(member: Awaited<ReturnType<typeof requireMember>>) {
  const record = member.record;
  if (!record)
    return "No circulation standing recorded yet — the desk sets it on your first loan.";
  return `${record.active_loans} of ${record.borrowing_limit} slots in use, ${record.overdue_loans} overdue. This card is recognised at all three RCC branch libraries.`;
}
