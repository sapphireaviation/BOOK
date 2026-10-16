import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { durationLabel } from "@/components/flights/format";
import { listJoin, routeFaqs, routeSummary, type RouteFactsInput } from "@/components/flights/route-facts";
import { FlightSearchForm } from "@/components/search/flight-search-form";
import { site } from "@/config/site";
import { formatDay } from "@/lib/dates";
import { breadcrumbLd, faqLd, JsonLd } from "@/lib/jsonld";
import { formatMoney } from "@/lib/money";
import { airportsInCity } from "@/server/flights/airports";
import { approxFlightMinutes, greatCircleKm, kmToMiles } from "@/server/flights/geo";
import { findRouteSlugByCodes, getRoute, getRouteSearchFacts, listRoutes, type FlightRoute } from "@/server/flights/routes";

/**
 * Listed routes are fully prerendered. Unlisted slugs block on purpose so they answer with a real
 * 404, or a 308 for code pairs, instead of a 200 App Shell with a streamed not found.
 */
export const instant = false;

const CODE_PAIR = /^([a-z]{3})-([a-z]{3})$/;

export async function generateStaticParams() {
  const routes = await listRoutes();
  // At least one param is required; an empty table only happens before the seed has run.
  return routes.length ? routes.map((r) => ({ route: r.slug })) : [{ route: "delhi-to-goa" }];
}

function facts(route: FlightRoute, search: RouteFactsInput["search"]): RouteFactsInput {
  const km = greatCircleKm(route.origin, route.destination);
  const others = (a: FlightRoute["origin"]) =>
    airportsInCity(a.city, a.countryCode)
      .filter((x) => x.iata !== a.iata)
      .map((x) => ({ iata: x.iata, name: x.name }));
  return {
    origin: route.origin,
    destination: route.destination,
    distanceKm: km,
    distanceMiles: kmToMiles(km),
    approxMinutes: approxFlightMinutes(km),
    otherOriginAirports: others(route.origin),
    otherDestinationAirports: others(route.destination),
    search,
  };
}

