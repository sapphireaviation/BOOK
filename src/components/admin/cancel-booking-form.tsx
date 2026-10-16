"use client";

import { useState } from "react";
import { cancelBookingAction } from "@/app/admin/actions";
import { Button } from "@/components/ui";
import { ActionForm, MoneyField, SubmitButton, TextAreaField, useFormState } from "@/components/host/form";

export function CancelBookingForm({ bookingId, currency, totalLabel }: { bookingId: string; currency: string; totalLabel: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Cancel and refund
      </Button>
    );
  }
  return (
    <ActionForm action={cancelBookingAction.bind(null, bookingId, currency)} aria-label="Cancel booking" className="space-y-4">
      <TextAreaField name="reason" label="Reason" rows={3} maxLength={500} required hint="The guest sees this in the cancellation email." />
      <MoneyField
        name="refund"
        label="Refund amount"
        currency={currency}
        hint={`Leave empty to refund what the cancellation policy allows. The guest paid ${totalLabel}.`}
      />
      <Actions onClose={() => setOpen(false)} />
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
