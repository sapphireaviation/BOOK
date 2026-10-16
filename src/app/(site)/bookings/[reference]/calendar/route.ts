import { absoluteUrl, site } from "@/config/site";
import { bookingViewer } from "@/server/bookings/access";
import { buildIcs, type IcsEvent } from "@/server/bookings/ics";
import { getBookingDetailByReference } from "@/server/bookings/queries";
import type { Slice } from "@/server/flights/types";

/** Calendar file for a confirmed stay or flight: /bookings/<reference>/calendar?token=<token> */
export async function GET(request: Request, ctx: RouteContext<"/bookings/[reference]/calendar">) {
  const { reference } = await ctx.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!/^[A-Z0-9-]{3,16}$/i.test(reference)) return new Response("Not found", { status: 404 });

  const detail = await getBookingDetailByReference(reference);
  if (!detail || !(await bookingViewer(detail.booking, token))) return new Response("Not found", { status: 404 });
  const { booking } = detail;
  if (booking.status !== "confirmed" && booking.status !== "completed") return new Response("This booking is not confirmed.", { status: 409 });

  const url = absoluteUrl(`/bookings/${booking.reference}`);
  const uidHost = new URL(site.url).hostname;
  let events: IcsEvent[] = [];

  if (detail.stay) {
    const s = detail.stay;
    const l = s.listing;
    const location = [l.addressLine, l.locality, l.city, l.region, l.postalCode].filter(Boolean).join(", ");
    events = [
      {
        uid: `${booking.id}@${uidHost}`,
        title: `Stay at ${l.title}`,
        description: `Booking ${booking.reference}. ${s.unitName}. Check in from ${l.checkInFrom.slice(0, 5)}, check out by ${l.checkOutUntil.slice(0, 5)}. Host: ${s.host.name}${(l.contactPhone ?? s.host.phone) ? `, ${l.contactPhone ?? s.host.phone}` : ""}.`,
        location,
        url,
        start: { local: `${s.checkIn}T${l.checkInFrom.slice(0, 5)}` },
        end: { local: `${s.checkOut}T${l.checkOutUntil.slice(0, 5)}` },
      },
    ];
  } else if (detail.flight) {
    const f = detail.flight;
    events = (f.slices as Slice[]).flatMap((slice) =>
      slice.segments.map((seg) => ({
        uid: `${booking.id}-${seg.id}@${uidHost}`,
        title: `Flight ${seg.flightNumber}, ${seg.origin.iata} to ${seg.destination.iata}`,
        description: `Booking ${booking.reference}${f.airlineReference ? `. Airline reference ${f.airlineReference}` : ""}. ${seg.marketingCarrier.name}.`,
        location: `${seg.origin.name} (${seg.origin.iata})${seg.origin.terminal ? `, terminal ${seg.origin.terminal}` : ""}`,
        url,
        start: { local: seg.departAt.slice(0, 16), timeZone: seg.origin.timeZone },
        end: { local: seg.arriveAt.slice(0, 16), timeZone: seg.destination.timeZone },
      })),
    );
  }

  const body = buildIcs({ prodId: `-//${site.name}//Bookings//EN`, events });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
