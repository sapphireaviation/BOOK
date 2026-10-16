"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/trips", label: "Trips" },
  { href: "/account", label: "Profile" },
  { href: "/saved", label: "Saved stays" },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  return <AccountNavLinks pathname={pathname} />;
}

/** Static version used while the pathname is not known yet (dynamic routes during prerender). */
export function AccountNavLinks({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Account" className="border-b border-line">
      <ul className="container-page flex gap-1 overflow-x-auto scrollbar-none">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-block px-3 py-3 text-sm font-semibold hover:text-ink ${
                  active ? "text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-sapphire" : "text-slate"
                }`}
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
