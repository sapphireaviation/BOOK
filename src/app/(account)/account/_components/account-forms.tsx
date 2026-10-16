"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { explainAuthError } from "../../../(auth)/_components/auth-forms";
import { deleteAccount, updateProfile, type ActionState } from "../actions";

const initial: ActionState = { ok: false, message: null };

export function ProfileForm({ name, phone, email }: { name: string; phone: string | null; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  return (
    <form action={action} noValidate className="space-y-4">
      {state.message && <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>}
      <Field label="Full name" hint="As on your ID, so airline tickets match." error={state.fieldErrors?.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" defaultValue={state.values?.name ?? name} required />}
      </Field>
      <Field label="Email" hint="Write to support to change the email on your account.">
        {(p) => <Input {...p} type="email" value={email} readOnly disabled />}
      </Field>
      <Field label="Phone" hint="Hosts and airlines use it if your plans change. Include the country code." error={state.fieldErrors?.phone}>
        {(p) => <Input {...p} name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={state.values?.phone ?? phone ?? ""} placeholder="+91 98765 43210" />}
      </Field>
      <Button type="submit" pending={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string }>({});

  if (!hasPassword) {
    return (
      <p className="text-sm text-slate">
        You sign in with an email link or Google, so your account has no password. To add one,{" "}
        <Link href="/forgot-password" className="link">
          send yourself a reset link
        </Link>
        .
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!current) errs.current = "Enter your current password.";
    if (next.length < 8) errs.next = "Use at least 8 characters.";
    else if (next === current) errs.next = "Choose a password different from the current one.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    setMessage(null);
    const res = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (res.error) return setMessage({ ok: false, text: explainAuthError(res.error) });
    setCurrent("");
    setNext("");
    setMessage({ ok: true, text: "Password changed. Other devices have been signed out." });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {message && <Notice tone={message.ok ? "good" : "bad"}>{message.text}</Notice>}
      <Field label="Current password" error={fieldErrors.current}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
      </Field>
      <Field label="New password" hint="At least 8 characters." error={fieldErrors.next}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Button type="submit" variant="secondary" pending={pending}>
        Change password
      </Button>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-4 rounded-md border border-signal/40 bg-signal-wash p-4">
      <p className="text-sm">
        This signs you out everywhere and removes your name, email, phone, saved stays and sign in methods. Past bookings stay in our records without
        your details, because we must keep them for accounting. This cannot be undone.
      </p>
      {state.message && <Notice tone="bad">{state.message}</Notice>}
      <Field label={`Type ${email} to confirm`} error={state.fieldErrors?.confirm}>
        {(p) => <Input {...p} name="confirm" type="email" autoComplete="off" spellCheck={false} />}
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" pending={pending}>
          Delete account
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
