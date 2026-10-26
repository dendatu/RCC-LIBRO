"use client";

import { useState } from "react";
import { Loader2, MailPlus, PlayCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runReminderJob, sendTestEmail } from "@/server/actions/admin";
import { useFormAction } from "@/hooks/use-form-action";

export function EmailJobControls({
  adminEmail,
  deliveryMode,
  providerLabel,
}: {
  adminEmail: string;
  deliveryMode: "live" | "outbox";
  providerLabel: string;
}) {
  const run = useFormAction(runReminderJob);
  const test = useFormAction(sendTestEmail);
  const [recipient, setRecipient] = useState("");

  const lastRun = run.state;
  const lastTest = test.state;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Run the scheduled job now</p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
            Executes the exact code path Vercel Cron runs each day: marks overdue loans, stages the
            7/3/1-day and overdue notices, then flushes the queue. Safe to press twice — the
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              dedupe_key
            </code>
            on each staged message stops a borrower receiving the same reminder again.
          </p>
        </div>
        <Button
          variant="gold"
          onClick={() => {
            run.submit({}, {});
            toast.info("Reminder job started");
          }}
          disabled={run.pending}
          aria-label="Run the due-date reminder job immediately"
        >
          {run.pending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
          {run.pending ? "Running…" : "Run reminder job"}
        </Button>
      </div>

      {lastRun ? (
        <Alert variant={lastRun.ok ? "info" : "destructive"}>
          <RefreshCw className="size-4" />
          <AlertTitle>{lastRun.ok ? "Job finished" : "Job reported a problem"}</AlertTitle>
          <AlertDescription>{lastRun.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="border-t border-border pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-sm">
            <Label htmlFor="test-recipient">Send a test message to</Label>
            <Input
              id="test-recipient"
              type="email"
              className="mt-1.5"
              placeholder={adminEmail}
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              autoComplete="email"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Leave blank to use your own address ({adminEmail}). Delivery mode:{" "}
              {deliveryMode === "live"
                ? `${providerLabel} is configured, messages really go out.`
                : "no mail transport is configured — messages are journaled as skipped."}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={test.pending}
            aria-label="Send a test welcome e-mail"
            onClick={() => {
              test.submit({ to: recipient.trim() });
              toast.info("Test message queued");
            }}
          >
            {test.pending ? <Loader2 className="animate-spin" /> : <MailPlus />}
            {test.pending ? "Sending…" : "Send test e-mail"}
          </Button>
        </div>

        {lastTest ? (
          <Alert
            className="mt-3"
            variant={lastTest.ok ? "info" : "destructive"}
            role="status"
            aria-live="polite"
          >
            <MailPlus className="size-4" />
            <AlertTitle>{lastTest.ok ? "Test e-mail handled" : "Test e-mail failed"}</AlertTitle>
            <AlertDescription>{lastTest.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
