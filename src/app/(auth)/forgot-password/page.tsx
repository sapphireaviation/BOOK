import type { Metadata } from "next";
import { site } from "@/config/site";
import { ForgotPasswordForm } from "../_components/auth-forms";

export const metadata: Metadata = {
  title: "Reset your password",
  description: `Forgot your ${site.name} password? Enter the email on your account and we will send a link to set a new one. The link works once and expires after one hour.`,
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
