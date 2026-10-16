import type { Metadata } from "next";
import { Suspense } from "react";
import { features } from "@/config/env";
import { site } from "@/config/site";
import { SignUpForm } from "../_components/auth-forms";
import { FormSkeleton } from "../_components/form-skeleton";

export const metadata: Metadata = {
  title: "Create an account",
  description: `Create a free ${site.name} account to book flights and stays with no platform fee, keep all your trips in one place and list your own property for free.`,
  alternates: { canonical: "/sign-up" },
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<FormSkeleton title="Create an account" />}>
      <SignUpForm googleEnabled={features.google()} />
    </Suspense>
  );
}
