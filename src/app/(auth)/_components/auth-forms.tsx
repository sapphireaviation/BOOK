"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { authClient, signIn, signUp } from "@/lib/auth-client";
import { safeNext, withNext } from "./safe-next";

type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

/** Turns a Better Auth error into a sentence that says what to do next. */
function explain(error: AuthError, fallback = "Something went wrong on our side. Try again in a minute.") {
  if (!error) return fallback;
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password do not match. Check them, or sign in with an email link instead.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead, or reset your password.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "Use at most 128 characters for your password.";
    case "INVALID_EMAIL":
      return "Enter an email address like name@example.com.";
    case "INVALID_TOKEN":
      return "This reset link has expired or was already used. Ask for a new one.";
    case "INVALID_PASSWORD":
      return "Your current password is not right. Check it and try again.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "You sign in with an email link or Google, so there is no password to change yet.";
    default:
      return error.message && !/^[A-Z_]+$/.test(error.message) ? error.message : fallback;
  }
}

function useNext() {
  const params = useSearchParams();
  return { raw: params.get("next"), next: safeNext(params.get("next")) };
}

function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        pending={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/sign-in?error=google" });
          if (res?.error) {
            setError(explain(res.error, "Google sign in is not available right now. Use your email instead."));
            setPending(false);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        Continue with Google
      </Button>
      {error && (
        <p role="alert" className="text-xs font-semibold text-signal">
          {error}
        </p>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

const urlErrors: Record<string, string> = {
  google: "Google sign in did not finish. Try again, or use your email.",
  link: "That sign in link has expired or was already used. Ask for a new one below.",
  INVALID_TOKEN: "That sign in link has expired or was already used. Ask for a new one below.",
  EXPIRED_TOKEN: "That sign in link has expired. Ask for a new one below.",
};

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { raw, next } = useNext();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(urlErrors[params.get("error") ?? ""] ?? null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter an email address like name@example.com.";
    if (mode === "password" && !password) errs.password = "Enter your password.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    setError(null);
    if (mode === "link") {
      const res = await signIn.magicLink({ email: email.trim(), callbackURL: next, errorCallbackURL: "/sign-in?error=link" });
      setPending(false);
      if (res.error) return setError(explain(res.error));
      setSentTo(email.trim());
      return;
    }
    const res = await signIn.email({ email: email.trim(), password });
    if (res.error) {
      setPending(false);
      return setError(explain(res.error));
    }
    router.replace(next);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl">Check your email</h1>
        <p className="text-slate">
          We sent a sign in link to <strong className="text-ink">{sentTo}</strong>. It works for 5 minutes. You can close this tab.
        </p>
        <Button type="button" variant="ghost" className="-ml-3" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Sign in</h1>
        <p className="mt-1 text-sm text-slate">See your trips and the stays you saved.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" error={fieldErrors.email}>
          {(p) => <Input {...p} type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        {mode === "password" && (
          <Field label="Password" error={fieldErrors.password}>
            {(p) => (
              <Input {...p} type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            )}
          </Field>
        )}
        <Button type="submit" className="w-full" pending={pending}>
          {mode === "password" ? "Sign in" : "Email me a link"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === "password" ? "link" : "password");
            setFieldErrors({});
            setError(null);
          }}
        >
          {mode === "password" ? "Email me a sign in link instead" : "Use my password instead"}
        </button>
        {mode === "password" && (
          <Link href="/forgot-password" className="link">
            Forgot password
          </Link>
        )}
      </div>
      {googleEnabled && (
        <>
          <Divider />
          <GoogleButton next={next} />
        </>
      )}
      <p className="border-t border-line pt-5 text-sm text-slate">
        New here?{" "}
        <Link href={withNext("/sign-up", raw)} className="link">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const { raw, next } = useNext();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (form.name.trim().length < 2) errs.name = "Enter the name you travel under.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Enter an email address like name@example.com.";
    if (form.password.length < 8) errs.password = "Use at least 8 characters.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    setError(null);
    const res = await signUp.email({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    if (res.error) {
      setPending(false);
      return setError(explain(res.error));
    }
    router.replace(next);
    router.refresh();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Create an account</h1>
        <p className="mt-1 text-sm text-slate">Free for travelers and hosts. We never charge a platform fee.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Full name" hint="As on your ID, so airline tickets match." error={fieldErrors.name}>
          {(p) => <Input {...p} name="name" autoComplete="name" value={form.name} onChange={set("name")} required />}
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          {(p) => <Input {...p} type="email" name="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} required />}
        </Field>
        <Field label="Password" hint="At least 8 characters." error={fieldErrors.password}>
          {(p) => <Input {...p} type="password" name="password" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={8} />}
        </Field>
        <Button type="submit" className="w-full" pending={pending}>
          Create account
        </Button>
        <p className="text-xs text-slate">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="link">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="link">
            privacy notice
          </Link>
          .
        </p>
      </form>
      {googleEnabled && (
        <>
          <Divider />
          <GoogleButton next={next} />
        </>
      )}
      <p className="border-t border-line pt-5 text-sm text-slate">
        Already have an account?{" "}
        <Link href={withNext("/sign-in", raw)} className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFieldError("Enter an email address like name@example.com.");
    setFieldError(undefined);
    setPending(true);
    setError(null);
    const res = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setPending(false);
    if (res.error && res.error.status === 429) return setError(explain(res.error));
    // Same message whether or not the account exists, so this form cannot be used to find accounts.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl">Check your email</h1>
        <p className="text-slate">
          If an account uses <strong className="text-ink">{email.trim()}</strong>, we sent it a link to set a new password. The link works for one hour.
        </p>
        <Link href="/sign-in" className="link text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Reset your password</h1>
        <p className="mt-1 text-sm text-slate">Enter the email you signed up with. We will send you a link to set a new password.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" error={fieldError}>
          {(p) => <Input {...p} type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Button type="submit" className="w-full" pending={pending}>
          Send reset link
        </Button>
      </form>
      <p className="border-t border-line pt-5 text-sm text-slate">
        Remembered it?{" "}
        <Link href="/sign-in" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [done, setDone] = useState(false);

  if (!token || linkError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl">This link no longer works</h1>
        <p className="text-slate">Reset links work once and expire after one hour. Ask for a new one and use the latest email.</p>
        <Link href="/forgot-password" className="link text-sm">
          Send a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl">Password changed</h1>
        <p className="text-slate">Your new password is set. Other devices have been signed out.</p>
        <Link href="/sign-in" className="link text-sm">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    if (confirm !== password) errs.confirm = "The two passwords do not match.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (res.error) return setError(explain(res.error));
    setDone(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Set a new password</h1>
        <p className="mt-1 text-sm text-slate">Use at least 8 characters. A short sentence is easier to remember.</p>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="New password" error={fieldErrors.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />}
        </Field>
        <Field label="Type it again" error={fieldErrors.confirm}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}
        </Field>
        <Button type="submit" className="w-full" pending={pending}>
          Save new password
        </Button>
      </form>
    </div>
  );
}

export { explain as explainAuthError };
