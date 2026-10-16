"use client";

import { useActionState } from "react";
import { bookStayAction, type BookingFormState } from "@/app/(site)/stays/actions";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";

type Hidden = { listingId: string; unitId: string; checkIn: string; checkOut: string; adults: number; children: number; units: number };

/** Guest contact details. The action re-prices the stay on the server and sends the guest to pay. */
export function BookForm({ hidden, defaults, payLabel }: { hidden: Hidden; defaults: { name: string; email: string; phone: string }; payLabel: string }) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(bookStayAction, {});
  const v = state.values ?? { ...defaults, note: "" };
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={String(val)} />
      ))}
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <Field label="Full name" hint="The name of the person checking in." error={e.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" required defaultValue={v.name} key={`name-${v.name}`} />}
      </Field>
      <Field label="Email" hint="We send the confirmation here." error={e.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required defaultValue={v.email} key={`email-${v.email}`} />}
      </Field>
      <Field label="Phone (optional)" hint="With the country code. The owner may call about arrival." error={e.phone}>
        {(p) => <Input {...p} name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} key={`phone-${v.phone}`} />}
      </Field>
      <Field label="Note for the owner (optional)" hint="Arrival time, dietary needs or anything else they should know." error={e.note}>
        {(p) => <Textarea {...p} name="note" maxLength={1000} defaultValue={v.note} key={`note-${v.note}`} />}
      </Field>
      <Button type="submit" size="lg" pending={pending} className="w-full sm:w-auto">
        {payLabel}
      </Button>
      <p className="text-sm text-slate">You pay on the next page. The total is checked again before payment, and nothing is charged until you confirm there.</p>
    </form>
  );
}
