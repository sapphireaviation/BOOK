import type { Metadata } from "next";
import Link from "next/link";
import { io } from "next/cache";
import { connection } from "next/server";
import { Suspense } from "react";
import { initialBookingState } from "@/components/flights/booking-state";
import { FareRules } from "@/components/flights/fare-rules";
import { cabinLabels, lastTravelDate, passengerCountLabel } from "@/components/flights/format";
import { SliceItinerary } from "@/components/flights/itinerary";
import { FlightsNotConnected } from "@/components/flights/not-connected";
import { PassengerForm } from "@/components/flights/passenger-form";
import { searchHref } from "@/components/flights/result-filters";
import { TestDataBadge } from "@/components/flights/test-data-badge";
import { ButtonLink, Notice, PriceBreakdown, Skeleton } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { localDate } from "@/lib/flight-time";
import { formatMoney } from "@/lib/money";
import { getSession } from "@/server/auth";
import { getFlightProvider, getOffer } from "@/server/flights";
import { allCountries } from "@/server/flights/airports";
import { OfferExpiredError, type Offer } from "@/server/flights/types";
import { startFlightBooking } from "./actions";

/** Transactional page: always a fresh fare from the airline, never prerendered. */
export const instant = false;

export const metadata: Metadata = {
  title: "Review your flight",
  description: "Check the itinerary, fare rules and price, then add traveler details. You pay the airline's fare with no platform fee.",
  robots: { index: false, follow: false },
};

export default function OfferPage({ params }: PageProps<"/flights/offer/[offerId]">) {
  return (
    <div className="container-page py-8 md:py-12">
      <Link href="/flights" className="link text-sm">
        Flights
      </Link>
      <Suspense fallback={<OfferSkeleton />}>
        <OfferContent params={params} />
      </Suspense>
    </div>
  );
}

