import { formatMoney, type Money } from "@/lib/money";
import { cn } from "./cn";

export function Price({ money, className, locale }: { money: Money; className?: string; locale?: string }) {
  return <span className={cn("tnum", className)}>{formatMoney(money, locale)}</span>;
}

export type BreakdownLine = { label: string; amount: number; kind?: string };

/**
 * The price receipt. Always ends with the platform fee line at zero, then the total.
 * This is one of the two places runway yellow is used (see docs/DESIGN.md).
 */
export function PriceBreakdown({ lines, currency, total, className }: { lines: BreakdownLine[]; currency: string; total: number; className?: string }) {
  const visible = lines.filter((l) => l.kind !== "fee");
  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      {visible.map((l) => (
        <div key={l.label} className="flex justify-between gap-4">
          <dt className="text-slate">{l.label}</dt>
          <dd className="tnum">{formatMoney({ amount: l.amount, currency })}</dd>
        </div>
      ))}
      <FeeLine currency={currency} />
      <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd className="tnum">{formatMoney({ amount: total, currency })}</dd>
      </div>
    </dl>
  );
}

export function FeeLine({ currency }: { currency: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate">Platform fee</dt>
      <dd className="tnum">
        <span className="rounded-sm bg-runway px-1.5 py-0.5 font-bold text-ink">{formatMoney({ amount: 0, currency })}</span>
      </dd>
    </div>
  );
}
