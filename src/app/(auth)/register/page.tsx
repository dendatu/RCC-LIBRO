import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account · RCC LIBRO",
  description: "Register for a Republic Central Colleges library card.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
