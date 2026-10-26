import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CalendarClock, ScanBarcode } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { LostDamagedPanel } from "@/components/circulation/lost-damaged-panel";
import { ReturnDesk } from "@/components/circulation/return-desk";
import { requireRole } from "@/lib/rbac";
import { formatPeso } from "@/lib/utils";
import {
  listDeskActivity,
  listLostAndDamaged,
  listOpenLoans,
  normalizeScanTerm,
} from "@/server/data/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Return desk",
  description: "Check copies back in, record their condition and let the policy engine assess the fine.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("librarian", "admin");
  const params = await searchParams;
  const term = normalizeScanTerm(single(params.barcode) ?? single(params.q) ?? "");

  const [loans, activity, lostAndDamaged] = await Promise.all([
    listOpenLoans(120),
    listDeskActivity(60),
    listLostAndDamaged(),
  ]);

  const now = Date.now();
  const overdue = loans.filter((loan) => loan.status === "overdue" || new Date(loan.due_date).getTime() < now);
  const issuedToday = activity.filter((loan) => new Date(loan.date_borrowed).getTime() >= now - 86_400_000);
  const returnedToday = activity.filter(
    (loan) => loan.date_returned && new Date(loan.date_returned).getTime() >= now - 86_400_000,
  );
  const collected = returnedToday.reduce((sum, loan) => sum + Number(loan.fine_charged ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Circulation desk"
        title="Return desk"
        description="Scan a label or type a reference to find the open loan. Condition at check-in decides whether the copy goes back on the shelf or a penalty is raised."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/circulation">
                <ScanBarcode className="size-4" /> Issue books
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/fines">
                <CalendarClock className="size-4" /> Fine desk
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Out on loan"
          value={loans.length}
          hint="Open transactions across every branch"
          icon={<BookOpenCheck className="size-4" />}
        />
        <StatTile
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "danger" : "default"}
          hint="Charged daily by the policy engine"
          icon={<CalendarClock className="size-4" />}
        />
        <StatTile
          label="Checked in today"
          value={returnedToday.length}
          tone="success"
          hint={`${issuedToday.length} issued at the desk today`}
        />
        <StatTile
          label="Fines collected today"
          value={formatPeso(collected)}
          tone="gold"
          hint="Posted by return_book() as copies came back"
        />
      </div>

      <ReturnDesk
        loans={loans}
        initialTerm={term}
        lostAndDamaged={<LostDamagedPanel rows={lostAndDamaged} />}
      />
    </div>
  );
}
