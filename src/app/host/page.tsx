import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, EmptyState, Price, PriceBreakdown } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { StartHostingForm } from "@/components/host/start-hosting";
import { StatusBadge, Table, Td, Th } from "@/components/host/table";
import { addDays, formatDay, toISODate } from "@/lib/dates";
import { getViewer, actorOf, type Viewer } from "@/server/host/access";
import { amountOwed, listArrivals, listRecentBookings } from "@/server/host/bookings";
import { listHostListings } from "@/server/host/listings";
import { payoutTotals } from "@/server/host/payouts";
import { site } from "@/config/site";

export const instant = false;

export const metadata: Metadata = { title: "Hosting" };

export default async function HostHome() {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "host" && viewer.role !== "admin")) return <Landing signedIn={Boolean(viewer)} />;
  return <Dashboard viewer={viewer} />;
}

function Landing({ signedIn }: { signedIn: boolean }) {
  const currency = site.defaultCurrency;
  const nightly = currency === "INR" ? 450000 : 12000;
  const cleaning = currency === "INR" ? 50000 : 2500;
  return (
    <div className="max-w-5xl">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <h1 className="text-3xl md:text-4xl">List your place and keep the whole price</h1>
          <p className="mt-4 max-w-prose text-lg text-slate">
            You set the nightly price. Guests pay that price, plus the cleaning fee and taxes you choose to add. We take no commission from you and add no booking fee for guests, so
            the full amount of every stay goes to you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {signedIn ? (
              <StartHostingForm />
            ) : (
              <>
                <ButtonLink href="/sign-in?next=/host" size="lg">
                  Start listing
                </ButtonLink>
                <p className="text-sm text-slate">You will sign in or create an account first.</p>
              </>
            )}
          </div>

          <h2 className="mt-14 text-xl">How it works</h2>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {[
              ["Describe your place", "Add a title, the address with a pin on the map, at least three photos and the amenities guests can count on."],
              ["Set rooms and prices", "List each room type, or the whole home, with a nightly price. Change the price for busy dates or close dates you need for yourself."],
              ["Choose your rules", "Pick a cancellation policy, check in and check out times, house rules and whether guests can book without asking."],
              ["Publish and get paid", "Your listing goes live once the checklist is complete. Guests pay when they book, and we send you the full amount after they check in."],
            ].map(([title, body], i) => (
              <li key={title} className="grid gap-1 py-4 sm:grid-cols-[2rem_12rem_1fr] sm:gap-4">
                <span className="tnum font-bold text-slate">{i + 1}</span>
                <span className="font-semibold">{title}</span>
                <span className="text-slate">{body}</span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="self-start rounded-md border border-line bg-surface p-5">
          <h2 className="text-base">Example: 3 nights</h2>
          <p className="mt-1 text-sm text-slate">What the guest pays, line by line.</p>
          <PriceBreakdown
            className="mt-4"
            currency={currency}
            lines={[
              { label: "3 nights at your price", amount: nightly * 3, kind: "base" },
              { label: "Your cleaning fee", amount: cleaning, kind: "other" },
            ]}
            total={nightly * 3 + cleaning}
          />
          <div className="mt-4 flex justify-between gap-4 border-t border-line pt-3 text-sm">
            <span className="font-semibold">You receive</span>
            <Price className="font-bold" money={{ amount: nightly * 3 + cleaning, currency }} />
          </div>
        </aside>
      </div>
    </div>
  );
}

async function Dashboard({ viewer }: { viewer: Viewer }) {
  const actor = actorOf(viewer);
  const today = toISODate(new Date());
  const until = addDays(today, 14);
  const [arrivals, recent, listings, payouts] = await Promise.all([listArrivals(actor, today, until), listRecentBookings(actor), listHostListings(actor), payoutTotals(actor.userId)]);
  const owed = [...(payouts.owed ?? []), ...(payouts.scheduled ?? [])].reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.currency]: (acc[p.currency] ?? 0) + p.amount }), {});
  const paid = payouts.paid ?? [];

  if (!listings.length && !recent.length) {
    return (
      <>
        <PageHeader title={`Welcome, ${viewer.name.split(" ")[0] || "host"}`} />
        <EmptyState title="You have no listings yet" action={<ButtonLink href="/host/listings/new">Add your first listing</ButtonLink>}>
          Start with a name and the type of place. You can save as you go and publish when the checklist is complete.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" actions={<ButtonLink href="/host/listings/new" size="sm">Add listing</ButtonLink>} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="arrivals">
            <h2 id="arrivals" className="mb-3 text-lg">
              Arrivals in the next 14 days
            </h2>
            {arrivals.length ? (
              <Table caption="Arrivals in the next 14 days">
                <thead>
                  <tr>
                    <Th>Check in</Th>
                    <Th>Guest</Th>
                    <Th>Listing and room</Th>
                    <Th numeric>Nights</Th>
                    <Th numeric>Guests</Th>
                    <Th numeric>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {arrivals.map((b) => (
                    <tr key={b.id}>
                      <Td className="whitespace-nowrap font-semibold">{formatDay(b.checkIn)}</Td>
                      <Td>
                        <Link href={`/host/bookings/${b.id}`} className="link">
                          {b.guestName}
                        </Link>
                      </Td>
                      <Td>
                        {b.listingTitle}
                        <span className="block text-xs text-slate">{b.unitName}</span>
                      </Td>
                      <Td numeric>{b.nights}</Td>
                      <Td numeric>{b.adults + b.children}</Td>
                      <Td numeric>
                        <Price money={{ amount: amountOwed(b), currency: b.currency }} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-slate">No guests arrive in the next 14 days.</p>
            )}
          </section>

          <section aria-labelledby="recent">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="recent" className="text-lg">
                Recent bookings
              </h2>
              <Link href="/host/bookings" className="link text-sm">
                All bookings
              </Link>
            </div>
            {recent.length ? (
              <Table caption="Recent bookings">
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Guest</Th>
                    <Th>Dates</Th>
                    <Th>Status</Th>
                    <Th numeric>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((b) => (
                    <tr key={b.id}>
                      <Td>
                        <Link href={`/host/bookings/${b.id}`} className="link font-semibold">
                          {b.reference}
                        </Link>
                      </Td>
                      <Td>{b.guestName}</Td>
                      <Td className="whitespace-nowrap">
                        {formatDay(b.checkIn)} to {formatDay(b.checkOut)}
                      </Td>
                      <Td>
                        <StatusBadge status={b.status} />
                      </Td>
                      <Td numeric>
                        <Price money={{ amount: amountOwed(b), currency: b.currency }} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-slate">No bookings yet. They appear here as soon as a guest pays.</p>
            )}
          </section>

          <section aria-labelledby="listing-status">
            <h2 id="listing-status" className="mb-3 text-lg">
              Listing status
            </h2>
            <Table caption="Listing status">
              <thead>
                <tr>
                  <Th>Listing</Th>
                  <Th>Status</Th>
                  <Th>Still to do</Th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => {
                  const todo = l.checklist.filter((c) => !c.done);
                  return (
                    <tr key={l.id}>
                      <Td>
                        <Link href={`/host/listings/${l.id}`} className="link font-semibold">
                          {l.title}
                        </Link>
                      </Td>
                      <Td>
                        <StatusBadge status={l.status} />
                      </Td>
                      <Td>
                        {todo.length ? (
                          <ul className="space-y-0.5">
                            {todo.map((c) => (
                              <li key={c.key}>
                                <Link href={c.href} className="link">
                                  {c.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : l.status === "published" ? (
                          <span className="text-fern">Live and complete</span>
                        ) : l.status === "suspended" ? (
                          <span className="text-signal">Suspended by our team. Write to {site.supportEmail}.</span>
                        ) : (
                          <Link href={`/host/listings/${l.id}/publish`} className="link">
                            Ready to publish
                          </Link>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </section>
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="owed" className="rounded-md border border-line bg-surface">
            <h2 id="owed" className="border-b border-line px-4 py-3 text-base">
              Payouts owed to you
            </h2>
            {Object.keys(owed).length ? (
              <dl className="divide-y divide-line">
                {Object.entries(owed).map(([currency, amount]) => (
                  <div key={currency} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-slate">{currency}</dt>
                    <dd>
                      <Price className="font-bold" money={{ amount, currency }} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-3 text-sm text-slate">Nothing owed right now.</p>
            )}
            {paid.length > 0 && (
              <p className="border-t border-line px-4 py-2.5 text-xs text-slate">
                Paid so far:{" "}
                {paid.map((p, i) => (
                  <span key={p.currency}>
                    {i > 0 && ", "}
                    <Price money={{ amount: p.amount, currency: p.currency }} />
                  </span>
                ))}
              </p>
            )}
            <div className="border-t border-line px-4 py-2.5">
              <Link href="/host/payouts" className="link text-sm">
                Payout history
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
