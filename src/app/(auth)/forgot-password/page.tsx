import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password · RCC LIBRO",
  description: "Request a password reset link for your RCC library account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
