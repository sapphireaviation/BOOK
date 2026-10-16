"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { payWithTestCardAction, startPaymentAction } from "./actions";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (r: { error?: { description?: string } }) => void): void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

export type PayPanelProps = {
  bookingId: string;
  token?: string;
  provider: "razorpay" | "stripe" | "test";
  /** Formatted amount for the button, e.g. "₹4,820". */
  amountLabel: string;
  siteName: string;
  description: string;
  prefill: { name: string; email: string; phone: string | null };
  expiresAt: string | null;
};

export function PayPanel(props: PayPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [scriptReady, setScriptReady] = useState(false);
  const pending = busy || isPending;

  async function payWithRazorpay() {
    setError(null);
    setBusy(true);
    try {
      const res = await startPaymentAction(props.bookingId, props.token);
      if (!res.ok) {
        if (res.code === "paid" || res.code === "expired") router.refresh();
        setError(res.message);
        setBusy(false);
        return;
      }
      if (res.data.provider !== "razorpay" || !window.Razorpay) {
        setError("The payment window did not load. Reload the page and try again.");
        setBusy(false);
        return;
      }
      const secondsLeft = props.expiresAt ? Math.floor((new Date(props.expiresAt).getTime() - Date.now()) / 1000) : 0;
      const rzp = new window.Razorpay({
        key: res.data.keyId,
        order_id: res.data.orderId,
        amount: res.data.amount,
        currency: res.data.currency,
        name: props.siteName,
        description: props.description.slice(0, 250),
        prefill: { name: props.prefill.name, email: props.prefill.email, contact: props.prefill.phone ?? undefined },
        notes: { bookingId: props.bookingId },
        theme: { color: "#1B3FAB" },
        // Close the payment window when our hold ends (Razorpay needs at least a minute).
        ...(secondsLeft >= 60 ? { timeout: secondsLeft } : {}),
        modal: { ondismiss: () => setBusy(false), confirm_close: true },
        handler: async (response: RazorpayResponse) => {
          try {
            const verify = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bookingId: props.bookingId, token: props.token, ...response }),
            });
            const body = (await verify.json()) as { ok: boolean; redirect?: string; error?: string };
            if (body.ok && body.redirect) {
              router.push(body.redirect);
              return;
            }
            setError(body.error ?? "We could not confirm this payment yet. Check your booking page in a minute.");
          } catch {
            setError("We could not reach our server to confirm the payment. Check your booking page in a minute before paying again.");
          }
          setBusy(false);
        },
      });
      rzp.on("payment.failed", (r) => {
        setError(`${r.error?.description ?? "The payment did not go through."} You can try again or use another method.`);
      });
      rzp.open();
    } catch {
      setError("Something went wrong opening the payment window. Try again.");
      setBusy(false);
    }
  }

  async function payWithStripe() {
    setError(null);
    setBusy(true);
    const res = await startPaymentAction(props.bookingId, props.token);
    if (!res.ok || res.data.provider !== "stripe") {
      if (!res.ok && (res.code === "paid" || res.code === "expired")) router.refresh();
      setError(res.ok ? "Something went wrong. Reload the page and try again." : res.message);
      setBusy(false);
      return;
    }
    window.location.assign(res.data.url);
  }

  function payWithTestCard() {
    setError(null);
    startTransition(async () => {
      const res = await payWithTestCardAction(props.bookingId, props.token);
      // On success the action redirects to the booking page, so only errors come back here.
      if (res && !res.ok) {
        setError(res.message);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {props.provider === "razorpay" && (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => setError("The payment window could not load. Check your connection and reload the page.")} />
      )}

      {props.provider === "test" && (
        <Notice tone="info" title="Test mode">
          This site is using simulated payments. No card is charged and no money moves.
        </Notice>
      )}

      {props.provider === "razorpay" && (
        <Button type="button" size="lg" className="w-full" onClick={payWithRazorpay} pending={pending} disabled={!scriptReady}>
          Pay {props.amountLabel}
        </Button>
      )}
      {props.provider === "stripe" && (
        <Button type="button" size="lg" className="w-full" onClick={payWithStripe} pending={pending}>
          Pay {props.amountLabel}
        </Button>
      )}
      {props.provider === "test" && (
        <Button type="button" size="lg" className="w-full" onClick={payWithTestCard} pending={pending}>
          Pay with test card
        </Button>
      )}

      <p className="text-xs text-slate">
        {props.provider === "razorpay" && "You pay on Razorpay's secure window with UPI, card, netbanking or a wallet. We never see your card details."}
        {props.provider === "stripe" && "You pay on Stripe's secure page and come back here once it is done. We never see your card details."}
        {props.provider === "test" && `The booking is confirmed as if ${props.amountLabel} had been paid.`}
      </p>

      {error && (
        <Notice tone="bad" title="Payment not completed">
          {error}
        </Notice>
      )}
    </div>
  );
}