function OfferSkeleton() {
  return (
    <div className="mt-4 space-y-4" aria-busy="true" aria-label="Checking the fare with the airline">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-8 h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Request time values: minutes left on the airline's price hold, and today's date. */
function clock(expiresAt: string) {
  const now = new Date();
  return {
    holdMinutes: Math.max(0, Math.floor((Date.parse(expiresAt) - now.getTime()) / 60_000)),
    today: now.toISOString().slice(0, 10),
  };
}

function counts(offer: Offer) {
  const types = offer.passengers?.map((p) => p.type) ?? offer.passengerIds.map(() => "adult" as const);
  return {
    adults: types.filter((t) => t === "adult").length,
    children: types.filter((t) => t === "child").length,
    infants: types.filter((t) => t === "infant_without_seat").length,
  };
}

function searchAgain(offer: Offer) {
  const out = offer.slices[0];
  const back = offer.slices[1];
  return searchHref({
    from: out.origin.iata,
    to: out.destination.iata,
    depart: localDate(out.departAt),
    return: back ? localDate(back.departAt) : undefined,
    ...counts(offer),
    cabin: offer.cabinClass && offer.cabinClass !== "economy" ? offer.cabinClass : undefined,
  });
}

async function OfferContent({ params }: { params: PageProps<"/flights/offer/[offerId]">["params"] }) {
  const { offerId } = await params;
  await connection();
  if (!getFlightProvider()) {
    return (
      <div className="mt-6">
        <FlightsNotConnected headingLevel={1} />
      </div>
    );
  }

  let offer: Offer;
  try {
    offer = await getOffer(decodeURIComponent(offerId));
  } catch (err) {
    const expired = err instanceof OfferExpiredError;
    if (!expired) console.error("getOffer failed", err);
    return (
      <div className="mt-6 max-w-2xl">
        <h1 className="text-3xl">{expired ? "This fare is no longer available" : "We could not reach the airline"}</h1>
        <p className="mt-3 text-slate">
          {expired
            ? "Airlines hold fares for a short time and this one has gone. Search again to see current fares for your dates."
            : "The airline did not answer in time, so we cannot confirm this fare right now. Try again in a minute."}
        </p>
        <ButtonLink href="/flights" className="mt-6">
          Search flights
        </ButtonLink>
      </div>
    );
  }

  await io();
  const { holdMinutes, today } = clock(offer.expiresAt);
  const pax = counts(offer);
  const travelers = pax.adults + pax.children + pax.infants;
  const out = offer.slices[0];
  const back = offer.slices[1];
  const session = await getSession().catch(() => null);
  const kinds = offer.passengers?.length ? offer.passengers.map((p) => ({ kind: p.type })) : offer.passengerIds.map(() => ({ kind: "adult" as const }));

  return (
    <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl md:text-4xl">
            {out.origin.city} to {out.destination.city}
          </h1>
          <TestDataBadge provider={offer.provider} />
        </div>
        <p className="mt-2 text-slate">
          {back ? `Return, ${formatDay(localDate(out.departAt))} to ${formatDay(localDate(back.departAt))}` : `One way, ${formatDay(localDate(out.departAt))}`}
          , {passengerCountLabel(pax)}, {(cabinLabels[offer.cabinClass ?? "economy"] ?? "Economy").toLowerCase()}, sold by {offer.owner.name}
        </p>
        <p className="mt-3 text-base lg:hidden">
          <span className="tnum font-bold">{formatMoney({ amount: offer.total, currency: offer.currency })}</span>{" "}
          <span className="text-slate">
            for {travelers === 1 ? "1 traveler" : `${travelers} travelers`}, with taxes. Platform fee{" "}
            <span className="rounded-sm bg-runway px-1 font-bold text-ink">{formatMoney({ amount: 0, currency: offer.currency })}</span>
          </span>
        </p>

        <div className="mt-8 space-y-6 rounded-md border border-line bg-surface p-5">
          {offer.slices.map((s, i) => (
            <SliceItinerary key={s.id} slice={s} heading={back ? (i === 0 ? "Outbound" : "Return") : "Flight"} />
          ))}
        </div>

        <section className="mt-8" aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="text-xl">
            Fare rules
          </h2>
          <p className="mb-3 text-sm text-slate">Set by {offer.owner.name}. Fees apply per traveler, before departure. We never add our own.</p>
          <FareRules conditions={offer.conditions} />
        </section>

        <section className="mt-10" aria-labelledby="travelers-heading">
          <h2 id="travelers-heading" className="text-xl">
            Who is flying
          </h2>
          <div className="mt-4">
            <PassengerForm
              action={startFlightBooking.bind(null, offer.id)}
              initialState={initialBookingState}
              passengers={kinds}
              requiresPassport={offer.requiresPassport}
              travelDate={lastTravelDate(offer)}
              today={today}
              countries={allCountries()}
              defaultContact={session ? { name: session.user.name, email: session.user.email } : undefined}
              searchAgainHref={searchAgain(offer)}
              submitLabel="Continue to payment"
            />
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-md border border-line bg-surface p-5 shadow-float">
          <h2 className="text-lg">Price for {travelers === 1 ? "1 traveler" : `${travelers} travelers`}</h2>
          <PriceBreakdown
            className="mt-4"
            currency={offer.currency}
            total={offer.total}
            lines={[
              { label: "Base fare", amount: offer.baseAmount },
              { label: "Taxes and airline fees", amount: offer.taxAmount },
            ]}
          />
          <p className="mt-4 text-xs text-slate">
            You pay {formatMoney({ amount: offer.total, currency: offer.currency })}, the fare {offer.owner.name} charges. We add no platform fee.
          </p>
          {holdMinutes > 0 && holdMinutes < 24 * 60 && (
            <p className="mt-2 text-xs text-slate">
              The airline holds this price for about {holdMinutes} {holdMinutes === 1 ? "minute" : "minutes"}.
            </p>
          )}
        </div>
        {offer.provider === "fixture" && (
          <Notice tone="bad" className="mt-4">
            These fares are generated for development. They are not from an airline and cannot be ticketed.
          </Notice>
        )}
      </aside>
    </div>
  );
}
