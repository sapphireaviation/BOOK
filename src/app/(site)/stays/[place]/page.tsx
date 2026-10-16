import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StaySearchForm } from "@/components/search/stay-search-form";
import { plural } from "@/components/stays/format";
import { StayMap } from "@/components/stays/stay-map";
import { StayRow } from "@/components/stays/stay-row";
import { Skeleton } from "@/components/ui";
import { absoluteUrl, site } from "@/config/site";
import { propertyTypeLabels } from "@/lib/amenities";
import { breadcrumbLd, faqLd, JsonLd } from "@/lib/jsonld";
import { formatMoney } from "@/lib/money";
import { monthLabel, placeFaq, placeLead } from "@/server/stays/place-copy";
import { getPlacePage, type PlacePage } from "@/server/stays/places";

type Params = PageProps<"/stays/[place]">["params"];

/** Destination pages with fewer published stays than this are kept out of search engines. */
const INDEX_MIN_LISTINGS = 3;

function clamp(text: string, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}.`;
}

function describe(p: PlacePage) {
  const s = p.stats;
  if (!s.count || !s.currency || s.priceMin === null) {
    return clamp(`Stays in ${p.name}${p.countryName ? `, ${p.countryName}` : ""}: owners list their places directly and set their own prices. Book with no platform fee for guests or hosts.`);
  }
  return clamp(
    `${plural(s.count, "stay")} in ${p.name} from ${formatMoney({ amount: s.priceMin, currency: s.currency })} a night, as of ${monthLabel(p.asOf)}. Book directly with owners, see the full price for your dates, and pay no platform fee.`,
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { place } = await params;
  const p = await getPlacePage(place);
  if (!p) return { title: "Place not found", robots: { index: false, follow: true } };
  const title = `Stays in ${p.name}${p.countryCode && p.countryCode !== site.country && p.countryName ? `, ${p.countryName}` : ""}`;
  const description = describe(p);
  const image = p.listings.find((l) => l.photo)?.photo;
  const url = `/stays/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(p.stats.count < INDEX_MIN_LISTINGS ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url, type: "website", images: image ? [{ url: absoluteUrl(image.url), width: 1200, height: 800, alt: image.alt }] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function PlacePageRoute({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PlaceSkeleton />}>
      <PlaceContent params={params} />
    </Suspense>
  );
}

function PlaceSkeleton() {
  return (
    <div className="container-page py-10" aria-busy="true">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="mt-4 h-5 w-3/4" />
      <Skeleton className="mt-2 h-5 w-2/3" />
      <Skeleton className="mt-10 h-64 w-full" />
    </div>
  );
}

