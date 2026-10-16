import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { BookingPanel } from "@/components/stays/booking-panel";
import { plural } from "@/components/stays/format";
import { Gallery } from "@/components/stays/gallery";
import { SaveButton } from "@/components/stays/save-button";
import { StayMap } from "@/components/stays/stay-map";
import { SampleBadge } from "@/components/stays/stay-row";
import { Badge, Rating, Skeleton } from "@/components/ui";
import { absoluteUrl } from "@/config/site";
import { amenityGroups, amenityLabel, propertyTypeLabels } from "@/lib/amenities";
import { breadcrumbLd, JsonLd } from "@/lib/jsonld";
import { formatMoney, minorUnitDigits, toMajor } from "@/lib/money";
import { getSession } from "@/server/auth";
import { getListingPage, type ListingPage } from "@/server/stays/listing";
import { explainPolicy } from "@/server/stays/policy";
import { savedListingIds } from "@/server/stays/wishlist";

type Params = PageProps<"/stays/[place]/[slug]">["params"];

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string) {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function clamp(text: string, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}.`;
}

function whereLine(l: ListingPage) {
  return [l.locality, l.city, l.region].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
}

function describe(l: ListingPage) {
  const base = `${propertyTypeLabels[l.propertyType] ?? "Stay"} in ${whereLine(l)}, from ${formatMoney({ amount: l.fromPrice, currency: l.currency })} a night. ${l.summary}`;
  const tail = " No platform fee.";
  return clamp(base.length + tail.length <= 160 ? base + tail : base);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const l = await getListingPage(slug);
  if (!l) return { title: "Stay not found", robots: { index: false, follow: true } };
  const withCity = l.title.includes(l.city) ? l.title : `${l.title}, ${l.city}`;
  // The layout appends the site name, so keep this part short enough for the whole title to stay under 60.
  const title = withCity.length <= 48 ? withCity : l.title.length <= 48 ? l.title : `${l.title.slice(0, 48).replace(/\s+\S*$/, "")}`;
  const description = describe(l);
  const image = l.photos[0];
  return {
    title,
    description,
    alternates: { canonical: l.url },
    // Sample listings are test data and stay out of search engines.
    ...(l.isDemo ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: l.title,
      description,
      url: l.url,
      type: "website",
      images: image ? [{ url: absoluteUrl(image.url), width: image.width ?? 1200, height: image.height ?? 800, alt: image.alt }] : undefined,
    },
    twitter: { card: "summary_large_image", title: l.title, description },
  };
}

export default function ListingRoute({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <ListingContent params={params} />
    </Suspense>
  );
}

function ListingSkeleton() {
  return (
    <div className="container-page py-8" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-10 w-2/3" />
      <Skeleton className="mt-6 h-[26rem] w-full" />
    </div>
  );
}

function lodgingType(propertyType: string) {
  if (propertyType === "hotel" || propertyType === "resort") return "Hotel";
  if (propertyType === "hostel") return "Hostel";
  if (["apartment", "house", "villa", "cabin"].includes(propertyType)) return "VacationRental";
  return "LodgingBusiness";
}

function listingJsonLd(l: ListingPage) {
  const type = lodgingType(l.propertyType);
  const digits = minorUnitDigits(l.currency);
  const price = (minor: number) => toMajor(minor, l.currency).toFixed(digits);
  const url = absoluteUrl(l.url);
  const prices = l.units.map((u) => u.basePrice);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#lodging`,
    name: l.title,
    description: l.description || l.summary,
    url,
    image: l.photos.map((p) => absoluteUrl(p.url)),
    address: {
      "@type": "PostalAddress",
      ...(l.locality ? { streetAddress: l.locality } : {}),
      addressLocality: l.city,
      ...(l.region ? { addressRegion: l.region } : {}),
      ...(l.postalCode ? { postalCode: l.postalCode } : {}),
      addressCountry: l.countryCode,
    },
    geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng },
    amenityFeature: l.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: amenityLabel(a), value: true })),
    checkinTime: l.checkInFrom,
    checkoutTime: l.checkOutUntil,
    petsAllowed: l.amenities.includes("pets"),
    ...(prices.length
      ? {
          priceRange:
            Math.min(...prices) === Math.max(...prices)
              ? formatMoney({ amount: prices[0], currency: l.currency })
              : `${formatMoney({ amount: Math.min(...prices), currency: l.currency })} to ${formatMoney({ amount: Math.max(...prices), currency: l.currency })}`,
        }
      : {}),
    makesOffer: l.units.map((u) => ({
      "@type": "Offer",
      name: u.name,
      url,
      price: price(u.basePrice),
      priceCurrency: l.currency,
      availability: "https://schema.org/InStock",
      priceSpecification: { "@type": "UnitPriceSpecification", price: price(u.basePrice), priceCurrency: l.currency, unitText: "night" },
    })),
  };
  // Google reads `offers` on lodging; the spec in docs/SEO_AND_AI.md asks for it, so the cheapest room is the offer.
  if (l.units.length) {
    const cheapest = [...l.units].sort((a, b) => a.basePrice - b.basePrice)[0];
    data.offers = { "@type": "Offer", url, price: price(cheapest.basePrice), priceCurrency: l.currency, availability: "https://schema.org/InStock" };
  }
  if (type === "VacationRental") {
    data.containsPlace = {
      "@type": "Accommodation",
      additionalType: "EntirePlace",
      occupancy: { "@type": "QuantitativeValue", maxValue: l.maxGuests },
      numberOfBedrooms: l.bedrooms,
      numberOfBathroomsTotal: l.bathrooms,
    };
  } else {
    data.numberOfRooms = l.units.reduce((s, u) => s + u.quantity, 0);
  }
  if (l.rating.count > 0) {
    data.aggregateRating = { "@type": "AggregateRating", ratingValue: l.rating.avg, reviewCount: l.rating.count, bestRating: 5, worstRating: 1 };
    data.review = l.reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      datePublished: r.createdAt.slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.body ? { reviewBody: r.body } : {}),
    }));
  }
  return data;
}

