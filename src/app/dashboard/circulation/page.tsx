import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Undo2, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IssueDesk } from "@/components/circulation/issue-desk";
import {
  getBorrowerOption,
  normalizeScanTerm,
  previewDueDate,
  resolveDeskCopy,
} from "@/server/data/circulation";
import { POLICY, ROLE_LABEL } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import type { CopyLookup } from "@/server/actions/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Issue books",
  description: "Record a borrow transaction at the circulation desk by scanning a copy label.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CirculationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const member = await requireRole("librarian", "admin");
  const params = await searchParams;

  const rawBarcode = single(params.barcode) ?? single(params.copy) ?? "";
  const borrowerId = single(params.borrower) ?? "";
  const term = normalizeScanTerm(rawBarcode);

  const [copy, borrower] = await Promise.all([
    term ? resolveDeskCopy(term) : Promise.resolve(null),
    borrowerId ? getBorrowerOption(borrowerId) : Promise.resolve(null),
  ]);

  const dueDate = copy ? await previewDueDate(copy.section, null) : null;
  const initialCopy: CopyLookup | null = copy && dueDate ? { copy, dueDate } : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Circulation desk"
        title="Issue books"
        description="Scan the copy label, choose the borrower and release the loan. Eligibility, the due date and any penalty are decided by the library policy in the database."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/returns">
                <Undo2 className="size-4" /> Return desk
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/members">
                <Users className="size-4" /> Borrower records
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/fines">
                <Calculator className="size-4" /> Fines
              </Link>
            </Button>
          </>
        }
      />

      {term && !initialCopy ? (
        <Alert variant="warning">
          <AlertTitle>Label not recognised</AlertTitle>
          <AlertDescription>
            Nothing in the register matches <span className="font-mono">{term}</span>. Check the
            accession book, or scan the copy label again — the field also accepts a copy accession
            number or a scanned QR link.
          </AlertDescription>
        </Alert>
      ) : null}

      {borrower && !borrower.is_active ? (
        <Alert variant="destructive">
          <AlertDescription>
            {borrower.full_name} is disabled at the desk. Restore the account on the borrower record
            before issuing.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">
          {member.user.full_name} · {ROLE_LABEL[member.role]}
        </Badge>
        <Badge variant="outline">
          {POLICY.maxBooks} titles · {POLICY.loanDays} days · PHP {POLICY.finePerDay.toFixed(2)} per day
        </Badge>
        {borrowerId && !borrower ? (
          <span>Borrower “{borrowerId}” is not on the register.</span>
        ) : null}
      </div>

      <IssueDesk
        initialBarcode={term}
        initialCopy={initialCopy}
        initialBorrower={borrower}
        autoFocusBarcode={!term}
      />
    </div>
  );
}
