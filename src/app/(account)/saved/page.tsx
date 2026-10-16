import type { Metadata } from "next";
import { Suspense } from "react";
import { plural } from "@/components/stays/format";
import { SaveButton } from "@/components/stays/save-button";
import { StayRow } from "@/components/stays/stay-row";
import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { getSession } from "@/server/auth";
import { listSaved } from "@/server/stays/wishlist";

export const metadata: Metadata = {
  title: "Saved stays",
  description: "The places you saved while searching. Open one to check prices for your dates, or remove it from the list when you no longer need it.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/saved" },
};

export default function SavedPage() {
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl">Saved stays</h1>
      <Suspense
        fallback={
          <div className="mt-8 space-y-6" aria-busy="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        <SavedList />
      </Suspense>
    </div>
  );
}

async function SavedList() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="mt-6">
        <EmptyState
          title="Sign in to see your saved stays"
          action={
            <ButtonLink href={`/sign-in?next=${encodeURIComponent("/saved")}`} variant="dark">
              Sign in
            </ButtonLink>
          }
        >
          Saved stays are kept with your account, so they are there on any device.
        </EmptyState>
      </div>
    );
  }

  const items = await listSaved(session.user.id);
  if (!items.length) {
    return (
      <div className="mt-6">
        <EmptyState
          title="No saved stays yet"
          action={
            <ButtonLink href="/stays" variant="secondary">
              Browse stays
            </ButtonLink>
          }
        >
          Select the heart on any stay to keep it here while you compare.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-slate">{plural(items.length, "place")} saved.</p>
      <ul className="mt-8">
        {items.map((s) => (
          <StayRow
            key={s.id}
            action={<SaveButton listingId={s.id} title={s.title} initialSaved returnTo="/saved" />}
            data={{
              id: s.id,
              url: s.url,
              title: s.available ? s.title : `${s.title} (no longer listed)`,
              summary: s.summary,
              propertyType: s.propertyType,
              where: s.city,
              photo: s.photo,
              ratingAvg: s.ratingAvg,
              ratingCount: s.ratingCount,
              isDemo: s.isDemo,
              freeCancellation: false,
              instantBook: false,
              facts: [],
              currency: s.currency,
              price: s.fromPrice,
              pricePrefix: "From",
              priceNote: "a night",
            }}
          />
        ))}
      </ul>
    </>
  );
}
