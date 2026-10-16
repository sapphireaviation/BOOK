import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StaySearchForm } from "@/components/search/stay-search-form";
import { absoluteUrl, site } from "@/config/site";
import { breadcrumbLd, JsonLd } from "@/lib/jsonld";
import { formatMoney } from "@/lib/money";
import { listDestinations, type DestinationSummary } from "@/server/stays/places";

const title = "Book stays directly with owners, no platform fee";
const description =
  "Search homes, guesthouses and hotels across India and abroad. Owners set their own prices, you see the full total before paying, and nobody pays a platform fee.";

export const metadata: Metadata = {
  title: "Stays with no platform fee",
  description,
  alternates: { canonical: "/stays" },
  openGraph: { title, description, url: "/stays", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function StaysPage() {
  return (
    <>
      <section className="border-b border-line">
        <div className="container-page py-12 lg:py-16">
          <h1 className="max-w-3xl text-3xl lg:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate">
            Owners list their own places and keep everything they charge. The price you see for your dates includes taxes and a platform fee of zero.
          </p>
          <div className="mt-8">
            <Suspense fallback={<div className="h-14" aria-hidden="true" />}>
              <StaySearchForm layout="hero" />
            </Suspense>
          </div>
        </div>
      </section>
      <Destinations />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Stays", path: "/stays" },
        ])}
      />
    </>
  );
}

async function Destinations() {
  const all = await listDestinations();
  const withStays = all.filter((d) => d.listingCount > 0);
  const india = all.filter((d) => d.countryCode === site.country);
  const abroad = all.filter((d) => d.countryCode !== site.country);

  return (
    <section className="container-page py-12" aria-labelledby="destinations-title">
      <h2 id="destinations-title" className="text-2xl">
        Places to stay
      </h2>
      <p className="mt-2 max-w-2xl text-slate">
        {withStays.length
          ? `${withStays.reduce((s, d) => s + d.listingCount, 0)} stays are listed across ${withStays.length} of these places. Each page shows prices from our listings and answers common questions.`
          : "Owners are adding their places now. Each destination page shows its stays as soon as they are listed."}
      </p>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <DestinationGroup heading="India" items={india} />
        <DestinationGroup heading="Abroad" items={abroad} />
      </div>
      <p className="mt-10 text-sm text-slate">
        Own a place? <Link href="/host" className="link">List it for free</Link> and keep the whole price.
      </p>
      <JsonLd
        data={{
          "@type": "ItemList",
          name: "Stay destinations",
          itemListElement: all.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: d.name, url: absoluteUrl(`/stays/${d.slug}`) })),
        }}
      />
    </section>
  );
}

function DestinationGroup({ heading, items }: { heading: string; items: DestinationSummary[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-lg">{heading}</h3>
      <ul className="mt-3 border-t border-line">
        {items.map((d) => (
          <li key={d.slug} className="border-b border-line">
            <Link href={`/stays/${d.slug}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-sapphire">
              <span>
                <span className="font-semibold">{d.name}</span>
                <span className="text-sm text-slate">{d.region && d.region !== d.name ? `, ${d.region}` : ""}{d.countryCode !== site.country ? `, ${d.countryName}` : ""}</span>
              </span>
              <span className="tnum shrink-0 text-sm text-slate">
                {d.listingCount ? `${d.listingCount} ${d.listingCount === 1 ? "stay" : "stays"}` : "No stays yet"}
                {d.fromPrice !== null && d.currency ? `, from ${formatMoney({ amount: d.fromPrice, currency: d.currency })}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
