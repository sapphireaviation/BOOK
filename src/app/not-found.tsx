import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This address does not match any page. The link may be old or the listing may have been removed. Search flights or stays, or go back to the home page.",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="container-page max-w-2xl py-20">
          <p className="text-sm font-semibold text-slate">Error 404</p>
          <h1 className="mt-2 text-3xl">We could not find that page</h1>
          <p className="mt-4 text-lg text-slate">
            The link may be old, or the listing may have been taken down by its owner. Check the address, or start a new search.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/flights">Search flights</ButtonLink>
            <ButtonLink href="/stays" variant="secondary">
              Search stays
            </ButtonLink>
          </div>
          <p className="mt-10 border-t border-line pt-6 text-sm text-slate">
            Looking for a booking? Find it under{" "}
            <Link href="/trips" className="link">
              Trips
            </Link>
            , or use the link in your confirmation email.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
