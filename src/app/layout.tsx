import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";
import { site } from "@/config/site";
import { JsonLd, organizationLd, websiteLd } from "@/lib/jsonld";
import "./globals.css";

const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: site.name, locale: site.defaultLocale.replace("-", "_"), url: "/" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0e1a2b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={site.defaultLocale} className={`${overpass.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        {children}
        <JsonLd data={[{ "@context": "https://schema.org", ...organizationLd() }, { "@context": "https://schema.org", ...websiteLd() }]} />
      </body>
    </html>
  );
}
