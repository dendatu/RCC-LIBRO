import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · RCC LIBRO",
  description: "Sign in to the RCC LIBRO library system with Google or your college e-mail.",
};

type Props = {
  searchParams: Promise<{ next?: string; reason?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, reason } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return <LoginForm next={safeNext} reason={reason ?? null} />;
}
