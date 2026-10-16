import { Suspense } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { AccountNav, AccountNavLinks } from "./account/_components/account-nav";

export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<AccountNavLinks />}>
        <AccountNav />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
