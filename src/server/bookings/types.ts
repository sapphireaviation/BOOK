import type { PassengerInput } from "@/server/flights/types";

export type Contact = { name: string; email: string; phone?: string };

export type CreateStayBookingInput = {
  userId: string | null;
  contact: Contact;
  listingId: string;
  unitId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  units: number;
  guestNote?: string;
};

export type CreateFlightBookingInput = {
  userId: string | null;
  contact: Contact;
  offerId: string;
  passengers: PassengerInput[];
};

export type CreatedBooking = { bookingId: string; reference: string; accessToken: string; payUrl: string };

export class BookingError extends Error {
  constructor(
    public readonly code: "unavailable" | "price_changed" | "offer_expired" | "invalid" | "not_found" | "forbidden" | "not_configured",
    message: string,
  ) {
    super(message);
  }
}
