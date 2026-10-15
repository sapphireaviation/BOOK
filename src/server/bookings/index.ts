import "server-only";
import type { CreatedBooking, CreateFlightBookingInput, CreateStayBookingInput } from "./types";

/**
 * CONTRACT (owned by the bookings and payments workstream).
 *
 * createStayBooking: re-quotes on the server, holds inventory and inserts bookings + stay_bookings
 * in one transaction with status "pending_payment" and a 20 minute expiry. Returns the pay URL
 * (/checkout/<bookingId>?token=<accessToken>). Throws BookingError.
 */
export async function createStayBooking(input: CreateStayBookingInput): Promise<CreatedBooking> {
  void input;
  throw new Error("createStayBooking not implemented");
}

/**
 * CONTRACT. Re-fetches the offer from the provider for a fresh price, inserts bookings + flight_bookings
 * with status "pending_payment". The airline order is created only after payment is captured.
 */
export async function createFlightBooking(input: CreateFlightBookingInput): Promise<CreatedBooking> {
  void input;
  throw new Error("createFlightBooking not implemented");
}