function clip(s: string, max: number) {
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/[\s,.]+\S*$/, "")}.`;
}

export async function generateMetadata({ params }: PageProps<"/flights/[route]">): Promise<Metadata> {
  const { route: slug } = await params;
  const route = await resolveRoute(slug);
  const o = route.origin;
  const d = route.destination;
  const km = Math.round(greatCircleKm(o, d));
  const title = `Flights from ${o.city} to ${d.city} (${o.iata} to ${d.iata})`;
  const description = clip(
    `Compare flights from ${o.city} to ${d.city}: ${new Intl.NumberFormat(site.defaultLocale).format(km)} km, about ${durationLabel(approxFlightMinutes(km))} nonstop. Pay the airline's own fare with no platform fee on ${site.name}.`,
    160,
  );
  const path = `/flights/${route.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Params are awaited outside Suspense on purpose: listed routes prerender fully, every other slug
 * gets a real 404 (or a 308 from a code pair like /flights/del-goi) instead of a streamed fallback.
 */
export default async function RoutePage({ params }: PageProps<"/flights/[route]">) {
  const { route: slug } = await params;
  const route = await resolveRoute(slug);
  return <RouteContent route={route} />;
}

async function resolveRoute(slug: string): Promise<FlightRoute> {
  const route = await getRoute(slug);
  if (route) return route;
  const pair = slug.toLowerCase().match(CODE_PAIR);
  if (pair) {
    const named = await findRouteSlugByCodes(pair[1], pair[2]);
    if (named) permanentRedirect(`/flights/${named}`);
  }
  notFound();
}

async function RouteContent({ route }: { route: FlightRoute }) {

  const [search, all] = await Promise.all([getRouteSearchFacts(route.origin.iata, route.destination.iata), listRoutes()]);
  const f = facts(route, search);
  const faqs = routeFaqs(f);
  const o = route.origin;
  const d = route.destination;
  const reverse = all.find((r) => r.origin.iata === d.iata && r.destination.iata === o.iata);
  const fromHere = all.filter((r) => r.origin.iata === o.iata && r.slug !== route.slug).slice(0, 8);
  const toThere = all.filter((r) => r.destination.iata === d.iata && r.slug !== route.slug).slice(0, 8);
  const num = (n: number) => new Intl.NumberFormat(site.defaultLocale).format(Math.round(n));
  const path = `/flights/${route.slug}`;

  return (
    <div className="container-page py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap gap-2 text-slate">
          <li>
            <Link href="/" className="link">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/flights" className="link">
              Flights
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {o.city} to {d.city}
          </li>
        </ol>
      </nav>

      <h1 className="mt-4 text-3xl md:text-4xl">
        Flights from {o.city} to {d.city}
      </h1>
      <p className="mt-4 max-w-3xl text-lg">{routeSummary(f)}</p>

      <section aria-labelledby="search-heading" className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 id="search-heading" className="mb-4 text-lg">
          Search {o.city} to {d.city}
        </h2>
        <FlightSearchForm layout="bar" initial={{ from: o.iata, to: d.iata }} />
      </section>

      <section aria-labelledby="facts-heading" className="mt-12 max-w-3xl">
        <h2 id="facts-heading" className="text-2xl">
          Route facts
        </h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <Fact term="Departure airport">
            {o.name} ({o.iata}), {o.city}, {o.countryName}
          </Fact>
          <Fact term="Arrival airport">
            {d.name} ({d.iata}), {d.city}, {d.countryName}
          </Fact>
          {f.otherOriginAirports.length > 0 && (
            <Fact term={`Other airports in ${o.city}`}>{listJoin(f.otherOriginAirports.map((a) => `${a.name} (${a.iata})`))}</Fact>
          )}
          {f.otherDestinationAirports.length > 0 && (
            <Fact term={`Other airports in ${d.city}`}>{listJoin(f.otherDestinationAirports.map((a) => `${a.name} (${a.iata})`))}</Fact>
          )}
          <Fact term="Distance">
            <span className="tnum">
              {num(f.distanceKm)} km ({num(f.distanceMiles)} miles)
            </span>
            <span className="text-slate">, great-circle</span>
          </Fact>
          <Fact term="Nonstop flight time">
            <span className="tnum">About {durationLabel(f.approxMinutes)}</span>
            <span className="text-slate">, approximate, estimated from the distance</span>
          </Fact>
          {search.carriers.length > 0 && (
            <Fact term={`Airlines seen in the last ${search.windowDays} days`}>{listJoin(search.carriers.map((c) => c.name))}</Fact>
          )}
          {search.cheapest && (
            <Fact term="Lowest fare seen">
              <span className="tnum">{formatMoney(search.cheapest)}</span>
              <span className="text-slate">
                , one way economy for one adult, travelling {formatDay(search.cheapest.depart)}, found {formatDay(search.cheapest.searchedAt.slice(0, 10))}
              </span>
            </Fact>
          )}
        </dl>
      </section>

      <section aria-labelledby="faq-heading" className="mt-12 max-w-3xl">
        <h2 id="faq-heading" className="text-2xl">
          Questions about this route
        </h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {faqs.map((q) => (
            <div key={q.q} className="py-5">
              <h3 className="text-lg">{q.q}</h3>
              <p className="mt-2 text-slate">{q.a}</p>
            </div>
          ))}
        </div>
      </section>

      {(reverse || fromHere.length > 0 || toThere.length > 0) && (
        <section aria-labelledby="related-heading" className="mt-12 max-w-3xl">
          <h2 id="related-heading" className="text-2xl">
            Related routes
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {[...(reverse ? [reverse] : []), ...fromHere, ...toThere]
              .filter((r, i, arr) => arr.findIndex((x) => x.slug === r.slug) === i)
              .map((r) => (
                <li key={r.slug} className="flex items-baseline justify-between gap-4 py-3">
                  <Link href={`/flights/${r.slug}`} className="link font-semibold">
                    {r.origin.city} to {r.destination.city}
                  </Link>
                  <span className="text-sm text-slate">
                    {r.origin.iata} to {r.destination.iata}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            ...breadcrumbLd([
              { name: "Home", path: "/" },
              { name: "Flights", path: "/flights" },
              { name: `${o.city} to ${d.city}`, path },
            ]),
          },
          { "@context": "https://schema.org", ...faqLd(faqs) },
        ]}
      />
    </div>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
