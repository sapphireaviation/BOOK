import Link from "next/link";
import { EditorTabs, type EditorTab } from "@/components/host/editor/editor-tabs";
import { StatusBadge } from "@/components/host/table";
import { loadEditor } from "@/server/host/editor";
import { editorBase, publicListingPath } from "@/server/host/listings";

export const instant = false;

export default async function ListingEditorLayout({ children, params }: LayoutProps<"/host/listings/[id]">) {
  const { id } = await params;
  const { listing, checklist, ready } = await loadEditor(id);
  const base = editorBase(id);
  const done = (keys: string[]) => checklist.filter((c) => keys.includes(c.key)).every((c) => c.done);
  const tabs: EditorTab[] = [
    { href: base, label: "Basics", done: done(["title", "summary", "description"]) },
    { href: `${base}/location`, label: "Location", done: done(["location"]) },
    { href: `${base}/photos`, label: "Photos", done: done(["photos", "alt"]) },
    { href: `${base}/amenities`, label: "Amenities", done: listing.amenities.length > 0 ? true : null },
    { href: `${base}/rooms`, label: "Rooms and pricing", done: done(["units"]) },
    { href: `${base}/calendar`, label: "Calendar", done: null },
    { href: `${base}/policies`, label: "Policies", done: null },
    { href: `${base}/publish`, label: "Publish", done: listing.status === "published" ? true : ready ? null : false },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <Link href="/host/listings" className="text-sm font-semibold text-slate hover:text-ink">
          Listings
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-2xl">{listing.title}</h1>
          <StatusBadge status={listing.status} />
          {listing.verified && <span className="text-xs font-semibold text-fern">Verified</span>}
        </div>
        {listing.status === "published" && listing.destinationSlug && (
          <p className="mt-1 text-sm">
            <Link href={publicListingPath(listing)} className="link">
              View the public page
            </Link>
          </p>
        )}
      </div>
      <EditorTabs tabs={tabs} base={base} />
      {children}
    </div>
  );
}
