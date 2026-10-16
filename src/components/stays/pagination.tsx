import Link from "next/link";
import { cn } from "@/components/ui";

/** Real links for each page, so crawlers and people without JavaScript can page through results. */
export function Pagination({ page, pageCount, hrefFor, label = "Result pages" }: { page: number; pageCount: number; hrefFor: (page: number) => string; label?: string }) {
  if (pageCount <= 1) return null;
  const pages = pageWindow(page, pageCount);
  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-semibold tnum";
  return (
    <nav aria-label={label} className="mt-8 flex flex-wrap items-center gap-2">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(item, "border-line bg-surface hover:border-ink")}>
          Previous
        </Link>
      )}
      {pages.map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-slate" aria-hidden="true">
            ...
          </span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={cn(item, "border-ink bg-ink text-paper")}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={cn(item, "border-line bg-surface hover:border-ink")} aria-label={`Page ${p}`}>
            {p}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(item, "border-line bg-surface hover:border-ink")}>
          Next
        </Link>
      )}
    </nav>
  );
}

/** 1 ... 4 5 6 ... 12 */
export function pageWindow(page: number, count: number): (number | null)[] {
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev > 1) out.push(null);
    out.push(p);
  }
  return out;
}
