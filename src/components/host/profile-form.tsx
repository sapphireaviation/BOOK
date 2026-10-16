"use client";

import { saveProfile } from "@/app/host/actions";
import { ActionForm, FormSection, SubmitButton, TextAreaField, TextField } from "./form";

export type ProfileValues = {
  displayName: string;
  about: string;
  languages: string;
  payoutMethod: string;
  payoutReference: string;
  taxId: string;
};

export function ProfileForm({ values }: { values: ProfileValues }) {
  return (
    <ActionForm action={saveProfile} aria-label="Host profile">
      <FormSection title="What guests see" description="Shown on your listings next to your name.">
        <TextField name="displayName" label="Display name" defaultValue={values.displayName} required maxLength={80} hint="Your first name, or the name of your guesthouse." />
        <TextAreaField name="about" label="About you" defaultValue={values.about} rows={5} maxLength={2000} hint="A few lines about who will welcome guests." />
        <TextField name="languages" label="Languages you speak" defaultValue={values.languages} maxLength={300} hint="Separate with commas, for example English, Hindi, Konkani." />
      </FormSection>
      <FormSection title="Payouts" description="Only our payouts team sees this. We send each payout here and record the transfer reference.">
        <TextField name="payoutMethod" label="Payout method" defaultValue={values.payoutMethod} maxLength={60} list="payout-methods" hint="For example Bank transfer or UPI." />
        <datalist id="payout-methods">
          <option value="Bank transfer" />
          <option value="UPI" />
          <option value="PayPal" />
          <option value="Wise" />
        </datalist>
        <TextAreaField
          name="payoutReference"
          label="Payout details"
          defaultValue={values.payoutReference}
          rows={3}
          maxLength={200}
          hint="Account name, number and IFSC, or your UPI ID. Do not enter card numbers or passwords."
        />
        <TextField name="taxId" label="Tax ID" defaultValue={values.taxId} maxLength={40} hint="GSTIN or PAN in India, or the tax number where you are registered. Optional." />
      </FormSection>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving profile">Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
