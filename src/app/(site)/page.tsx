import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { getDestinations, getRoutes } from "@/components/search/catalog";
import { HomeSearch } from "@/components/search/home-search";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { FeeLine } from "@/components/ui/price";
import { site } from "@/config/site";
import { formatMoney } from "@/lib/money";

const title = `${site.name}: flights and stays with no platform fee`;
const description =
  "Search flights at the airline's own fare and stays at the owner's own price. Travelers pay no booking fee and hosts pay no commission on any booking.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", type: "website", siteName: site.name },
  twitter: { card: "summary_large_image", title, description },
};

export default function HomePage() {
  return (
    <>
      <section className="container-page pt-8 pb-14 sm:pt-14 sm:pb-20">
        <h1 className="max-w-2xl text-xl leading-snug text-slate sm:text-2xl">
          Book flights and stays with no platform fee.
        </h1>
        <div className="mt-6 sm:mt-8">
          <HomeSearch />
        </div>
        <DescribeTrip />
      </section>

      <WhatYouPay />
      <PopularRoutes />
      <Destinations />
      <ForOwners />
    </>
  );
}

function DescribeTrip() {
  const example = `Goa next weekend for 2, under ${formatMoney({ amount: 500_000, currency: "INR" })} a night`;
  return (
    <Form action="/search" className="mt-12 max-w-2xl border-t border-line pt-8 sm:mt-16">
      <label htmlFor="describe-trip" className="block text-lg font-bold">
        Or describe the trip
      </label>
      <p id="describe-trip-hint" className="mt-1 text-sm text-slate">
        Write it the way you would tell a friend. We turn it into a search you can adjust.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="describe-trip"
          name="q"
          type="search"
          required
          minLength={2}
          maxLength={300}
          enterKeyHint="search"
          aria-describedby="describe-trip-hint"
          placeholder={example}
          className={`${inputClass} h-12 w-full sm:flex-1`}
        />
        <button type="submit" className={buttonClass({ variant: "dark", className: "h-12" })}>
          Search
        </button>
      </div>
    </Form>
  );
}

function WhatYouPay() {
  return (
    <section aria-labelledby="pay-heading" className="border-y border-line bg-surface">
      <div className="container-page grid gap-8 py-14 md:grid-cols-[1fr_minmax(0,24rem)] md:gap-16">
        <div className="max-w-prose">
          <h2 id="pay-heading" className="text-2xl">
            What you pay
          </h2>
          <p className="mt-3 text-slate">
            The price on the page is the airline&apos;s fare, or the price the owner set for your dates. We do not add a booking fee or a
            convenience fee at checkout, and owners pay us no commission, so the price they set is the price you pay.
          </p>
          <p className="mt-3">
            <Link href="/how-it-works" className="link font-semibold">
              How we charge nothing
            </Link>
          </p>
        </div>
        <dl className="space-y-2 self-start rounded-md border border-line p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate">Flight</dt>
            <dd>The airline&apos;s fare</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate">Stay</dt>
            <dd>The owner&apos;s price</dd>
          </div>
          <FeeLine currency={site.defaultCurrency} />
          <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-bold">
            <dt>You pay</dt>
            <dd>The fare or the price</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

async function PopularRoutes() {
  const routes = (await getRoutes()).slice(0, 10);
  if (!routes.length) return null;
  return (
    <section aria-labelledby="routes-heading" className="container-page pt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="routes-heading" className="text-2xl">
          Popular flight routes
        </h2>
        <Link href="/routes" className="link text-sm font-semibold">
          All routes
        </Link>
      </div>
      <ul className="mt-4 grid border-t border-line md:grid-cols-2 md:gap-x-10">
        {routes.map((r) => (
          <li key={r.slug} className="border-b border-line">
            <Link href={`/flights/${r.slug}`} className="group flex items-baseline justify-between gap-4 py-3.5">
              <span className="font-semibold group-hover:text-sapphire group-hover:underline">
                {r.origin.city} to {r.destination.city}
              </span>
              <span className="tnum shrink-0 text-sm text-slate">
                {r.origin.iata} to {r.destination.iata}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Destinations() {
  const places = (await getDestinations()).slice(0, 12);
  if (!places.length) return null;
  return (
    <section aria-labelledby="places-heading" className="container-page pt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="places-heading" className="text-2xl">
          Places to stay
        </h2>
        <Link href="/destinations" className="link text-sm font-semibold">
          All destinations
        </Link>
      </div>
      <ul className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
        {places.map((p) => (
          <li key={p.slug} className="border-b border-line">
            <Link href={`/stays/${p.slug}`} className="group flex items-baseline justify-between gap-4 py-3.5">
              <span className="font-semibold group-hover:text-sapphire group-hover:underline">{p.name}</span>
              <span className="truncate text-sm text-slate">{p.region && p.region !== p.name ? p.region : p.countryName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ForOwners() {
  return (
    <section aria-labelledby="owners-heading" className="container-page pt-20">
      <div className="flex flex-col gap-6 rounded-md bg-ink px-6 py-10 text-paper sm:px-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2 id="owners-heading" className="text-2xl">
            Have a place to rent out?
          </h2>
          <p className="mt-3 text-paper/75">
            Listing is free. You set the nightly price and the house rules, guests pay the price you set, and you keep all of it.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/host" className={buttonClass({ variant: "primary", size: "lg" })}>
            List your place
          </Link>
          <Link href="/hosting" className="inline-flex h-14 items-center px-2 font-semibold text-paper underline underline-offset-4 hover:text-paper/80">
            How hosting works
          </Link>
        </div>
      </div>
    </section>
  );
}
