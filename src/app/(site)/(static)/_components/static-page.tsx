import type { Metadata } from "next";
import { site } from "@/config/site";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";

type Thing = Record<string, unknown>;

/** Metadata for a static page: unique title, description, canonical, Open Graph and Twitter card. */
export function staticMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: `${title} | ${site.name}`,
      description,
      url: path,
      siteName: site.name,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${site.name}: ${site.tagline}` }],
    },
    twitter: { card: "summary_large_image", title: `${title} | ${site.name}`, description },
  };
}

/**
 * Shell for help, policy and guide pages: one h1, a factual lead paragraph,
 * readable prose width and BreadcrumbList JSON-LD.
 */
export function StaticPage({
  title,
  lead,
  path,
  updated,
  jsonLd = [],
  children,
}: {
  title: string;
  lead: React.ReactNode;
  path: string;
  updated?: string;
  jsonLd?: Thing[];
  children: React.ReactNode;
}) {
  return (
    <article className="container-page py-10 sm:py-14">
      <header className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <div className="mt-4 text-lg text-slate">{lead}</div>
        {updated && <p className="mt-3 text-sm text-slate">Last updated {updated}</p>}
      </header>
      <div className="mt-10 max-w-3xl border-t border-line pt-2">{children}</div>
      <JsonLd
        data={[
          { "@context": "https://schema.org", ...breadcrumbLd([{ name: "Home", path: "/" }, { name: title, path }]) },
          ...jsonLd.map((d) => ({ "@context": "https://schema.org", ...d })),
        ]}
      />
    </article>
  );
}

/** Long form text with the site's link and list styles. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[70ch] [&_a]:text-sapphire [&_a]:underline [&_a]:underline-offset-[3px] [&_a:hover]:text-sapphire-deep [&_h2]:mt-10 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-lg [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_strong]:font-bold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      {children}
    </div>
  );
}

/** Code sample. Uses the site typeface (docs/DESIGN.md: no monospace). */
export function Sample({ children, label }: { children: string; label: string }) {
  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-semibold text-slate">{label}</figcaption>
      <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap break-all">
        <code className="font-sans">{children}</code>
      </pre>
    </figure>
  );
}
