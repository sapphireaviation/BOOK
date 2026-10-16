import type { Metadata } from "next";
import { NotFoundBody } from "@/components/site/not-found-body";

export const metadata: Metadata = {
  title: "Page not found",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

/** notFound() inside the site pages renders here, inside the site header and footer. */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
