"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/flights", label: "Flights" },
  { href: "/stays", label: "Stays" },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-2 py-2 text-sm sm:px-3 font-semibold hover:bg-mist ${
              active ? "text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:bg-sapphire" : "text-slate"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
