"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/server/actions/auth";
import { useFormAction } from "@/hooks/use-form-action";
import { resetSchema } from "@/lib/validators";

type Values = { password: string; confirmPassword: string };

export function ResetPasswordForm({ missingToken }: { missingToken: boolean }) {
  const action = useFormAction(updatePassword);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (missingToken) {
    return (
      <AuthShell
        title="Reset link incomplete"
        subtitle="This page needs the recovery token Supabase appends to the reset link."
        footer={
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-ink-soft">
          Open the link exactly as it was e-mailed to you, or sign in and use{" "}
          <span className="font-medium">Forgot password</span> again.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your session is already authenticated from the reset link. Pick a password and you are back in."
      footer={
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Cancel and return to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((values) => action.submit(values))}>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-danger">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
        {action.state?.message && !action.state.ok ? (
          <p className="text-xs text-danger">{action.state.message}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={action.pending}>
          {action.pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
