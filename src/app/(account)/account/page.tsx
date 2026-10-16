import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { db } from "@/db";
import { account } from "@/db/schema";
import { getSession } from "@/server/auth";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./_components/account-forms";

export const metadata: Metadata = {
  title: "Your profile",
  description: "Update your name and phone number, change your password or delete your account.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export const instant = false;

export default function AccountPage() {
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl">Your profile</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/account");
  const u = session.user as typeof session.user & { phone?: string | null };
  const credential = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, u.id), eq(account.providerId, "credential")))
    .limit(1);

  return (
    <div className="mt-8 divide-y divide-line border-y border-line">
      <section aria-labelledby="details" className="grid gap-6 py-8 md:grid-cols-[14rem_1fr]">
        <div>
          <h2 id="details" className="text-lg">
            Details
          </h2>
          <p className="mt-1 text-sm text-slate">Used on bookings and shared with your host or airline.</p>
        </div>
        <ProfileForm name={u.name} phone={u.phone ?? null} email={u.email} />
      </section>
      <section aria-labelledby="password" className="grid gap-6 py-8 md:grid-cols-[14rem_1fr]">
        <div>
          <h2 id="password" className="text-lg">
            Password
          </h2>
          <p className="mt-1 text-sm text-slate">Changing it signs out your other devices.</p>
        </div>
        <PasswordForm hasPassword={credential.length > 0} />
      </section>
      <section aria-labelledby="delete" className="grid gap-6 py-8 md:grid-cols-[14rem_1fr]">
        <div>
          <h2 id="delete" className="text-lg">
            Delete account
          </h2>
          <p className="mt-1 text-sm text-slate">Removes your personal details for good.</p>
        </div>
        <DeleteAccountForm email={u.email} />
      </section>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-8 space-y-4 border-y border-line py-8">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-11 w-36" />
    </div>
  );
}
