import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CircleDollarSign, ScanBarcode, ShieldBan } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { FineCalculator } from "@/components/circulation/fine-calculator";
import { FineLedger } from "@/components/circulation/fine-ledger";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { POLICY } from "@/lib/constants";
import { isAdmin, requireRole } from "@/lib/rbac";
import { formatPeso } from "@/lib/utils";
import {
  getBorrowerOption,
  listFines,
  listFineTotals,
  listOpenLoans,
} from "@/server/data/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fine management",
  description: "Settle or waive penalties assessed by the circulation desk.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinesPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireRole("librarian", "admin");
  const params = await searchParams;
  const borrowerId = single(params.borrower) ?? "";

  const [scopedBorrower, totals, openLoans] = await Promise.all([
    borrowerId ? getBorrowerOption(borrowerId) : Promise.resolve(null),
    listFineTotals(),
    listOpenLoans(120),
  ]);
  const fines = await listFines(borrowerId ? { borrowerId, limit: 400 } : { limit: 400 });

  const canWaive = isAdmin(member);
  const pendingAmount = openLoans.reduce((sum, loan) => sum + Number(loan.fine_charged ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Circulation desk"
        title="Fine management"
        description="The penalty ledger for every branch. Payments are recorded by staff; waivers are an administrator right and always carry a written reason."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/circulation">
                <ScanBarcode className="size-4" /> Issue books
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/returns">Return desk</Link>
            </Button>
          </>
        }
      />

      {borrowerId ? (
        <Alert variant="info">
          <AlertDescription>
            {scopedBorrower
              ? `Filtered to ${scopedBorrower.full_name} — ${scopedBorrower.classification}, ${formatPeso(scopedBorrower.outstanding_fines)} outstanding.`
              : "That borrower could not be found; the full ledger is shown instead."}
            <Link href="/dashboard/fines" className="ml-2 underline underline-offset-4">
              Show every penalty
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Unsettled penalties"
          value={formatPeso(totals.pending?.amount ?? 0)}
          hint={`${totals.pending?.count ?? 0} pending entry(ies)`}
          tone="danger"
          icon={<CircleDollarSign className="size-4" />}
        />
        <StatTile
          label="Collected"
          value={formatPeso(totals.paid?.amount ?? 0)}
          hint={`${totals.paid?.count ?? 0} payment(s) recorded`}
          tone="success"
          icon={<Banknote className="size-4" />}
        />
        <StatTile
          label="Waived"
          value={formatPeso(totals.waived?.amount ?? 0)}
          hint={`${totals.waived?.count ?? 0} waiver(s) by an administrator`}
          icon={<ShieldBan className="size-4" />}
        />
        <StatTile
          label="Disputed"
          value={formatPeso(totals.disputed?.amount ?? 0)}
          hint={`${totals.disputed?.count ?? 0} awaiting review`}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          PHP {POLICY.finePerDay.toFixed(2)} per calendar day on circulating titles
        </Badge>
        <Badge variant="outline">
          PHP {POLICY.reserveFinePerHour.toFixed(2)} per hour on reserve books
        </Badge>
        <Badge variant="outline">
          Accounts are held at the desk from PHP {POLICY.fineBlockThreshold.toFixed(2)} unsettled
        </Badge>
        <span>
          {formatPeso(pendingAmount)} of fines is already posted on loans still out.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FineLedger fines={fines} canWaive={canWaive} />
        </div>
        <aside className="space-y-4 lg:col-span-2">
          <FineCalculator loans={openLoans} />
          <div className="surface-card space-y-2 p-5">
            <h2 className="font-serif text-base text-ink">How a penalty is cleared</h2>
            <ol className="space-y-2 text-sm text-ink-soft">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                The return desk checks the copy in and <span className="font-mono text-xs">return_book()</span>{" "}
                posts the fine for the days or hours late.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                Cash, online or counter payments are settled here; the account unblocks itself once the
                balance clears.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                A waiver needs an administrator and a written reason — both are kept in the audit trail.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
