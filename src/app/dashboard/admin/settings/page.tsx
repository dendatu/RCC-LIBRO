import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { getSettingsBundle } from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Policy settings",
  description:
    "Configure loan limits, due periods, fine rates, reminder timing and the sender identity used by RCC LIBRO.",
};

const GROUP_LABEL: Record<string, string> = {
  circulation: "Circulation",
  fines: "Fines",
  notifications: "Notifications",
  general: "General",
};

function renderValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function AdminSettingsPage() {
  await requireRole("admin");
  const bundle = await getSettingsBundle();

  const lastUpdated = bundle.rows.reduce(
    (latest, row) => (row.updated_at > latest ? row.updated_at : latest),
    "",
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Policy settings"
        description="The written RCC library rules, expressed as values the database enforces: how many books a member may hold, for how long, what an overdue day costs, and when reminders are sent."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Settings2 className="size-3.5" />
            {bundle.rows.length} setting(s)
          </Badge>
        }
      />

      <SettingsForm initial={bundle.values} lastUpdated={lastUpdated || new Date().toISOString()} />

      <Card>
        <CardHeader>
          <CardTitle>Stored values, group by group</CardTitle>
          <CardDescription>
            Read straight from the settings table. Every entry above maps onto one of these keys,
            and each save is written to the audit trail with the full before-and-after payload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bundle.grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No settings rows are present yet — run the Supabase migrations to seed the defaults.
            </p>
          ) : (
            <Tabs defaultValue={bundle.grouped[0].group}>
              <TabsList aria-label="Settings group">
                {bundle.grouped.map((group) => (
                  <TabsTrigger key={group.group} value={group.group}>
                    {GROUP_LABEL[group.group] ?? group.group}
                  </TabsTrigger>
                ))}
              </TabsList>
              {bundle.grouped.map((group) => (
                <TabsContent key={group.group} value={group.group}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Key</TableHead>
                        <TableHead scope="col">Label</TableHead>
                        <TableHead scope="col">Value</TableHead>
                        <TableHead scope="col">Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-mono text-[11px] text-brand-700">
                            {row.key}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-ink">{row.label}</p>
                            {row.description ? (
                              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                                {row.description}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-ink-soft">
                            {renderValue(row.value)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(row.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
