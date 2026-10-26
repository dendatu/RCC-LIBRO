import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type HealthState = "ready" | "partial" | "missing";

export interface HealthCheck {
  id: string;
  label: string;
  state: HealthState;
  /** What is actually configured, without printing any secret material. */
  detail: string;
  /** What the administrator must do when the state is not `ready`. */
  remedy: string;
}

const TONE: Record<HealthState, { chip: string; copy: string; icon: typeof CircleCheck }> = {
  ready: { chip: "bg-success/12 text-success", copy: "Ready", icon: CircleCheck },
  partial: { chip: "bg-warning/15 text-warning", copy: "Degraded", icon: TriangleAlert },
  missing: { chip: "bg-destructive/12 text-destructive", copy: "Missing", icon: CircleX },
};

/**
 * Server-side reading of the integration surface: Supabase credentials, the mail
 * provider and the cron secret. Values are never echoed — only whether they exist.
 */
export function IntegrationHealth({ checks }: { checks: HealthCheck[] }) {
  const ready = checks.filter((check) => check.state === "ready").length;

  return (
    <Card className="surface-card hover-lift">
      <CardHeader>
        <CardTitle>Integration health</CardTitle>
        <CardDescription>
          {ready} of {checks.length} integration(s) fully configured. Secrets are read on the server
          only — this panel never displays a key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {checks.map((check) => {
            const tone = TONE[check.state];
            const Icon = tone.icon;
            return (
              <li key={check.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                  >
                    <Icon className="size-3" />
                    {tone.copy}
                  </span>
                  <p className="text-sm font-semibold text-ink">{check.label}</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
                {check.state === "ready" ? null : (
                  <p className="text-xs leading-relaxed text-ink-soft">
                    <span className="font-semibold">To fix: </span>
                    {check.remedy}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
