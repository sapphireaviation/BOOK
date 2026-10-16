import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { NotFoundBody } from "@/components/site/not-found-body";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This address does not match any page. The link may be old or the listing may have been removed. Search flights or stays, or go back to the home page.",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

/** For addresses outside every route group. Inside (site), its own not-found renders within the site layout. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <NotFoundBody />
      </main>
      <SiteFooter />
    </>
  );
}
