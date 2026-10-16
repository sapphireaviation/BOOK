import Image from "next/image";
import { Badge, cn } from "@/components/ui";
import { formatDate, formatDay, formatDuration } from "@/lib/dates";
import type { Passenger } from "@/db/schema";
import type { Slice } from "@/server/flights/types";
import type { BookingRow, FlightBookingRow, StayDetail } from "@/server/bookings/queries";

/** "Fri 24 Oct 2026" from a YYYY-MM-DD date. */
export function longDay(d: string) {
  return `${formatDay(d)} ${formatDate(d).slice(-4)}`;
}

/** Wall clock "06:15" from an airline local time string (no offset). */
function clock(local: string) {
  return local.slice(11, 16);
}

const STATUS: Record<BookingRow["status"], { label: string; tone: "neutral" | "good" | "bad" | "info" }> = {
  draft: { label: "Not paid", tone: "neutral" },
  pending_payment: { label: "Waiting for payment", tone: "info" },
  confirmed: { label: "Confirmed", tone: "good" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "bad" },
  refunded: { label: "Cancelled and refunded", tone: "bad" },
  expired: { label: "Hold ended", tone: "neutral" },
  failed: { label: "Not booked", tone: "bad" },
};

export function StatusBadge({ status, className }: { status: BookingRow["status"]; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-4 border-t border-line py-3 first:border-t-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function StaySummary({ stay, showHostContact, compact }: { stay: StayDetail; showHostContact: boolean; compact?: boolean }) {
  const l = stay.listing;
  const address = [l.addressLine, l.locality, l.city, l.region, l.postalCode].filter(Boolean).join(", ");
  const guests = `${stay.adults} ${stay.adults === 1 ? "adult" : "adults"}${stay.children ? `, ${stay.children} ${stay.children === 1 ? "child" : "children"}` : ""}`;
  const hostPhone = l.contactPhone ?? stay.host.phone;
  const hostEmail = l.contactEmail ?? stay.host.email;
  return (
    <div>
      <div className="flex gap-4">
        {stay.photo && (
          <Image src={stay.photo.url} alt={stay.photo.alt || l.title} width={160} height={112} className="hidden h-28 w-40 shrink-0 rounded-sm object-cover sm:block" />
        )}
        <div>
          <h2 className="text-xl">{l.title}</h2>
          <p className="mt-1 text-sm text-slate">
            {stay.unitName}
            {stay.units > 1 ? `, ${stay.units} rooms` : ""}
          </p>
          <p className="text-sm text-slate">{l.city}</p>
        </div>
      </div>
      <dl className="mt-5">
        <Row label="Check in">
          <span className="tnum">{longDay(stay.checkIn)}</span>, from <span className="tnum">{l.checkInFrom.slice(0, 5)}</span>
        </Row>
        <Row label="Check out">
          <span className="tnum">{longDay(stay.checkOut)}</span>, by <span className="tnum">{l.checkOutUntil.slice(0, 5)}</span>
        </Row>
        <Row label="Nights">
          <span className="tnum">{stay.nights}</span>
        </Row>
        <Row label="Guests">{guests}</Row>
        {!compact && address && <Row label="Address">{address}</Row>}
        {!compact && showHostContact && (
          <Row label="Host">
            <span className="block font-semibold">{stay.host.name}</span>
            {hostPhone && (
              <a className="link block" href={`tel:${hostPhone.replace(/[^+0-9]/g, "")}`}>
                {hostPhone}
              </a>
            )}
            <a className="link block break-all" href={`mailto:${hostEmail}`}>
              {hostEmail}
            </a>
          </Row>
        )}
        {!compact && stay.guestNote && <Row label="Your note">{stay.guestNote}</Row>}
        {!compact && l.houseRules && showHostContact && <Row label="House rules">{l.houseRules}</Row>}
      </dl>
    </div>
  );
}

export function FlightItinerary({ flight, compact }: { flight: FlightBookingRow; compact?: boolean }) {
  const slices = flight.slices as Slice[];
  return (
    <div className="space-y-6">
      {slices.map((slice, i) => (
        <section key={slice.id ?? i} aria-label={`${slice.origin.city || slice.origin.iata} to ${slice.destination.city || slice.destination.iata}`}>
          <h2 className="text-xl">
            {slice.origin.city || slice.origin.iata} to {slice.destination.city || slice.destination.iata}
          </h2>
          <p className="mt-1 text-sm text-slate">
            <span className="tnum">{formatDay(slice.departAt.slice(0, 10))}</span>, {slice.stops === 0 ? "nonstop" : `${slice.stops} ${slice.stops === 1 ? "stop" : "stops"}`},{" "}
            <span className="tnum">{formatDuration(slice.durationMinutes)}</span>
          </p>
          {!compact && (
            <ol className="mt-3">
              {slice.segments.map((seg) => (
                <li key={seg.id} className="grid grid-cols-[4rem_1fr] gap-3 border-t border-line py-3 text-sm first:border-t-0">
                  <div className="tnum font-bold">
                    <span className="block">{clock(seg.departAt)}</span>
                    <span className="block text-slate">{clock(seg.arriveAt)}</span>
                  </div>
                  <div>
                    <p>
                      {seg.origin.name} ({seg.origin.iata})
                      {seg.origin.terminal ? `, terminal ${seg.origin.terminal}` : ""}
                    </p>
                    <p>
                      {seg.destination.name} ({seg.destination.iata})
                      {seg.destination.terminal ? `, terminal ${seg.destination.terminal}` : ""}
                      {seg.arriveAt.slice(0, 10) !== seg.departAt.slice(0, 10) && <span className="text-slate">, arrives {formatDay(seg.arriveAt.slice(0, 10))}</span>}
                    </p>
                    <p className="mt-1 text-slate">
                      {seg.marketingCarrier.name} <span className="tnum">{seg.flightNumber}</span>
                      {seg.operatingCarrier.iata !== seg.marketingCarrier.iata ? `, operated by ${seg.operatingCarrier.name}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

export function PassengerList({ passengers }: { passengers: Passenger[] }) {
  const type = { adult: "Adult", child: "Child", infant_without_seat: "Infant on lap" } as const;
  return (
    <ul>
      {passengers.map((p, i) => (
        <li key={p.id ?? i} className={cn("flex justify-between gap-4 py-2 text-sm", i > 0 && "border-t border-line")}>
          <span className="font-semibold">
            {p.givenName} {p.familyName}
          </span>
          <span className="text-slate">{type[p.type]}</span>
        </li>
      ))}
    </ul>
  );
}