async function PlaceContent({ params }: { params: Params }) {
  const { place } = await params;
  const p = await getPlacePage(place);
  if (!p) notFound();

  const s = p.stats;
  const faq = placeFaq(p.name, s, p.asOf, p.airports);
  const lead = placeLead(p.name, s, p.asOf);
  const where = [p.region !== p.name ? p.region : null, p.countryName].filter(Boolean).join(", ");
  const url = `/stays/${p.slug}`;

  const facts: { label: string; value: string }[] = [{ label: "Stays listed", value: String(s.count) }];
  if (s.currency && s.priceMin !== null && s.priceMax !== null) {
    facts.push({
      label: "Nightly prices",
      value: s.priceMin === s.priceMax ? formatMoney({ amount: s.priceMin, currency: s.currency }) : `${formatMoney({ amount: s.priceMin, currency: s.currency })} to ${formatMoney({ amount: s.priceMax, currency: s.currency })}`,
    });
  }
  facts.push({ label: "Average guest rating", value: s.ratingAvg !== null ? `${s.ratingAvg.toFixed(1)} out of 5, ${plural(s.reviewCount, "review")}` : "No reviews yet" });
  if (p.airports.length) facts.push({ label: p.airports.length === 1 ? "Nearest airport" : "Nearest airports", value: p.airports.map((a) => a.code).join(", ") });

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      "@id": absoluteUrl(`${url}#destination`),
      name: p.name,
      description: p.summary ?? lead,
      url: absoluteUrl(url),
      geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
      ...(p.countryName ? { containedInPlace: { "@type": "Country", name: p.countryName } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Stays in ${p.name}`,
      numberOfItems: p.listings.length,
      itemListElement: p.listings.map((l, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(l.url), name: l.title })),
    },
    {
      "@context": "https://schema.org",
      ...breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Stays", path: "/stays" },
        { name: p.name, path: url },
      ]),
    },
  ];
  if (faq.length) jsonLd.push({ "@context": "https://schema.org", ...faqLd(faq) });

  return (
    <article>
      <header className="border-b border-line">
        <div className="container-page py-10 lg:py-12">
          <nav aria-label="Breadcrumb" className="text-sm text-slate">
            <ol className="flex flex-wrap gap-x-2">
              <li>
                <Link href="/stays" className="tap hover:text-ink">
                  Stays
                </Link>
                <span aria-hidden="true" className="ml-2">
                  /
                </span>
              </li>
              <li aria-current="page">{p.name}</li>
            </ol>
          </nav>
          <h1 className="mt-2 text-3xl lg:text-4xl">Stays in {p.name}</h1>
          {where && <p className="mt-1 text-lg text-slate">{where}</p>}
          <p className="mt-5 max-w-[70ch] text-lg">{lead}</p>
          {p.summary && <p className="mt-3 max-w-[70ch] text-slate">{p.summary}</p>}

          <dl className="mt-8 grid max-w-4xl grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 md:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-sm text-slate">{f.label}</dt>
                <dd className="tnum mt-0.5 font-bold">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate">Figures come from the stays listed here, as of {monthLabel(p.asOf)}. Prices are starting prices per night before taxes.</p>
        </div>
      </header>

      <section className="border-b border-line" aria-labelledby="dates-title">
        <div className="container-page py-8">
          <h2 id="dates-title" className="text-xl">
            Check prices for your dates
          </h2>
          <div className="mt-4">
            <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
              <StaySearchForm layout="bar" initial={{ place: p.slug }} />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="list-title" className="min-w-0">
          <h2 id="list-title" className="text-2xl">
            {s.count ? `${plural(s.count, "place")} to stay` : "No stays listed yet"}
          </h2>
          {s.count === 0 ? (
            <p className="mt-3 max-w-prose text-slate">
              Nobody has listed a place in {p.name} yet. If you own one, <Link href="/host" className="link">list it for free</Link>.
            </p>
          ) : (
            <ul className="mt-6">
              {p.listings.map((l, i) => (
                <StayRow
                  key={l.id}
                  rowId={`stay-${l.id}`}
                  priority={i === 0}
                  headingLevel={3}
                  data={{
                    id: l.id,
                    url: l.url,
                    title: l.title,
                    summary: l.summary,
                    propertyType: l.propertyType,
                    where: [l.locality, l.city].filter((v, idx, a) => v && a.indexOf(v) === idx).join(", "),
                    photo: l.photo,
                    ratingAvg: l.ratingAvg,
                    ratingCount: l.ratingCount,
                    isDemo: l.isDemo,
                    freeCancellation: l.freeCancellation,
                    instantBook: l.instantBook,
                    facts: [`Sleeps ${l.maxGuests}`, plural(l.bedrooms, "bedroom")],
                    currency: l.currency,
                    price: l.fromPrice,
                    pricePrefix: "From",
                    priceNote: "a night",
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {s.count > 0 && (
          <aside aria-label={`Map of stays in ${p.name}`}>
            <div className="lg:sticky lg:top-20">
              <StayMap
                className="h-80 lg:h-[28rem]"
                label={`Map of stays in ${p.name}`}
                center={{ lat: p.lat, lng: p.lng }}
                rowIdPrefix="stay-"
                points={p.listings.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, label: formatMoney({ amount: l.fromPrice, currency: l.currency }), title: l.title, href: l.url }))}
              />
              {Object.keys(s.types).length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg">Types of place</h2>
                  <ul className="mt-2 border-t border-line text-sm">
                    {Object.entries(s.types)
                      .sort((a, b) => b[1] - a[1])
                      .map(([t, n]) => (
                        <li key={t} className="flex justify-between border-b border-line py-2">
                          <span>{propertyTypeLabels[t] ?? t}</span>
                          <span className="tnum text-slate">{n}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {faq.length > 0 && (
        <section className="border-t border-line" aria-labelledby="faq-title">
          <div className="container-page py-10">
            <h2 id="faq-title" className="text-2xl">
              Questions about staying in {p.name}
            </h2>
            <dl className="mt-6 max-w-[75ch] divide-y divide-line border-y border-line">
              {faq.map((f) => (
                <div key={f.q} className="py-5">
                  <dt className="font-bold">{f.q}</dt>
                  <dd className="mt-1.5 text-slate">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <JsonLd data={jsonLd} />
    </article>
  );
}
