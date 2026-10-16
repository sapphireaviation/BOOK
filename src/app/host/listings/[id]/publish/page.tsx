import type { Metadata } from "next";
import Link from "next/link";
import { Notice, Price } from "@/components/ui";
import { PublishButton, UnpublishButton } from "@/components/host/editor/publish-panel";
import { DetailList } from "@/components/host/table";
import { site } from "@/config/site";
import { formatDate } from "@/lib/dates";
import { loadEditor } from "@/server/host/editor";
import { publicListingPath } from "@/server/host/listings";

export const instant = false;
export const metadata: Metadata = { title: "Publish" };

export default async function PublishPage({ params }: PageProps<"/host/listings/[id]/publish">) {
  const { id } = await params;
  const { listing, checklist, ready } = await loadEditor(id);
  const left = checklist.filter((c) => !c.done);
  const published = listing.status === "published";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="checklist">
        <h2 id="checklist" className="text-lg">
          Checklist
        </h2>
        <p className="mt-1 text-sm text-slate">{left.length ? `${left.length} of ${checklist.length} still to do before this listing can go live.` : "Everything is in place."}</p>
        <ul className="mt-4 divide-y divide-line rounded-md border border-line bg-surface">
          {checklist.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="flex items-center gap-3">
                {c.done ? (
                  <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-fern" fill="none" stroke="currentColor" strokeWidth="2.2" role="img" aria-label="Done">
                    <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="size-4 shrink-0 rounded-full border-2 border-line-strong" role="img" aria-label="To do" />
                )}
                <span className={c.done ? "text-slate" : "font-semibold"}>{c.label}</span>
              </span>
              {!c.done && (
                <Link href={c.href} className="link shrink-0">
                  Fix this
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <aside className="space-y-4 self-start">
        {listing.status === "suspended" && (
          <Notice tone="bad" title="Suspended">
            Our team has hidden this listing. Write to {site.supportEmail} to have it restored.
          </Notice>
        )}
        <div className="rounded-md border border-line bg-surface p-4">
          {published ? (
            <>
              <p className="font-semibold text-fern">Live</p>
              <p className="mt-1 text-sm text-slate">Changes you save go live straight away.</p>
              {!ready && (
                <Notice tone="bad" className="mt-3">
                  Some checklist items are no longer complete. Guests still see the listing, so fix them soon.
                </Notice>
              )}
              <div className="mt-4">
                <UnpublishButton listingId={id} />
              </div>
            </>
          ) : listing.status === "suspended" ? (
            <p className="text-sm text-slate">Publishing is paused while the listing is suspended.</p>
          ) : (
            <>
              <p className="font-semibold">Not live yet</p>
              <p className="mb-4 mt-1 text-sm text-slate">{ready ? "Guests can find and book it as soon as you publish." : "Finish the checklist to publish."}</p>
              <PublishButton listingId={id} disabled={!ready} republish={Boolean(listing.publishedAt)} />
            </>
          )}
        </div>
        <DetailList
          stacked
          items={[
            { label: "From", value: listing.fromPrice ? <Price money={{ amount: listing.fromPrice, currency: listing.currency }} /> : "No active room yet" },
            {
              label: "Web address",
              value: published && listing.destinationSlug ? (
                <Link href={publicListingPath(listing)} className="link break-all">
                  {publicListingPath(listing)}
                </Link>
              ) : listing.slug.startsWith("draft-") ? (
                "Set when you publish"
              ) : (
                <span className="break-all">{listing.slug}</span>
              ),
            },
            { label: "First published", value: listing.publishedAt ? formatDate(listing.publishedAt) : "Not yet" },
          ]}
        />
      </aside>
    </div>
  );
}
