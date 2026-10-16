import Link from "next/link";
import { breadcrumbLd } from "@/lib/jsonld";

export type Crumb = { name: string; path: string };

/** Visible breadcrumb trail. The last crumb is the current page. Pair with breadcrumbLd for JSON-LD. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm text-slate">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page">{c.name}</span>
              ) : (
                <>
                  <Link href={c.path} className="hover:text-ink hover:underline">
                    {c.name}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { breadcrumbLd };
