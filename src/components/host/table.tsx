import { Badge, cn } from "@/components/ui";

/** Plain data table: hairline rows, left aligned text, numbers right aligned with tabular figures. */
export function Table({ children, className, caption }: { children: React.ReactNode; className?: string; caption?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-md border border-line bg-surface", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, numeric }: { children?: React.ReactNode; className?: string; numeric?: boolean }) {
  return (
    <th scope="col" className={cn("border-b border-line bg-mist/60 px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-slate", numeric && "text-right", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, numeric, colSpan }: { children?: React.ReactNode; className?: string; numeric?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line px-3 py-2.5 align-top [tr:last-child>&]:border-b-0", numeric && "tnum text-right whitespace-nowrap", className)}>
      {children}
    </td>
  );
}

const statusTone: Record<string, "neutral" | "good" | "bad" | "info"> = {
  draft: "neutral",
  published: "good",
  suspended: "bad",
  archived: "neutral",
  pending_payment: "info",
  confirmed: "good",
  completed: "neutral",
  cancelled: "bad",
  refunded: "neutral",
  expired: "neutral",
  failed: "bad",
  owed: "info",
  scheduled: "info",
  paid: "good",
  traveler: "neutral",
  host: "info",
  admin: "good",
};

const statusLabel: Record<string, string> = {
  pending_payment: "Awaiting payment",
};

export function humanStatus(status: string) {
  const s = statusLabel[status] ?? status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{humanStatus(status)}</Badge>;
}

/** A label and value pair for detail pages. */
export function DetailList({ items, className, stacked }: { items: { label: string; value: React.ReactNode }[]; className?: string; stacked?: boolean }) {
  return (
    <dl className={cn("divide-y divide-line rounded-md border border-line bg-surface text-sm", className)}>
      {items.map((i) => (
        <div key={i.label} className={cn("grid gap-1 px-4 py-2.5", !stacked && "sm:grid-cols-[12rem_1fr] sm:gap-4")}>
          <dt className="text-slate">{i.label}</dt>
          <dd className="min-w-0 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small figure for overview rows: a label above a number. */
export function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold text-slate">{label}</p>
      <div className="tnum mt-1 text-xl font-extrabold">{children}</div>
      {hint && <p className="mt-0.5 text-xs text-slate">{hint}</p>}
    </div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="grid divide-y divide-line rounded-md border border-line bg-surface sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>*]:border-line max-lg:sm:[&>*:nth-child(odd)]:border-r max-lg:sm:[&>*:nth-child(n+3)]:border-t">{children}</div>;
}
