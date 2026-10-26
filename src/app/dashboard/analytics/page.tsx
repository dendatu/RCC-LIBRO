import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Flame,
  Library,
  LineChart,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchUsageChart } from "@/components/analytics/branch-usage-chart";
import { CategoryDonutChart } from "@/components/analytics/category-donut-chart";
import { ChartCard } from "@/components/analytics/chart-frame";
import { PopularBooksChart } from "@/components/analytics/popular-books-chart";
import { TrendsChart, TrendsRangeSwitch } from "@/components/analytics/trends-chart";
import { requireRole } from "@/lib/rbac";
import { formatNumber, formatPeso } from "@/lib/utils";
import {
  getBorrowingTrends,
  getBranchUsage,
  getDashboardStats,
  getMostActiveBorrowers,
  getPopularBooks,
  getPopularCategories,
  resolveTrendWindow,
  type TrendWindow,
} from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
  description:
    "Borrowing trends, popular titles, subject mix and branch usage across the RCC library network.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireRole("librarian", "admin");
  const resolved = resolveTrendWindow((await searchParams).days);
  const days: TrendWindow = resolved;

  const [stats, trends, books, categories, branches, borrowers] = await Promise.all([
    getDashboardStats(),
    getBorrowingTrends(days),
    getPopularBooks(8),
    getPopularCategories(6),
    getBranchUsage(),
    getMostActiveBorrowers(10),
  ]);

  const loanVolume = trends.reduce((sum, point) => sum + point.loans, 0);
  const overdueShare =
    stats && stats.active_loans > 0 ? Math.round((stats.overdue_loans / stats.active_loans) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${member.role === "admin" ? "Administration" : "Collection management"} · Analytics`}
        title="Library analytics"
        description="How the Elementary, High School and College & Graduate School collections are really being used — trends, popular titles, subject mix, branch load and the members who borrow the most."
        actions={
          <Badge variant="gold" className="gap-1.5">
            <Activity className="size-3" />
            {days}-day window
          </Badge>
        }
      />

      {stats ? (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Key library indicators"
        >
          <StatTile
            label="Catalogued titles"
            value={formatNumber(stats.total_books)}
            hint={`${formatNumber(stats.total_copies)} physical copies · ${formatNumber(stats.new_titles_30d)} added in 30 days`}
            icon={<Library />}
          />
          <StatTile
            label="On the shelf now"
            value={formatNumber(stats.available_copies)}
            hint={`${formatNumber(stats.borrowed_copies)} out · ${formatNumber(stats.reserved_copies)} reserved`}
            icon={<BookOpen />}
            tone="success"
          />
          <StatTile
            label="Active loans"
            value={formatNumber(stats.active_loans)}
            hint={`${loanVolume.toLocaleString("en-PH")} loan(s) in the selected window`}
            icon={<Activity />}
          />
          <StatTile
            label="Overdue loans"
            value={formatNumber(stats.overdue_loans)}
            hint={
              stats.active_loans > 0
                ? `${overdueShare}% of everything on loan`
                : "Nothing is past its due date"
            }
            icon={<AlertTriangle />}
            tone={stats.overdue_loans > 0 ? "danger" : "success"}
          />
          <StatTile
            label="Members who borrow"
            value={formatNumber(stats.total_borrowers)}
            hint={`${formatNumber(stats.registered_users)} registered account(s)`}
            icon={<Users />}
          />
          <StatTile
            label="Unsettled penalties"
            value={formatPeso(stats.outstanding_fines)}
            hint={`${formatPeso(stats.collected_fines)} collected to date`}
            icon={<Flame />}
            tone={stats.outstanding_fines > 0 ? "warning" : "success"}
          />
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      )}

      <ChartCard
        title="Borrowing trend"
        description={`Books issued against books returned, day by day for the last ${days} days.`}
        action={<TrendsRangeSwitch days={days} />}
        delay={0.05}
      >
        <TrendsChart points={trends} days={days} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Most borrowed titles"
          description="Ranked by total loans recorded against each catalogue entry."
          delay={0.1}
        >
          <PopularBooksChart books={books} />
        </ChartCard>

        <ChartCard
          title="Subject mix"
          description="Share of circulation carried by each subject category."
          delay={0.15}
        >
          <CategoryDonutChart categories={categories} />
        </ChartCard>
      </div>

      <ChartCard
        title="Branch usage"
        description="Holdings measured on the left axis, live circulation on the right."
        delay={0.2}
      >
        <BranchUsageChart branches={branches} />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>Most active borrowers</CardTitle>
          <CardDescription>
            Top ten members by lifetime loans, with the overdue count that should be watched at the
            desk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {borrowers.length === 0 ? (
            <EmptyState
              icon={<LineChart className="size-7" />}
              title="No loans recorded yet"
              description="Once the circulation desk starts issuing books, the busiest members appear here."
            />
          ) : (
            <Tabs defaultValue="loans">
              <TabsList aria-label="Borrower ranking view">
                <TabsTrigger value="loans">By total loans</TabsTrigger>
                <TabsTrigger value="overdue">By overdue risk</TabsTrigger>
              </TabsList>
              <TabsContent value="loans">
                <BorrowerTable rows={borrowers} caption="Ranked by lifetime loans" />
              </TabsContent>
              <TabsContent value="overdue">
                <BorrowerTable
                  rows={[...borrowers].sort((a, b) => b.overdue - a.overdue || b.loans - a.loans)}
                  caption="Ranked by overdue loans"
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BorrowerTable({
  rows,
  caption,
}: {
  rows: Awaited<ReturnType<typeof getMostActiveBorrowers>>;
  caption: string;
}) {
  return (
    <Table>
      <TableCaption>{caption}. Read live from the loan ledger.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">#</TableHead>
          <TableHead scope="col">Member</TableHead>
          <TableHead scope="col">Classification</TableHead>
          <TableHead scope="col" className="text-right">
            Loans
          </TableHead>
          <TableHead scope="col" className="text-right">
            Overdue
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.user_id}>
            <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
            <TableCell className="font-medium text-ink">{row.full_name}</TableCell>
            <TableCell className="text-muted-foreground">{row.classification}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(row.loans)}</TableCell>
            <TableCell className="text-right">
              {row.overdue > 0 ? (
                <Badge variant="destructive">{formatNumber(row.overdue)}</Badge>
              ) : (
                <span className="tabular-nums text-muted-foreground">0</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
