import { cn } from "./cn";

export function Badge({ tone = "neutral", className, children }: { tone?: "neutral" | "good" | "bad" | "info"; className?: string; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-mist text-ink",
    good: "bg-fern-wash text-fern",
    bad: "bg-signal-wash text-signal",
    info: "bg-sapphire-wash text-sapphire",
  } as const;
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-sm bg-mist", className)} />;
}

export function Rating({ value, count, className }: { value: number; count: number; className?: string }) {
  if (!count) return <span className={cn("text-sm text-slate", className)}>New</span>;
  return (
    <span className={cn("inline-flex items-baseline gap-1 text-sm", className)}>
      <span className="tnum font-bold">{value.toFixed(1)}</span>
      <span className="text-slate">
        out of 5, {count} {count === 1 ? "review" : "reviews"}
      </span>
    </span>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "good" | "bad"; title?: string; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-sapphire/30 bg-sapphire-wash",
    good: "border-fern/30 bg-fern-wash",
    bad: "border-signal/30 bg-signal-wash",
  } as const;
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-bold">{title}</p>}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-y border-line py-12">
      <h2 className="text-xl">{title}</h2>
      {children && <div className="mt-2 max-w-prose text-slate">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
