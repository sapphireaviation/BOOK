/** State returned by the flight booking server action to the passenger form. */
export type BookingFormState = {
  errors: Record<string, string>;
  formError?: string;
  /** The fare is gone; the form offers a link back to search instead of a retry. */
  expired?: boolean;
  /** Submitted values, so the form keeps what the traveler typed after an error. */
  values: Record<string, string>;
};

export const initialBookingState: BookingFormState = { errors: {}, values: {} };
