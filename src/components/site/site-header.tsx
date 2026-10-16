import Link from "next/link";
import { Wordmark } from "./wordmark";
import { AccountMenu } from "./account-menu";
import { MainNav } from "./main-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
        <Wordmark />
        <MainNav />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/host" className="hidden rounded-md px-3 py-2 text-sm font-semibold hover:bg-mist md:inline-block">
            List your place
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
