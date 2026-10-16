import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, flightBookings, listingPhotos, listingUnits, listings, payments, refunds, stayBookings, user } from "@/db/schema";
import type { Executor } from "./transitions";

export type BookingRow = typeof bookings.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type RefundRow = typeof refunds.$inferSelect;
export type FlightBookingRow = typeof flightBookings.$inferSelect;

export type StayDetail = typeof stayBookings.$inferSelect & {
  listing: {
    id: string;
    title: string;
    slug: string;
    destinationSlug: string | null;
    propertyType: string;
    addressLine: string | null;
    locality: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    countryCode: string;
    lat: number;
    lng: number;
    checkInFrom: string;
    checkOutUntil: string;
    houseRules: string;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  unitName: string;
  photo: { url: string; alt: string } | null;
  host: { id: string; name: string; email: string; phone: string | null };
};

export type BookingDetail = {
  booking: BookingRow;
  stay: StayDetail | null;
  flight: FlightBookingRow | null;
  payments: PaymentRow[];
  refunds: RefundRow[];
};

async function loadDetail(where: ReturnType<typeof eq>, exec: Executor = db): Promise<BookingDetail | null> {
  const [booking] = await exec.select().from(bookings).where(where).limit(1);
  if (!booking) return null;

  let stay: StayDetail | null = null;
  let flight: FlightBookingRow | null = null;

  if (booking.kind === "stay") {
    const [row] = await exec
      .select({
        stay: stayBookings,
        listing: {
          id: listings.id,
          title: listings.title,
          slug: listings.slug,
          destinationSlug: listings.destinationSlug,
          propertyType: listings.propertyType,
          addressLine: listings.addressLine,
          locality: listings.locality,
          city: listings.city,
          region: listings.region,
          postalCode: listings.postalCode,
          countryCode: listings.countryCode,
          lat: listings.lat,
          lng: listings.lng,
          checkInFrom: listings.checkInFrom,
          checkOutUntil: listings.checkOutUntil,
          houseRules: listings.houseRules,
          contactPhone: listings.contactPhone,
          contactEmail: listings.contactEmail,
        },
        unitName: listingUnits.name,
        host: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      })
      .from(stayBookings)
      .innerJoin(listings, eq(listings.id, stayBookings.listingId))
      .innerJoin(listingUnits, eq(listingUnits.id, stayBookings.unitId))
      .innerJoin(user, eq(user.id, stayBookings.hostId))
      .where(eq(stayBookings.bookingId, booking.id))
      .limit(1);
    if (row) {
      const [photo] = await exec
        .select({ url: listingPhotos.url, alt: listingPhotos.alt })
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, row.listing.id))
        .orderBy(listingPhotos.position)
        .limit(1);
      stay = { ...row.stay, listing: row.listing, unitName: row.unitName, host: row.host, photo: photo ?? null };
    }
  } else {
    [flight] = await exec.select().from(flightBookings).where(eq(flightBookings.bookingId, booking.id)).limit(1);
  }

  const paymentRows = await exec.select().from(payments).where(eq(payments.bookingId, booking.id)).orderBy(desc(payments.createdAt));
  const refundRows = await exec.select().from(refunds).where(eq(refunds.bookingId, booking.id)).orderBy(desc(refunds.createdAt));
  return { booking, stay, flight: flight ?? null, payments: paymentRows, refunds: refundRows };
}

export function getBookingDetailById(id: string, exec?: Executor) {
  return loadDetail(eq(bookings.id, id), exec);
}

export function getBookingDetailByReference(reference: string, exec?: Executor) {
  return loadDetail(eq(bookings.reference, reference.toUpperCase()), exec);
}

/** The payment that actually took the money, if any. */
export function capturedPayment(detail: Pick<BookingDetail, "payments">) {
  return detail.payments.find((p) => p.status === "captured" || p.status === "partially_refunded" || p.status === "refunded") ?? null;
}

export type TripSummary = {
  id: string;
  reference: string;
  kind: "stay" | "flight";
  status: BookingRow["status"];
  total: number;
  currency: string;
  createdAt: Date;
  title: string;
  subtitle: string;
  /** ISO date or timestamp the trip starts and ends, used to split upcoming and past. */
  startsOn: string;
  endsOn: string;
};

/** A signed in traveler's bookings, newest first. Checkouts whose hold ended unpaid are left out. */
export async function listTripsForUser(userId: string): Promise<TripSummary[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, userId), inArray(bookings.status, ["pending_payment", "confirmed", "completed", "cancelled", "refunded", "failed"])))
    .orderBy(desc(bookings.createdAt))
    .limit(200);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);

  const stays = await db
    .select({ bookingId: stayBookings.bookingId, checkIn: stayBookings.checkIn, checkOut: stayBookings.checkOut, title: listings.title, city: listings.city, unitName: listingUnits.name })
    .from(stayBookings)
    .innerJoin(listings, eq(listings.id, stayBookings.listingId))
    .innerJoin(listingUnits, eq(listingUnits.id, stayBookings.unitId))
    .where(inArray(stayBookings.bookingId, ids));
  const flights = await db.select().from(flightBookings).where(inArray(flightBookings.bookingId, ids));
  const stayById = new Map(stays.map((s) => [s.bookingId, s]));
  const flightById = new Map(flights.map((f) => [f.bookingId, f]));

  const out: TripSummary[] = [];
  const now = Date.now();
  for (const b of rows) {
    // An unpaid booking whose hold has ended is just an abandoned checkout.
    if (b.status === "pending_payment" && (!b.expiresAt || b.expiresAt.getTime() <= now)) continue;
    const base = { id: b.id, reference: b.reference, kind: b.kind, status: b.status, total: b.total, currency: b.currency, createdAt: b.createdAt };
    const s = stayById.get(b.id);
    if (s) {
      out.push({ ...base, title: s.title, subtitle: `${s.unitName}, ${s.city}`, startsOn: s.checkIn, endsOn: s.checkOut });
      continue;
    }
    const f = flightById.get(b.id);
    if (f) {
      const end = f.returnAt ?? f.departAt;
      out.push({
        ...base,
        title: `${f.origin} to ${f.destination}`,
        subtitle: f.returnAt ? "Return" : "One way",
        startsOn: f.departAt.toISOString(),
        endsOn: end.toISOString(),
      });
    }
  }
  return out;
}
