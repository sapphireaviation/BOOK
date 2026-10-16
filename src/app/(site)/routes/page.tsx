import type { Metadata } from "next";
import Link from "next/link";
import { getRoutes, groupBy } from "@/components/search/catalog";
import { Breadcrumbs, breadcrumbLd } from "@/components/search/breadcrumbs";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { absoluteUrl, site } from "@/config/site";
import { JsonLd } from "@/lib/jsonld";

const title = "Popular flight routes at the airline's own fare";
const description =
  "Flight routes with a guide page, grouped by departure city. Compare fares straight from the airlines and book with no booking fee or convenience fee added.";
const crumbs = [
  { name: "Home", path: "/" },
  { name: "Flight routes", path: "/routes" },
];

export async function generateMetadata(): Promise<Metadata> {
  const routes = await getRoutes();
  return {
    title,
    description,
    alternates: { canonical: "/routes" },
    openGraph: { title, description, url: "/routes", type: "website", siteName: site.name },
    twitter: { card: "summary_large_image", title, description },
    ...(routes.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function RoutesPage() {
  const routes = await getRoutes();
  const byOrigin = groupBy(routes, (r) => r.origin.city);

  return (
    <div className="container-page py-10 sm:py-14">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 text-3xl">Flight routes</h1>

      {routes.length ? (
        <>
          <p className="mt-4 max-w-prose text-lg text-slate">
            {routes.length} {routes.length === 1 ? "route" : "routes"} from {byOrigin.length} {byOrigin.length === 1 ? "city" : "cities"}.
            Each guide links to live fares from the airlines, with no fee added.
          </p>

          <div className="mt-10 space-y-12">
            {byOrigin.map(([city, rows]) => (
              <section key={city} aria-labelledby={`from-${rows[0].origin.iata}`}>
                <h2 id={`from-${rows[0].origin.iata}`} className="text-xl">
                  From {city}
                </h2>
                <ul className="mt-3 grid border-t border-line sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
                  {rows.map((r) => (
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
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No route guides yet"
            action={
              <Link href="/flights" className={buttonClass({ variant: "secondary" })}>
                Search flights
              </Link>
            }
          >
            Route guides appear here as they are written. You can search any route now.
          </EmptyState>
        </div>
      )}

      <JsonLd
        data={[
          { "@context": "https://schema.org", ...breadcrumbLd(crumbs) },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Flight routes",
            numberOfItems: routes.length,
            itemListElement: routes.map((r, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `Flights from ${r.origin.city} (${r.origin.iata}) to ${r.destination.city} (${r.destination.iata})`,
              url: absoluteUrl(`/flights/${r.slug}`),
            })),
          },
        ]}
      />
    </div>
  );
}
