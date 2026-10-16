import type { Metadata } from "next";
import { Suspense } from "react";
import { site } from "@/config/site";
import { ResetPasswordForm } from "../_components/auth-forms";
import { FormSkeleton } from "../_components/form-skeleton";

export const metadata: Metadata = {
  title: "Set a new password",
  description: `Choose a new password for your ${site.name} account. Reset links work once and expire one hour after we send them by email.`,
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton title="Set a new password" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
