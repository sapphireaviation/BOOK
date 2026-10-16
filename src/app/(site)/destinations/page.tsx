import type { Metadata } from "next";
import Link from "next/link";
import { getDestinations, groupBy } from "@/components/search/catalog";
import { Breadcrumbs, breadcrumbLd } from "@/components/search/breadcrumbs";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { absoluteUrl, site } from "@/config/site";
import { JsonLd } from "@/lib/jsonld";

const title = "Destinations for stays with no platform fee";
const description =
  "Every town and city with stays listed directly by their owners, grouped by country. Book at the owner's own price with no booking fee for guests or hosts.";
const crumbs = [
  { name: "Home", path: "/" },
  { name: "Destinations", path: "/destinations" },
];

export async function generateMetadata(): Promise<Metadata> {
  const places = await getDestinations();
  return {
    title,
    description,
    alternates: { canonical: "/destinations" },
    openGraph: { title, description, url: "/destinations", type: "website", siteName: site.name },
    twitter: { card: "summary_large_image", title, description },
    // An empty index is a thin page. Keep it out of search results until places exist.
    ...(places.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function DestinationsPage() {
  const places = await getDestinations();
  const byCountry = groupBy(
    [...places].sort((a, b) => a.countryName.localeCompare(b.countryName) || a.name.localeCompare(b.name)),
    (p) => p.countryName,
  );

  return (
    <div className="container-page py-10 sm:py-14">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 text-3xl">Destinations</h1>

      {places.length ? (
        <>
          <p className="mt-4 max-w-prose text-lg text-slate">
            Stays in {places.length} {places.length === 1 ? "place" : "places"} across {byCountry.length}{" "}
            {byCountry.length === 1 ? "country" : "countries"}, each listed by its owner. You pay the owner&apos;s price for your dates and
            nothing on top.
          </p>

          <div className="mt-10 space-y-12">
            {byCountry.map(([country, rows]) => (
              <section key={country} aria-labelledby={`country-${rows[0].countryCode}`}>
                <h2 id={`country-${rows[0].countryCode}`} className="text-xl">
                  {country}
                </h2>
                <ul className="mt-3 grid border-t border-line sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
                  {rows.map((p) => (
                    <li key={p.slug} className="border-b border-line">
                      <Link href={`/stays/${p.slug}`} className="group flex items-baseline justify-between gap-4 py-3.5">
                        <span className="font-semibold group-hover:text-sapphire group-hover:underline">{p.name}</span>
                        {p.region && p.region !== p.name && <span className="truncate text-sm text-slate">{p.region}</span>}
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
            title="No destinations yet"
            action={
              <Link href="/stays" className={buttonClass({ variant: "secondary" })}>
                Search stays
              </Link>
            }
          >
            Places appear here once owners list stays in them. You can still search any town or city.
          </EmptyState>
        </div>
      )}

      <JsonLd
        data={[
          { "@context": "https://schema.org", ...breadcrumbLd(crumbs) },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Destinations",
            numberOfItems: places.length,
            itemListElement: places.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: [p.name, p.region !== p.name ? p.region : null, p.countryName].filter(Boolean).join(", "),
              url: absoluteUrl(`/stays/${p.slug}`),
            })),
          },
        ]}
      />
    </div>
  );
}
