"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signInWithGoogle, signInWithPassword } from "@/server/actions/auth";
import { useFormAction } from "@/hooks/use-form-action";
import { loginSchema } from "@/lib/validators";
import { APP_NAME } from "@/lib/constants";

type Values = { email: string; password: string };

const NOTICES: Record<string, string> = {
  signed_out: "You have been signed out of RCC LIBRO.",
  session_expired: "Your session expired. Please sign in again.",
  recovery: "Set a new password to finish recovering your account.",
  needs_profile: "Complete your borrower profile before borrowing.",
};

export function LoginForm({ next, reason }: { next: string | null; reason: string | null }) {
  const password = useFormAction(signInWithPassword);
  const google = useFormAction(signInWithGoogle);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (password.state && !password.state.ok) {
      toast.error(password.state.message ?? "Sign in failed.");
    }
  }, [password.state]);

  const submitPassword = handleSubmit((values) =>
    password.submit(values as unknown as Record<string, unknown>, { next: next ?? "" }),
  );

  return (
    <AuthShell
      title={`Sign in to ${APP_NAME}`}
      subtitle="Members of Republic Central Colleges may use their college Google account or their library e-mail address."
      footer={
        <p>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-brand-600 underline-offset-4 hover:underline"
          >
            Request a library card
          </Link>
        </p>
      }
    >
      {reason && NOTICES[reason] ? (
        <Alert className="mb-5 border-info/30 bg-info/10 text-info">
          <AlertCircle className="size-4" />
          <AlertDescription>{NOTICES[reason]}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full bg-card"
          disabled={google.pending || password.pending}
          onClick={() => void google.submit({}, { next: next ?? "" })}
        >
          {google.pending ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 py-1">
          <Separator className="flex-1" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            or use your e-mail
          </span>
          <Separator className="flex-1" />
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={submitPassword} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">College e-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="student@rcc.edu.ph"
              className="pl-9"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </div>
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
          {password.state?.message && !password.state.ok ? (
            <p className="text-xs text-danger">{password.state.message}</p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={password.pending || google.pending}>
          {password.pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Seeded demo accounts — <span className="font-medium text-ink-soft">admin@rcc.edu.ph</span>,{" "}
        <span className="font-medium text-ink-soft">librarian@rcc.edu.ph</span>,{" "}
        <span className="font-medium text-ink-soft">student@rcc.edu.ph</span> — share the password{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">RccLibrary#2026</code>.
      </p>
    </AuthShell>
  );
}
