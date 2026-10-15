import { site, absoluteUrl } from "@/config/site";

type Thing = Record<string, unknown>;

/** Renders JSON-LD safely. `<` is escaped so content can never close the script tag. */
export function JsonLd({ data }: { data: Thing | Thing[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : { "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function organizationLd(): Thing {
  const sameAs = Object.values(site.social).filter(Boolean);
  return {
    "@type": "TravelAgency",
    "@id": absoluteUrl("/#organization"),
    name: site.name,
    url: site.url,
    logo: absoluteUrl("/icon.png"),
    email: site.supportEmail,
    description: site.description,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd(): Thing {
  return {
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: site.name,
    url: site.url,
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Thing {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]): Thing {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
