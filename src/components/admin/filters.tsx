import Link from "next/link";
import { Button, Input, Select } from "@/components/ui";

type SelectFilter = { name: string; label: string; value?: string; options: { value: string; label: string }[] };

/** A plain GET form, so filtered views are shareable URLs and work without JavaScript. */
export function FilterBar({
  action,
  search,
  selects = [],
}: {
  action: string;
  search?: { name: string; label: string; placeholder?: string; value?: string };
  selects?: SelectFilter[];
}) {
  return (
    <form method="get" action={action} role="search" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-3">
      {search && (
        <div className="min-w-56 flex-1">
          <label htmlFor={`f-${search.name}`} className="mb-1 block text-xs font-semibold">
            {search.label}
          </label>
          <Input id={`f-${search.name}`} name={search.name} type="search" defaultValue={search.value ?? ""} placeholder={search.placeholder} className="h-9 text-sm" />
        </div>
      )}
      {selects.map((s) => (
        <div key={s.name} className="w-44">
          <label htmlFor={`f-${s.name}`} className="mb-1 block text-xs font-semibold">
            {s.label}
          </label>
          <Select id={`f-${s.name}`} name={s.name} defaultValue={s.value ?? ""} className="h-9 text-sm">
            <option value="">Any</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <Button type="submit" size="sm">
        Search
      </Button>
      <Link href={action} className="px-1 py-2 text-sm font-semibold text-slate hover:text-ink">
        Clear
      </Link>
    </form>
  );
}

/** Previous and next links that keep the current filters. */
export function Pager({ path, params, page, hasMore }: { path: string; params: Record<string, string | undefined>; page: number; hasMore: boolean }) {
  if (page === 1 && !hasMore) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 font-semibold hover:border-ink">
          Previous page
        </Link>
      )}
      <span className="tnum text-slate">Page {page}</span>
      {hasMore && (
        <Link href={href(page + 1)} className="rounded-md border border-line-strong bg-surface px-3 py-1.5 font-semibold hover:border-ink">
          Next page
        </Link>
      )}
    </nav>
  );
}

/** Reads a single string from Next's searchParams record. */
export function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}
