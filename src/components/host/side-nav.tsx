"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Vertical nav on desktop, a scrolling row on small screens. */
export function SideNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-semibold",
                  active ? "bg-sapphire-wash text-sapphire" : "text-slate hover:bg-mist hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Same nav with nothing marked, for the moment before the pathname is known. */
export function SideNavFallback({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link href={item.href} className="block rounded-md px-3 py-2 text-sm font-semibold text-slate hover:bg-mist hover:text-ink">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
