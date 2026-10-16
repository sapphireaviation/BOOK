"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Button, Notice, Textarea } from "@/components/ui";
import { cancelBookingAction } from "./actions";

export type CancelPreview = { refundLabel: string; refundIsZero: boolean; policy: string; explanation: string };

/** Two step cancel: the first click shows what comes back, the second cancels. */
export function CancelBooking({ bookingId, token, preview }: { bookingId: string; token?: string; preview: CancelPreview }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const reasonId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  if (done) {
    return (
      <Notice tone="good" title="Booking cancelled">
        {done}
      </Notice>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => headingRef.current?.focus());
        }}
      >
        Cancel booking
      </Button>
    );
  }

  return (
    <section aria-labelledby={`${reasonId}-h`} className="rounded-md border border-line bg-surface p-5">
      <h3 id={`${reasonId}-h`} ref={headingRef} tabIndex={-1} className="text-lg">
        Cancel this booking?
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate">Policy</dt>
          <dd>{preview.policy}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate">You get back</dt>
          <dd className="tnum font-bold">{preview.refundLabel}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-slate">{preview.explanation}</p>

      <div className="mt-4 space-y-1.5">
        <label htmlFor={reasonId} className="block text-sm font-semibold">
          Reason (optional)
        </label>
        <Textarea id={reasonId} name="reason" maxLength={500} className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      {error && (
        <Notice tone="bad" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="danger"
          pending={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await cancelBookingAction({ bookingId, token, reason });
              if (!res.ok) {
                setError(res.message);
                return;
              }
              setDone(
                res.data.refundAmount === 0
                  ? "Your booking is cancelled. There is no refund under its policy."
                  : "Your booking is cancelled. The refund is on its way to the account you paid with. Banks usually show it within 5 to 7 working days.",
              );
              router.refresh();
            });
          }}
        >
          Cancel booking
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Keep booking
        </Button>
      </div>
    </section>
  );
}
