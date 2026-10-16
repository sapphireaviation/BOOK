"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Button, Field, Input, Notice, Select, buttonClass } from "@/components/ui";
import type { BookingFormState } from "./booking-state";
import {
  ageRules,
  fieldName,
  kindLabels,
  titles,
  validateContact,
  validatePassenger,
  type FieldErrors,
  type PassengerFields,
  type PassengerKind,
} from "./passenger-rules";

type Props = {
  action: (state: BookingFormState, formData: FormData) => Promise<BookingFormState>;
  initialState: BookingFormState;
  passengers: { kind: PassengerKind }[];
  requiresPassport: boolean;
  travelDate: string;
  today: string;
  countries: { code: string; name: string }[];
  defaultContact?: { name?: string; email?: string };
  searchAgainHref: string;
  submitLabel: string;
};

function readPassenger(fd: FormData, i: number): PassengerFields {
  const get = (k: keyof PassengerFields) => String(fd.get(fieldName(i, k)) ?? "");
  return {
    title: get("title"),
    givenName: get("givenName"),
    familyName: get("familyName"),
    bornOn: get("bornOn"),
    gender: get("gender"),
    passportNumber: get("passportNumber"),
    passportCountry: get("passportCountry"),
    passportExpiry: get("passportExpiry"),
  };
}

/**
 * Traveler and contact details. Checks run in the browser for quick feedback and again in the
 * server action, which is the check that counts. The form also works without JavaScript.
 */
export function PassengerForm(props: Props) {
  const { passengers, requiresPassport, travelDate, today, countries } = props;
  const [state, formAction, pending] = useActionState(props.action, props.initialState);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = clientErrors ?? state.errors;
  const v = (name: string, fallback = "") => state.values[name] ?? fallback;

  useEffect(() => {
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [errors]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ctx = { travelDate, today, requiresPassport };
    const found: FieldErrors = {};
    passengers.forEach((p, i) => Object.assign(found, validatePassenger(i, p.kind, readPassenger(fd, i), ctx)));
    Object.assign(
      found,
      validateContact({ name: String(fd.get("contact_name") ?? ""), email: String(fd.get("contact_email") ?? ""), phone: String(fd.get("contact_phone") ?? "") }),
    );
    if (Object.keys(found).length) {
      setClientErrors(found);
      return;
    }
    setClientErrors(null);
    startTransition(() => formAction(fd));
  }

  if (state.expired) {
    return (
      <Notice tone="bad" title="This fare is no longer available">
        <p>{state.formError ?? "Airlines hold fares for a short time. Search again to see current fares."}</p>
        <Link href={props.searchAgainHref} className={buttonClass({ size: "sm", className: "mt-3" })}>
          Search again
        </Link>
      </Notice>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="space-y-8">
      {state.formError && (
        <Notice tone="bad" title="We could not start your booking">
          {state.formError}
        </Notice>
      )}
      {errorCount > 0 && !state.formError && (
        <p role="alert" className="text-sm font-semibold text-signal">
          {errorCount === 1 ? "One detail needs a fix." : `${errorCount} details need a fix.`} The fields are marked below.
        </p>
      )}

      <p className="max-w-prose text-sm text-slate">
        Enter names exactly as they appear on each traveler&apos;s {requiresPassport ? "passport" : "government ID"}. The airline checks them at the airport.
      </p>

      {passengers.map((p, i) => {
        const n = (k: keyof PassengerFields) => fieldName(i, k);
        return (
          <fieldset key={i} className="border-t border-line pt-5">
            <legend className="float-left mb-1 w-full">
              <span className="text-lg font-extrabold">
                Traveler {i + 1}, {kindLabels[p.kind].toLowerCase()}
              </span>
            </legend>
            <p className="clear-both mb-4 text-xs text-slate">{ageRules[p.kind]}</p>
            <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Title" error={errors[n("title")]}>
                {(f) => (
                  <Select {...f} name={n("title")} defaultValue={v(n("title"))} required>
                    <option value="">Choose</option>
                    {titles.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="First and middle names" error={errors[n("givenName")]}>
                {(f) => <Input {...f} name={n("givenName")} defaultValue={v(n("givenName"))} autoComplete={i === 0 ? "given-name" : "off"} required maxLength={20} />}
              </Field>
              <Field label="Last name" error={errors[n("familyName")]}>
                {(f) => <Input {...f} name={n("familyName")} defaultValue={v(n("familyName"))} autoComplete={i === 0 ? "family-name" : "off"} required maxLength={20} />}
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth" error={errors[n("bornOn")]}>
                {(f) => <Input {...f} type="date" name={n("bornOn")} defaultValue={v(n("bornOn"))} max={today} min="1900-01-01" required />}
              </Field>
              <Field label="Gender on the ID" error={errors[n("gender")]}>
                {(f) => (
                  <Select {...f} name={n("gender")} defaultValue={v(n("gender"))} required>
                    <option value="">Choose</option>
                    <option value="f">Female</option>
                    <option value="m">Male</option>
                  </Select>
                )}
              </Field>
            </div>
            {requiresPassport && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Passport number" error={errors[n("passportNumber")]}>
                  {(f) => <Input {...f} name={n("passportNumber")} defaultValue={v(n("passportNumber"))} autoComplete="off" autoCapitalize="characters" required />}
                </Field>
                <Field label="Issuing country" error={errors[n("passportCountry")]}>
                  {(f) => (
                    <Select {...f} name={n("passportCountry")} defaultValue={v(n("passportCountry"))} required>
                      <option value="">Choose</option>
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Passport expiry" hint="Many countries ask for 6 months of validity" error={errors[n("passportExpiry")]}>
                  {(f) => <Input {...f} type="date" name={n("passportExpiry")} defaultValue={v(n("passportExpiry"))} min={travelDate} required />}
                </Field>
              </div>
            )}
          </fieldset>
        );
      })}

      <fieldset className="border-t border-line pt-5">
        <legend className="float-left mb-1 w-full text-lg font-extrabold">Contact details</legend>
        <p className="clear-both mb-4 text-xs text-slate">We send the e-ticket here. The airline may use these details for schedule changes.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Full name" error={errors.contact_name}>
            {(f) => <Input {...f} name="contact_name" defaultValue={v("contact_name", props.defaultContact?.name ?? "")} autoComplete="name" required />}
          </Field>
          <Field label="Email" error={errors.contact_email}>
            {(f) => <Input {...f} type="email" name="contact_email" defaultValue={v("contact_email", props.defaultContact?.email ?? "")} autoComplete="email" required />}
          </Field>
          <Field label="Mobile number" hint="With country code, for example +91 98765 43210" error={errors.contact_phone}>
            {(f) => <Input {...f} type="tel" name="contact_phone" defaultValue={v("contact_phone")} autoComplete="tel" required />}
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
        <Button type="submit" size="lg" pending={pending}>
          {props.submitLabel}
        </Button>
        <p className="text-xs text-slate">We check the fare with the airline again before you pay.</p>
      </div>
    </form>
  );
}
