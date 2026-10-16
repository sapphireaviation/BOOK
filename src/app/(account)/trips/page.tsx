import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { site } from "@/config/site";
import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { StatusBadge, longDay } from "@/components/checkout/booking-summary";
import { toISODate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { AuthError, requireUser } from "@/server/auth";
import { listTripsForUser, type TripSummary } from "@/server/bookings/queries";

export const instant = false;

export const metadata: Metadata = {
  title: "Trips",
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <h1 className="text-3xl">Trips</h1>
      <Suspense fallback={<TripsSkeleton />}>
        <Trips />
      </Suspense>
    </div>
  );
}

function TripsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading trips" className="mt-8 space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

async function signedInUser() {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

function dates(t: TripSummary) {
  if (t.kind === "stay") return `${longDay(t.startsOn)} to ${longDay(t.endsOn)}`;
  const start = longDay(t.startsOn.slice(0, 10));
  const end = t.endsOn.slice(0, 10);
  return end !== t.startsOn.slice(0, 10) ? `${start} to ${longDay(end)}` : start;
}

function TripList({ trips }: { trips: TripSummary[] }) {
  return (
    <ul className="mt-3 border-y border-line">
      {trips.map((t) => (
        <li key={t.id} className="border-t border-line first:border-t-0">
          <Link href={`/trips/${t.reference}`} className="grid gap-2 py-4 hover:bg-mist/60 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-2">
            <div>
              <p className="font-bold">{t.title}</p>
              <p className="text-sm text-slate">{t.subtitle}</p>
              <p className="tnum mt-1 text-sm">{dates(t)}</p>
            </div>
            <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
              <StatusBadge status={t.status} />
              <span className="tnum text-sm font-semibold">{formatMoney({ amount: t.total, currency: t.currency }, site.defaultLocale)}</span>
              <span className="tnum text-xs text-slate">{t.reference}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Trips() {
  const session = await signedInUser();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent("/trips")}`);

  const now = new Date();
  const today = toISODate(now);
  const trips = await listTripsForUser(session.user.id);
  const isUpcoming = (t: TripSummary) => (t.status === "confirmed" || t.status === "pending_payment") && t.endsOn.slice(0, 10) >= today;
  const upcoming = trips.filter(isUpcoming).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const past = trips.filter((t) => !isUpcoming(t));

  if (!trips.length) {
    return (
      <div className="mt-8">
        <EmptyState
          title="No trips yet"
          action={
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/stays">Find a stay</ButtonLink>
              <ButtonLink href="/flights" variant="secondary">
                Search flights
              </ButtonLink>
            </div>
          }
        >
          Stays and flights you book while signed in show up here. Booked without signing in? Use the link in your confirmation email.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-12">
      <section aria-labelledby="upcoming-h">
        <h2 id="upcoming-h" className="text-xl">
          Upcoming
        </h2>
        {upcoming.length ? <TripList trips={upcoming} /> : <p className="mt-3 text-slate">Nothing coming up. Your past trips are below.</p>}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past-h">
          <h2 id="past-h" className="text-xl">
            Past and cancelled
          </h2>
          <TripList trips={past} />
        </section>
      )}
    </div>
  );
}
