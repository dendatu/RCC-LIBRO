"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/server/actions/auth";
import { useFormAction } from "@/hooks/use-form-action";
import { forgotSchema } from "@/lib/validators";

type Values = { email: string };

export function ForgotPasswordForm() {
  const action = useFormAction(requestPasswordReset);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

  if (action.state?.ok) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle="If that address has a library account, a password reset link is on its way."
        footer={
          <div className="flex flex-wrap gap-4">
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
            <button
              type="button"
              onClick={action.reset}
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Try another address
            </button>
          </div>
        }
      >
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <MailCheck className="mt-0.5 size-5 text-success" />
            <div className="text-sm text-ink-soft">
              <p className="font-medium text-ink">{action.state.message}</p>
              <p className="mt-1">
                The link expires in 60 minutes. Nothing arrived? Ask a librarian to resend it from
                the circulation desk.
              </p>
            </div>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will e-mail a secure link to the address on your library account."
      footer={
        <p>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-brand-600 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((values) => action.submit(values))}>
        <div className="space-y-2">
          <Label htmlFor="email">College e-mail</Label>
          <Input id="email" type="email" autoComplete="username" placeholder="student@rcc.edu.ph" {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
          {action.state?.message && !action.state.ok ? (
            <p className="text-xs text-danger">{action.state.message}</p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={action.pending}>
          {action.pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