async function SaveForUser({ id, title, returnTo }: { id: string; title: string; returnTo: string }) {
  const session = await getSession().catch(() => null);
  const saved = session ? (await savedListingIds(session.user.id, [id])).has(id) : false;
  return <SaveButton listingId={id} title={title} initialSaved={saved} returnTo={returnTo} showLabel />;
}

async function ListingContent({ params }: { params: Params }) {
  const { place, slug } = await params;
  const l = await getListingPage(slug);
  if (!l) notFound();
  if (l.placeSlug !== place) permanentRedirect(l.url);

  const policy = explainPolicy(l.cancellationPolicy);
  const presentGroups = amenityGroups
    .map((g) => ({ group: g.group, items: g.items.filter((i) => l.amenities.includes(i.key)) }))
    .filter((g) => g.items.length);
  const placeName = l.destination?.name ?? l.city;
  const fullWhere = `${whereLine(l)}, ${countryName(l.countryCode)}`;

  return (
    <article className="pb-16">
      <div className="container-page pt-6">
        <nav aria-label="Breadcrumb" className="text-sm text-slate">
          <ol className="flex flex-wrap gap-x-2">
            <li>
              <Link href="/stays" className="hover:text-ink">
                Stays
              </Link>
              <span aria-hidden="true" className="ml-2">
                /
              </span>
            </li>
            <li>
              <Link href={`/stays/${l.placeSlug}`} className="hover:text-ink">
                {placeName}
              </Link>
              <span aria-hidden="true" className="ml-2">
                /
              </span>
            </li>
            <li aria-current="page" className="truncate">
              {l.title}
            </li>
          </ol>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl">{l.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span>
                {propertyTypeLabels[l.propertyType] ?? "Stay"} in {fullWhere}
              </span>
              <Rating value={l.rating.avg} count={l.rating.count} />
              {l.verified && <Badge tone="good">Verified listing</Badge>}
              {l.isDemo && <SampleBadge />}
            </div>
          </div>
          <Suspense fallback={<span className="h-9 w-20" aria-hidden="true" />}>
            <SaveForUser id={l.id} title={l.title} returnTo={l.url} />
          </Suspense>
        </div>

        <div className="mt-6">
          <Gallery photos={l.photos} title={l.title} />
        </div>
      </div>

      <div className="container-page mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-12">
          {l.isDemo && (
            <p className="rounded-md border border-line bg-mist px-4 py-3 text-sm">
              This is a sample listing for testing the site. The place, photos and host are made up, so do not book it for a real trip.
            </p>
          )}

          <section aria-labelledby="about-title">
            <h2 id="about-title" className="text-xl">
              About this place
            </h2>
            {l.summary && <p className="mt-3 max-w-[70ch] text-lg">{l.summary}</p>}
            {l.description && <p className="mt-3 max-w-[70ch] whitespace-pre-line text-slate">{l.description}</p>}
            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
              <Fact label="Sleeps" value={String(l.maxGuests)} />
              <Fact label="Bedrooms" value={String(l.bedrooms)} />
              <Fact label="Beds" value={String(l.beds)} />
              <Fact label="Bathrooms" value={String(l.bathrooms)} />
              <Fact label="Check in" value={`From ${l.checkInFrom}`} />
              <Fact label="Check out" value={`By ${l.checkOutUntil}`} />
              <Fact label="Minimum stay" value={plural(l.minNights, "night")} />
              <Fact label="Booking" value={l.instantBook ? "Instant book" : "Owner confirms"} />
            </dl>
          </section>

          {l.units.length > 0 && (
            <section aria-labelledby="rooms-title">
              <h2 id="rooms-title" className="text-xl">
                {l.units.length === 1 ? "What you book" : "Rooms"}
              </h2>
              <ul className="mt-4 border-t border-line">
                {l.units.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-4">
                    <div className="min-w-0">
                      <h3 className="text-base">{u.name}</h3>
                      <p className="text-sm text-slate">
                        Sleeps {u.maxGuests}
                        {u.beds ? `, ${u.beds}` : ""}
                        {u.quantity > 1 ? `, ${u.quantity} of this type` : ""}
                      </p>
                      {u.extraGuestPrice > 0 && u.includedGuests < u.maxGuests && (
                        <p className="text-sm text-slate">
                          Price covers {plural(u.includedGuests, "guest")}. Each extra guest adds {formatMoney({ amount: u.extraGuestPrice, currency: l.currency })} a night.
                        </p>
                      )}
                      {u.description && <p className="mt-1 text-sm">{u.description}</p>}
                    </div>
                    <p className="tnum shrink-0">
                      <span className="text-sm text-slate">From </span>
                      <span className="font-bold">{formatMoney({ amount: u.basePrice, currency: l.currency })}</span>
                      <span className="text-sm text-slate"> a night</span>
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-slate">
                Prices can change by date.
                {l.taxBps > 0 ? ` Taxes of ${l.taxBps / 100}% are added to the room price.` : " The owner does not add taxes."}
                {l.cleaningFee > 0 ? ` A cleaning fee of ${formatMoney({ amount: l.cleaningFee, currency: l.currency })} is charged once per stay.` : ""} There is no platform fee.
              </p>
            </section>
          )}

          {presentGroups.length > 0 && (
            <section aria-labelledby="amenities-title">
              <h2 id="amenities-title" className="text-xl">
                What this place has
              </h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {presentGroups.map((g) => (
                  <div key={g.group}>
                    <h3 className="text-base">{g.group}</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {g.items.map((i) => (
                        <li key={i.key} className="flex items-center gap-2">
                          <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-fern" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 8.5l3 3 7-7" />
                          </svg>
                          {i.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="rules-title">
            <h2 id="rules-title" className="text-xl">
              House rules
            </h2>
            <ul className="mt-3 max-w-[70ch] list-disc space-y-1.5 pl-5">
              <li>
                Check in from {l.checkInFrom}. Check out by {l.checkOutUntil}.
              </li>
              {l.houseRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="cancel-title">
            <h2 id="cancel-title" className="text-xl">
              Cancellation: {policy.label.toLowerCase()}
            </h2>
            <ul className="mt-3 max-w-[70ch] space-y-1.5">
              {policy.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-slate">Pick your dates to see the exact deadline. Times are local to the property.</p>
          </section>

          <section aria-labelledby="where-title">
            <h2 id="where-title" className="text-xl">
              Where it is
            </h2>
            <p className="mt-2">{fullWhere}</p>
            <p className="text-sm text-slate">The full address is in your booking confirmation.</p>
            <StayMap
              className="mt-4 h-72"
              label={`Map showing where ${l.title} is`}
              zoom={14}
              points={[{ id: l.id, lat: l.lat, lng: l.lng, label: formatMoney({ amount: l.fromPrice, currency: l.currency }), title: l.title }]}
            />
          </section>

          <section aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="text-xl">
              Reviews
            </h2>
            {l.rating.count === 0 ? (
              <p className="mt-3 max-w-[70ch]">
                <span className="font-bold">New.</span> No reviews yet. Only guests who complete a stay booked here can leave one.
              </p>
            ) : (
              <>
                <p className="mt-3">
                  <span className="tnum text-2xl font-extrabold">{l.rating.avg.toFixed(1)}</span>
                  <span className="text-slate"> out of 5 from {plural(l.rating.count, "review")}</span>
                </p>
                <SubScores rating={l.rating} />
                <ul className="mt-6 border-t border-line">
                  {l.reviews.map((r) => (
                    <li key={r.id} className="border-b border-line py-5">
                      <p className="font-bold">
                        {r.authorName}
                        <span className="ml-2 font-normal text-slate">
                          <span className="tnum">{r.rating}</span> out of 5{r.stayMonth ? `, stayed ${monthName(r.stayMonth)}` : ""}
                        </span>
                      </p>
                      {r.body && <p className="mt-2 max-w-[70ch] whitespace-pre-line">{r.body}</p>}
                      {r.hostReply && (
                        <div className="mt-3 border-l-2 border-line pl-4 text-sm">
                          <p className="font-semibold">Reply from the host</p>
                          <p className="mt-1 whitespace-pre-line text-slate">{r.hostReply}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {l.rating.count > l.reviews.length && <p className="mt-3 text-sm text-slate">Showing the {l.reviews.length} most recent reviews.</p>}
              </>
            )}
          </section>

          <section aria-labelledby="host-title">
            <h2 id="host-title" className="text-xl">
              Hosted by {l.host.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">{l.host.verified && <Badge tone="good">Identity checked</Badge>}</div>
            {l.host.about && <p className="mt-2 max-w-[70ch] text-slate">{l.host.about}</p>}
            {l.host.languages.length > 0 && <p className="mt-2 text-sm">Speaks {l.host.languages.join(", ")}</p>}
            <p className="mt-2 text-sm text-slate">You get the host&apos;s phone number and email in your booking confirmation.</p>
          </section>
        </div>

        <aside aria-label="Book this place" className="lg:order-none">
          <div className="lg:sticky lg:top-20">
            {l.units.length ? (
              <Suspense fallback={<PanelFallback l={l} />}>
                <BookingPanel
                  listingId={l.id}
                  units={l.units.map((u) => ({ id: u.id, name: u.name, maxGuests: u.maxGuests, basePrice: u.basePrice, quantity: u.quantity }))}
                  currency={l.currency}
                  fromPrice={l.fromPrice}
                  minNights={l.minNights}
                  maxNights={l.maxNights}
                  cancellationPolicy={l.cancellationPolicy}
                  checkInTime={l.checkInFrom}
                  instantBook={l.instantBook}
                  bookPath={`${l.url}/book`}
                />
              </Suspense>
            ) : (
              <p className="rounded-md border border-line bg-surface p-5 text-sm">This place has no rooms open for booking right now.</p>
            )}
          </div>
        </aside>
      </div>

      <JsonLd
        data={[
          listingJsonLd(l),
          {
            "@context": "https://schema.org",
            ...breadcrumbLd([
              { name: "Home", path: "/" },
              { name: "Stays", path: "/stays" },
              { name: placeName, path: `/stays/${l.placeSlug}` },
              { name: l.title, path: l.url },
            ]),
          },
        ]}
      />
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="tnum font-bold">{value}</dd>
    </div>
  );
}

function SubScores({ rating }: { rating: ListingPage["rating"] }) {
  const items = [
    ["Cleanliness", rating.cleanliness],
    ["Accuracy", rating.accuracy],
    ["Location", rating.location],
    ["Value", rating.value],
  ].filter((i): i is [string, number] => i[1] !== null);
  if (!items.length) return null;
  return (
    <dl className="mt-4 grid max-w-md grid-cols-2 gap-x-8 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-line py-1">
          <dt>{k}</dt>
          <dd className="tnum font-bold">{v.toFixed(1)}</dd>
        </div>
      ))}
    </dl>
  );
}

function monthName(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function PanelFallback({ l }: { l: ListingPage }) {
  return (
    <div className="rounded-md border border-line bg-surface p-5 shadow-[var(--shadow-float)]">
      <p className="text-lg font-extrabold">
        <span className="tnum">{formatMoney({ amount: l.fromPrice, currency: l.currency })}</span> <span className="text-sm font-semibold text-slate">a night before taxes</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="col-span-2 h-12 w-full" />
      </div>
    </div>
  );
}
