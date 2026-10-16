"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent } from "react";
import { Button, Checkbox, cn, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { idleState, type ActionState } from "./action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormContext = createContext<{ state: ActionState; pending: boolean }>({ state: idleState, pending: false });

/**
 * A form wired to a server action through useActionState.
 * Submits inside a transition so typed values stay in place after saving (React resets
 * forms after a plain form action), and still posts natively before hydration.
 */
export function ActionForm({
  action,
  children,
  className,
  id,
  showStatus = true,
  resetOnSuccess = false,
  "aria-label": ariaLabel,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  id?: string;
  showStatus?: boolean;
  /** Clear the inputs after a successful save, for "add another" forms. */
  resetOnSuccess?: boolean;
  "aria-label"?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.status === "ok") formRef.current?.reset();
  }, [resetOnSuccess, state.status, state.at]);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(data));
  }
  return (
    <FormContext value={{ state, pending }}>
      <form ref={formRef} id={id} action={dispatch} onSubmit={onSubmit} className={className} aria-label={ariaLabel} noValidate>
        {children}
        {showStatus && <FormStatus />}
      </form>
    </FormContext>
  );
}

export function useFormState() {
  return useContext(FormContext);
}

export function useFieldError(name: string) {
  return useContext(FormContext).state.fields?.[name];
}

/** The action's result: a success line that repeats the verb, or what went wrong. */
export function FormStatus({ className }: { className?: string }) {
  const { state } = useFormState();
  return (
    <div aria-live="polite" className={className}>
      {state.status === "ok" && state.message && (
        <p key={state.at} className="mt-3 flex items-center gap-2 text-sm font-semibold text-fern">
          <CheckMark />
          {state.message}
        </p>
      )}
      {state.status === "error" && state.message && (
        <Notice key={state.at} tone="bad" className="mt-3">
          {state.message}
        </Notice>
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size = "md",
  name,
  value,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  name?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormState();
  return (
    <Button type="submit" variant={variant} size={size} name={name} value={value} pending={pending} disabled={disabled} className={className}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

type Common = { name: string; label: string; hint?: string; className?: string; required?: boolean };

export function TextField({
  name,
  label,
  hint,
  className,
  required,
  defaultValue,
  type = "text",
  ...rest
}: Common & { defaultValue?: string | number | null; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "name" | "type">) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => <Input {...p} {...rest} name={name} type={type} required={required} defaultValue={defaultValue ?? ""} />}
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  className,
  required,
  defaultValue,
  rows = 5,
  maxLength,
}: Common & { defaultValue?: string | null; rows?: number; maxLength?: number }) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => <Textarea {...p} name={name} rows={rows} maxLength={maxLength} required={required} defaultValue={defaultValue ?? ""} />}
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  required,
  defaultValue,
  options,
}: Common & { defaultValue?: string | null; options: { value: string; label: string }[] }) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <Select {...p} name={name} required={required} defaultValue={defaultValue ?? ""}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Amount typed in major units with the currency code beside it. The server converts to minor units. */
export function MoneyField({
  name,
  label,
  hint,
  className,
  required,
  defaultValue,
  currency,
}: Common & { defaultValue?: string; currency: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <div className="relative">
          <span id={`${p.id}-currency`} className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate">
            {currency}
          </span>
          <Input
            {...p}
            aria-describedby={[`${p.id}-currency`, p["aria-describedby"]].filter(Boolean).join(" ")}
            name={name}
            inputMode="decimal"
            autoComplete="off"
            required={required}
            defaultValue={defaultValue ?? ""}
            className="tnum pl-14"
          />
        </div>
      )}
    </Field>
  );
}

export function CheckboxField({ name, label, defaultChecked, hint }: { name: string; label: React.ReactNode; defaultChecked?: boolean; hint?: string }) {
  const error = useFieldError(name);
  return (
    <div>
      <Checkbox name={name} label={label} defaultChecked={defaultChecked} />
      {hint && !error && <p className="mt-1 pl-6.5 text-xs text-slate">{hint}</p>}
      {error && <p className="mt-1 pl-6.5 text-xs font-semibold text-signal">{error}</p>}
    </div>
  );
}

/** A labelled group of fields with a short explanation on the left, used by every editor section. */
export function FormSection({ title, description, children, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-x-10 gap-y-4 border-t border-line py-8 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]", className)}>
      <div>
        <h2 className="text-lg">{title}</h2>
        {description && <div className="mt-1 text-sm text-slate">{description}</div>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}
