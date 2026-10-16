"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const items = [
  { href: "/flights", label: "Flights" },
  { href: "/stays", label: "Stays" },
] as const;

export function MainNav() {
  // usePathname suspends while routes with dynamic params prerender, so the links render without
  // an active state in the static shell and gain it once the path is known.
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <NavWithPath />
    </Suspense>
  );
}

function NavWithPath() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {items.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm font-semibold hover:bg-mist ${
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
