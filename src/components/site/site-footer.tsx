import Link from "next/link";
import { site } from "@/config/site";
import { Wordmark } from "./wordmark";

const groups = [
  {
    title: "Book",
    links: [
      { href: "/flights", label: "Flights" },
      { href: "/stays", label: "Stays" },
      { href: "/destinations", label: "Destinations" },
      { href: "/routes", label: "Popular routes" },
    ],
  },
  {
    title: "Hosts",
    links: [
      { href: "/host", label: "List your place" },
      { href: "/hosting", label: "How hosting works" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/how-it-works", label: "How we charge nothing" },
      { href: "/developers", label: "API and AI assistants" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/cancellation", label: "Cancellation and refunds" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Wordmark className="text-paper" />
          <p className="mt-4 text-sm text-paper/70">
            Flights at the airline&apos;s fare. Stays at the owner&apos;s price. We charge travelers and hosts nothing.
          </p>
        </div>
        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <h2 className="text-sm font-bold tracking-normal text-paper/60">{g.title}</h2>
            <ul className="mt-2 md:mt-3 md:space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-10 items-center text-sm hover:underline md:min-h-0">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-paper/15">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-paper/60">
          <p>{site.legalName}</p>
          <p>
            Questions: <a className="inline-flex min-h-10 items-center underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
