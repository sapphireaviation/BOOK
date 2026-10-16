import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { durationLabel } from "@/components/flights/format";
import { FlightsNotConnected } from "@/components/flights/not-connected";
import { FlightSearchForm } from "@/components/search/flight-search-form";
import { Skeleton } from "@/components/ui";
import { absoluteUrl, site } from "@/config/site";
import { breadcrumbLd, JsonLd } from "@/lib/jsonld";
import { getFlightProvider } from "@/server/flights";
import { approxFlightMinutes, greatCircleKm } from "@/server/flights/geo";
import { listRoutes, type FlightRoute } from "@/server/flights/routes";

const title = "Flights at the airline's own fare";
const description = `Search flights and pay exactly what the airline charges for the fare, taxes and fees. ${site.name} adds no platform fee to any booking.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/flights" },
  openGraph: { title, description, url: "/flights", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const GROUP_ORDER = ["Within India", "India and the Gulf", "India and Southeast Asia", "India and the UK", "Around the world"];

export default function FlightsPage() {
  const connected = getFlightProvider() !== null;
  return (
    <>
      <section className="border-b border-line">
        <div className="container-page py-12 lg:py-16">
          <h1 className="max-w-3xl text-3xl lg:text-4xl">Flights at the airline&apos;s own fare</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate">
            We search airlines directly. The price you see is the fare, taxes and airline fees, and our platform fee is 0.
          </p>
          <div className="mt-8">
            <FlightSearchForm layout="hero" />
          </div>
        </div>
      </section>

      {!connected && (
        <div className="container-page mt-10">
          <FlightsNotConnected />
        </div>
      )}

      <Suspense fallback={<RoutesSkeleton />}>
        <PopularRoutes />
      </Suspense>

      <JsonLd
        data={{
          ...breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Flights", path: "/flights" },
          ]),
        }}
      />
    </>
  );
}

function RoutesSkeleton() {
  return (
    <div className="container-page py-12">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  );
}

async function PopularRoutes() {
  let routes: FlightRoute[];
  try {
    routes = await listRoutes();
  } catch (err) {
    console.error("listRoutes failed", err);
    return null;
  }
  if (!routes.length) return null;

  const groups = new Map<string, FlightRoute[]>();
  for (const r of routes) {
    const g = r.group ?? "More routes";
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => (GROUP_ORDER.indexOf(a[0]) + 1 || 99) - (GROUP_ORDER.indexOf(b[0]) + 1 || 99),
  );

  return (
    <section aria-labelledby="routes-heading" className="container-page py-12 lg:py-16">
      <h2 id="routes-heading" className="text-2xl">
        Popular routes
      </h2>
      <p className="mt-2 max-w-2xl text-slate">Each route page lists the airports, the distance and a typical flight time. Times are estimates from the distance.</p>
      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        {ordered.map(([group, list]) => (
          <div key={group}>
            <h3 className="text-lg">{group}</h3>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {list
                .sort((a, b) => a.origin.city.localeCompare(b.origin.city) || a.destination.city.localeCompare(b.destination.city))
                .map((r) => {
                  const km = greatCircleKm(r.origin, r.destination);
                  return (
                    <li key={r.slug}>
                      <Link href={`/flights/${r.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-3 hover:text-sapphire">
                        <span className="font-semibold">
                          {r.origin.city} to {r.destination.city}
                        </span>
                        <span className="tnum text-sm text-slate">
                          {r.origin.iata} to {r.destination.iata}, about {durationLabel(approxFlightMinutes(km))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
      <JsonLd
        data={{
          "@type": "ItemList",
          name: "Popular flight routes",
          itemListElement: routes.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `Flights from ${r.origin.city} to ${r.destination.city}`,
            url: absoluteUrl(`/flights/${r.slug}`),
          })),
        }}
      />
    </section>
  );
}
