"use client";

import { useState } from "react";
import { cancelBookingAction } from "@/app/admin/actions";
import { Button } from "@/components/ui";
import { ActionForm, MoneyField, SubmitButton, TextAreaField, useFormState } from "@/components/host/form";

/**
 * Stays mounted after the booking is cancelled, so the result ("Booking cancelled. ₹16,400 refunded")
 * is still on screen once the page refreshes and the booking can no longer be cancelled.
 */
export function CancelBookingForm({
  bookingId,
  currency,
  totalLabel,
  cancellable,
  statusLabel,
}: {
  bookingId: string;
  currency: string;
  totalLabel: string;
  cancellable: boolean;
  statusLabel: string;
}) {
  const [open, setOpen] = useState(false);
  if (!cancellable && !open) return <p className="text-sm text-slate">A booking that is {statusLabel} cannot be cancelled.</p>;
  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Cancel and refund
      </Button>
    );
  }
  return (
    <ActionForm action={cancelBookingAction.bind(null, bookingId, currency)} aria-label="Cancel booking" className="space-y-4">
      {/* Once cancelled, only the result line below the form remains. */}
      {cancellable && (
        <>
          <TextAreaField name="reason" label="Reason" rows={3} maxLength={500} required hint="The guest sees this in the cancellation email." />
          <MoneyField name="refund" label="Refund amount" currency={currency} hint={`Leave empty to refund what the cancellation policy allows. The guest paid ${totalLabel}.`} />
          <Actions onClose={() => setOpen(false)} />
        </>
      )}
    </ActionForm>
  );
}

function Actions({ onClose }: { onClose: () => void }) {
  const { state } = useFormState();
  if (state.status === "ok") return null;
  return (
    <div className="flex flex-wrap gap-2">
      <SubmitButton variant="danger" pendingLabel="Cancelling booking">
        Cancel booking
      </SubmitButton>
      <Button type="button" variant="ghost" onClick={onClose}>
        Keep booking
      </Button>
    </div>
  );
}
