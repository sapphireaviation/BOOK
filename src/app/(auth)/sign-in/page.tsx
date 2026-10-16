import type { Metadata } from "next";
import { Suspense } from "react";
import { features } from "@/config/env";
import { site } from "@/config/site";
import { SignInForm } from "../_components/auth-forms";
import { FormSkeleton } from "../_components/form-skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${site.name} to see your trips, manage bookings and save stays. Use your password, a one time link sent to your email, or your Google account.`,
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <Suspense fallback={<FormSkeleton title="Sign in" />}>
      <SignInForm googleEnabled={features.google()} />
    </Suspense>
  );
}
