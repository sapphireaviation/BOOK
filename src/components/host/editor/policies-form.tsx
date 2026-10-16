"use client";

import { savePolicies } from "@/app/host/actions";
import { cancellationPolicyText } from "@/lib/amenities";
import { ActionForm, CheckboxField, FormSection, MoneyField, SubmitButton, TextAreaField, TextField, useFieldError } from "../form";

export type PolicyValues = {
  cancellationPolicy: string;
  checkInFrom: string;
  checkOutUntil: string;
  houseRules: string;
  minNights: number;
  maxNights: number;
  instantBook: boolean;
  cleaningFee: string;
  taxPercent: string;
  contactPhone: string;
  contactEmail: string;
};

export function PoliciesForm({ listingId, currency, values }: { listingId: string; currency: string; values: PolicyValues }) {
  return (
    <ActionForm action={savePolicies.bind(null, listingId)} aria-label="Policies">
      <FormSection title="Cancellation" description="Shown to guests before they pay, word for word. The refund is worked out from this when a guest cancels.">
        <CancellationChoice defaultValue={values.cancellationPolicy} />
      </FormSection>

      <FormSection title="Arrival and stay length">
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <TextField name="checkInFrom" label="Check in from" type="time" defaultValue={values.checkInFrom} required />
          <TextField name="checkOutUntil" label="Check out by" type="time" defaultValue={values.checkOutUntil} required />
          <TextField name="minNights" label="Minimum nights" type="number" min={1} max={365} defaultValue={values.minNights} />
          <TextField name="maxNights" label="Maximum nights" type="number" min={1} max={365} defaultValue={values.maxNights} />
        </div>
        <CheckboxField
          name="instantBook"
          label="Guests can book instantly"
          defaultChecked={values.instantBook}
          hint="Approving bookings one by one is not available yet. Every paid booking is confirmed straight away, and turning this off only changes the label guests see."
        />
      </FormSection>

      <FormSection title="House rules" description="Quiet hours, smoking, parties, visitors, anything guests must agree to.">
        <TextAreaField name="houseRules" label="House rules" defaultValue={values.houseRules} rows={6} maxLength={4000} />
      </FormSection>

      <FormSection
        title="Fees and taxes"
        description="Both are added to the guest's total and paid to you in full. We never add a fee of our own."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField name="cleaningFee" label="Cleaning fee, once per stay" currency={currency} defaultValue={values.cleaningFee} hint="Leave empty for none." />
          <TextField
            name="taxPercent"
            label="Tax on the room total (%)"
            inputMode="decimal"
            defaultValue={values.taxPercent}
            hint="For example 12 for 12% GST. Leave empty if you do not charge tax."
            className="tnum"
          />
        </div>
      </FormSection>

      <FormSection title="Contact for guests" description="Shared with guests after they book, so they can reach you about arrival.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="contactPhone" label="Phone" type="tel" defaultValue={values.contactPhone} autoComplete="tel" maxLength={40} />
          <TextField name="contactEmail" label="Email" type="email" defaultValue={values.contactEmail} autoComplete="email" maxLength={200} />
        </div>
      </FormSection>

      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving policies">Save policies</SubmitButton>
      </div>
    </ActionForm>
  );
}

function CancellationChoice({ defaultValue }: { defaultValue: string }) {
  const error = useFieldError("cancellationPolicy");
  return (
    <fieldset aria-describedby={error ? "cancellation-error" : undefined}>
      <legend className="sr-only">Cancellation policy</legend>
      <div className="divide-y divide-line rounded-md border border-line bg-surface">
        {Object.entries(cancellationPolicyText).map(([value, p]) => (
          <label key={value} className="flex cursor-pointer gap-3 px-4 py-3 has-[:checked]:bg-sapphire-wash">
            <input type="radio" name="cancellationPolicy" value={value} defaultChecked={defaultValue === value} className="mt-1 size-4 shrink-0 accent-sapphire" />
            <span>
              <span className="block font-semibold">{p.label}</span>
              <span className="block text-sm text-slate">{p.summary}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id="cancellation-error" className="mt-1.5 text-xs font-semibold text-signal">
          {error}
        </p>
      )}
    </fieldset>
  );
}
