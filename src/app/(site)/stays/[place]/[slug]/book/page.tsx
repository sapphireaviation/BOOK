import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookForm } from "@/components/stays/book-form";
import { dayLabel, plural } from "@/components/stays/format";
import { SampleBadge } from "@/components/stays/stay-row";
import { ButtonLink, Notice, PriceBreakdown, Skeleton } from "@/components/ui";
import { isISODate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSession } from "@/server/auth";
import { quoteStay } from "@/server/stays/inventory";
import { getListingPage } from "@/server/stays/listing";
import { explainPolicy } from "@/server/stays/policy";

type Props = PageProps<"/stays/[place]/[slug]/book">;

export const metadata: Metadata = {
  title: "Your booking details",
  description: "Check the dates, guests and total for your stay, then add the contact details of the person checking in before you pay. There is no platform fee.",
  robots: { index: false, follow: false },
};

export default function BookPage(props: Props) {
  return (
    <div className="container-page py-8">
      <Suspense fallback={<BookSkeleton />}>
        <BookContent {...props} />
      </Suspense>
    </div>
  );
}

function BookSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-9 w-1/2" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

function int(v: string | string[] | undefined, min: number, max: number, dflt: number) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
}

function str(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

async function BookContent({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const l = await getListingPage(slug);
  if (!l) notFound();

  const unitId = str(sp.unit) || l.units[0]?.id || "";
  const unit = l.units.find((u) => u.id === unitId);
  const checkIn = str(sp.checkin);
  const checkOut = str(sp.checkout);
  const adults = int(sp.adults, 1, 16, 2);
  const children = int(sp.children, 0, 10, 0);
  const units = int(sp.units, 1, 8, 1);
  const back = `${l.url}?${new URLSearchParams({ checkin: checkIn, checkout: checkOut, adults: String(adults), children: String(children), units: String(units), unit: unitId })}`;

  if (!unit || !isISODate(checkIn) || !isISODate(checkOut)) {
    return (
      <Notice tone="info" title="Choose your dates first">
        <p>Pick dates and guests on the listing page, then select Reserve.</p>
        <p className="mt-2">
          <Link href={l.url} className="link">
            Back to {l.title}
          </Link>
        </p>
      </Notice>
    );
  }

  const [quote, session] = await Promise.all([
    quoteStay({ listingId: l.id, unitId, checkIn, checkOut, adults, children, units }),
    getSession().catch(() => null),
  ]);
  const policy = explainPolicy(l.cancellationPolicy, checkIn, l.checkInFrom);
  const user = session?.user as { name?: string; email?: string; phone?: string | null } | undefined;
  const photo = l.photos[0];

  return (
    <>
      <p className="text-sm">
        <Link href={back} className="link">
          Back to the listing
        </Link>
      </p>
      <h1 className="mt-3 text-2xl lg:text-3xl">Your booking details</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="contact-title" className="order-2 lg:order-1">
          <h2 id="contact-title" className="text-xl">
            Who is checking in
          </h2>
          {!session && (
            <p className="mt-2 text-sm text-slate">
              <Link href={`/sign-in?next=${encodeURIComponent(`${l.url}/book?${new URLSearchParams({ unit: unitId, checkin: checkIn, checkout: checkOut, adults: String(adults), children: String(children), units: String(units) })}`)}`} className="link">
                Sign in
              </Link>{" "}
              to keep this booking in your trips, or continue as a guest.
            </p>
          )}
          <div className="mt-5 max-w-xl">
            {quote.available ? (
              <BookForm
                hidden={{ listingId: l.id, unitId, checkIn, checkOut, adults, children, units }}
                defaults={{ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }}
                payLabel={`Continue to pay ${formatMoney({ amount: quote.total, currency: quote.currency })}`}
              />
            ) : (
              <Notice tone="bad" title="This stay cannot be booked as chosen">
                <p>{quote.reason}</p>
                <p className="mt-3">
                  <ButtonLink href={back} variant="secondary" size="sm">
                    Change dates or guests
                  </ButtonLink>
                </p>
              </Notice>
            )}
          </div>
        </section>

        <aside aria-labelledby="summary-title" className="order-1 lg:order-2">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 id="summary-title" className="sr-only">
              Summary
            </h2>
            <div className="flex gap-4">
              {photo && (
                <div className="relative h-16 w-20 shrink-0 sm:h-20 sm:w-28 overflow-hidden rounded-sm bg-mist">
                  <Image src={photo.url} alt="" fill sizes="112px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold leading-snug">{l.title}</p>
                <p className="text-sm text-slate">{unit.name}</p>
                {l.isDemo && <div className="mt-1"><SampleBadge /></div>}
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-slate">Check in</dt>
                <dd className="font-semibold">
                  {dayLabel(checkIn)}, from {l.checkInFrom}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Check out</dt>
                <dd className="font-semibold">
                  {dayLabel(checkOut)}, by {l.checkOutUntil}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Guests</dt>
                <dd className="font-semibold">
                  {plural(adults, "adult")}
                  {children ? `, ${plural(children, "child", "children")}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Rooms</dt>
                <dd className="font-semibold">{units}</dd>
              </div>
            </dl>
            {quote.available && <PriceBreakdown lines={quote.lines} currency={quote.currency} total={quote.total} className="mt-5 border-t border-line pt-4" />}
            <div className="mt-5 border-t border-line pt-4 text-sm">
              <p className="font-semibold">Cancellation: {policy.label.toLowerCase()}</p>
              <ul className="mt-1 space-y-1 text-slate">
                {policy.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
