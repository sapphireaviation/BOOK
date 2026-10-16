import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/site/wordmark";
import { AccountMenu } from "@/components/site/account-menu";
import { SideNav, SideNavFallback, type NavItem } from "./side-nav";

/**
 * Frame for the host area and the operations console: a compact header and,
 * once the person has access, a side nav. Dense on purpose; this is a work tool.
 */
export function WorkShell({ area, areaHref, nav, navLabel, children }: { area: string; areaHref: string; nav: NavItem[] | null; navLabel: string; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-4 px-4 lg:px-6">
          <Wordmark />
          <span className="h-5 border-l border-line" aria-hidden="true" />
          <Link href={areaHref} className="text-sm font-semibold text-slate hover:text-ink">
            {area}
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate hover:bg-mist hover:text-ink sm:inline-block">
              Travel site
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col md:flex-row">
        {nav && (
          <aside className="border-b border-line px-4 py-2 md:w-52 md:shrink-0 md:border-r md:border-b-0 md:px-3 md:py-6">
            <div className="md:sticky md:top-20">
              <Suspense fallback={<SideNavFallback items={nav} label={navLabel} />}>
                <SideNav items={nav} label={navLabel} />
              </Suspense>
            </div>
          </aside>
        )}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </>
  );
}

/** Page heading row: title, optional description, actions on the right. */
export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm font-semibold text-slate hover:text-ink">
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl">{title}</h1>
        {description && <div className="mt-1 max-w-prose text-sm text-slate">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
