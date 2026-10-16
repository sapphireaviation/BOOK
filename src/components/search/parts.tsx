"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Tracks which picker is open and keeps one stable anchor ref per picker.
 * Pickers close when the page is hidden by a navigation (Next.js keeps hidden pages in <Activity>).
 */
export function usePickers<K extends string>() {
  const [open, setOpen] = useState<K | null>(null);
  const anchors = useRef(new Map<K, React.RefObject<HTMLButtonElement | null>>());
  useLayoutEffect(() => () => setOpen(null), []);
  const anchor = useCallback((key: K) => {
    let ref = anchors.current.get(key);
    if (!ref) {
      ref = { current: null };
      anchors.current.set(key, ref);
    }
    return ref;
  }, []);
  const toggle = useCallback((key: K) => setOpen((cur) => (cur === key ? null : key)), []);
  const close = useCallback(() => setOpen(null), []);
  return { open, setOpen, anchor, toggle, close };
}

/**
 * One editable word in the sentence search. Looks like an underlined word in sapphire;
 * when nothing is chosen yet it shows a placeholder with a dashed underline.
 */
export function Token({
  ref,
  label,
  value,
  placeholder,
  expanded,
  error,
  errorId,
  onClick,
}: {
  ref: React.Ref<HTMLButtonElement>;
  /** What the word stands for, read before the value: "Flying from". */
  label: string;
  value?: string | null;
  placeholder: string;
  expanded: boolean;
  error?: string;
  errorId?: string;
  onClick: () => void;
}) {
  const empty = !value;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={`${label}: ${value ?? "not chosen"}`}
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? "" : undefined}
      className={cn(
        "cursor-pointer whitespace-nowrap rounded-sm -my-1 py-1 font-extrabold underline decoration-[0.07em] underline-offset-[0.16em] transition-colors duration-150",
        empty ? "text-slate decoration-dashed hover:text-ink" : "text-sapphire hover:text-sapphire-deep",
        error ? "decoration-signal" : expanded ? "decoration-sapphire" : empty ? "decoration-slate/60" : "decoration-sapphire/40 hover:decoration-sapphire",
      )}
    >
      {value ?? placeholder}
    </button>
  );
}

/** A labelled box in the compact one row form. */
export function BarField({
  ref,
  label,
  value,
  placeholder,
  expanded,
  error,
  errorId,
  onClick,
  className,
}: {
  ref: React.Ref<HTMLButtonElement>;
  label: string;
  value?: string | null;
  placeholder: string;
  expanded: boolean;
  error?: string;
  errorId?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-describedby={error ? errorId : undefined}
      className={cn(
        "flex min-w-0 flex-col items-start justify-center rounded-md border bg-surface px-3 py-1.5 text-left transition-colors duration-150 hover:border-ink",
        expanded ? "border-sapphire ring-2 ring-sapphire/20" : error ? "border-signal" : "border-line-strong",
        className,
      )}
    >
      <span className="text-2xs font-semibold text-slate">{label}</span>
      <span className={cn("w-full truncate font-semibold", !value && "text-slate")}>{value ?? placeholder}</span>
    </button>
  );
}

/** Inline validation messages for the sentence and bar forms. Always mounted so additions are announced. */
export function ErrorList({ errors, idFor }: { errors: [string, string][]; idFor: (field: string) => string }) {
  return (
    <div role="alert" aria-live="assertive">
      {errors.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm font-semibold text-signal">
          {errors.map(([field, message]) => (
            <li key={field} id={idFor(field)}>
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Return or one way. A pair of radio buttons styled as a two option switch. */
export function TripType({ oneWay, onChange, size = "md" }: { oneWay: boolean; onChange: (oneWay: boolean) => void; size?: "sm" | "md" }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options = [
    { label: "Return", value: false },
    { label: "One way", value: true },
  ];
  // Buttons with radio semantics instead of native radios, so nothing extra is submitted with the form.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = !oneWay;
    onChange(next);
    refs.current[next ? 1 : 0]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Trip type" onKeyDown={onKeyDown} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((o, i) => (
        <button
          key={o.label}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={oneWay === o.value}
          tabIndex={oneWay === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[6px] font-semibold transition-colors duration-150",
            size === "sm" ? "h-10 px-3 text-sm" : "h-10 px-4 text-sm",
            oneWay === o.value ? "bg-ink text-paper" : "text-slate hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type StepperRow = {
  key: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  /** Shown when the plus button is disabled by a rule other than `max`. */
  limitNote?: string;
};

/** Plus and minus steppers for passengers, guests and rooms. */
export function Steppers({ rows, onChange }: { rows: StepperRow[]; onChange: (key: string, value: number) => void }) {
  const id = useId();
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const labelId = `${id}-${row.key}`;
        const noteId = `${id}-${row.key}-note`;
        const atMax = row.value >= row.max;
        return (
          <li key={row.key} role="group" aria-labelledby={labelId} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p id={labelId} className="font-semibold">
                {row.label}
              </p>
              {(row.hint || (atMax && row.limitNote)) && (
                <p id={noteId} className="text-sm text-slate">
                  {atMax && row.limitNote ? row.limitNote : row.hint}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <StepButton
                label={`Fewer ${row.label.toLowerCase()}`}
                disabled={row.value <= row.min}
                onClick={() => onChange(row.key, row.value - 1)}
                kind="minus"
              />
              <output aria-live="polite" aria-labelledby={labelId} className="tnum w-6 text-center text-lg font-bold">
                {row.value}
              </output>
              <StepButton label={`More ${row.label.toLowerCase()}`} disabled={atMax} onClick={() => onChange(row.key, row.value + 1)} kind="plus" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StepButton({ label, disabled, onClick, kind }: { label: string; disabled: boolean; onClick: () => void; kind: "plus" | "minus" }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onClick()}
      className={cn(
        "grid size-10 place-items-center rounded-md border transition-colors duration-150",
        disabled ? "cursor-not-allowed border-line text-slate/40" : "border-line-strong text-ink hover:border-ink",
      )}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor" />
        {kind === "plus" && <rect x="6" y="1" width="2" height="12" rx="1" fill="currentColor" />}
      </svg>
    </button>
  );
}

/** Popover footer with a Done button. */
export function PanelFooter({ onDone, children }: { onDone: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
      <div className="text-sm text-slate">{children}</div>
      <button type="button" onClick={onDone} className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-paper hover:bg-sapphire-deep">
        Done
      </button>
    </div>
  );
}
