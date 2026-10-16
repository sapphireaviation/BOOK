"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export type EditorTab = { href: string; label: string; done: boolean | null };

/** Section links for the listing editor. Each section has its own URL so it can be linked and reloaded. */
export function EditorTabs({ tabs, base }: { tabs: EditorTab[]; base: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Listing sections" className="scrollbar-none -mx-4 mb-8 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold",
                  active ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:bg-sapphire" : "text-slate hover:text-ink",
                )}
              >
                {t.label}
                {t.done === true && (
                  <svg viewBox="0 0 16 16" className="size-3.5 text-fern" fill="none" stroke="currentColor" strokeWidth="2.2" aria-label="complete" role="img">
                    <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {t.done === false && <span className="size-2 rounded-full border-[1.5px] border-slate" aria-label="needs attention" role="img" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
