import Image from "next/image";
import Link from "next/link";
import { Badge, Rating } from "@/components/ui";
import { propertyTypeLabels } from "@/lib/amenities";
import { formatMoney } from "@/lib/money";

export type StayRowData = {
  id: string;
  url: string;
  title: string;
  summary: string;
  propertyType: string;
  /** "Calangute, Goa" or "1.2 km from the centre of Goa". */
  where: string;
  photo: { url: string; alt: string } | null;
  ratingAvg: number;
  ratingCount: number;
  isDemo: boolean;
  freeCancellation: boolean;
  instantBook: boolean;
  facts: string[];
  currency: string;
  /** Headline price in minor units, with the words after it ("a night", "a night before taxes"). */
  price: number;
  priceNote: string;
  /** Word before the price, such as "From". */
  pricePrefix?: string;
  /** Second line under the price, such as the stay total. */
  priceDetail?: string;
};

/** One stay in a list: a wide photo, the facts, and the price. Rows are separated by hairlines. */
export function StayRow({
  data,
  href,
  action,
  rowId,
  priority = false,
  headingLevel = 2,
}: {
  data: StayRowData;
  href?: string;
  action?: React.ReactNode;
  rowId?: string;
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const link = href ?? data.url;
  return (
    <li id={rowId} className="grid gap-4 border-b border-line py-6 first:pt-0 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <Link href={link} tabIndex={-1} aria-hidden="true" className="relative block aspect-[3/2] overflow-hidden rounded-sm bg-mist">
        {data.photo ? (
          <Image
            src={data.photo.url}
            alt=""
            fill
            sizes="(min-width: 768px) 288px, (min-width: 640px) 240px, 100vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm text-slate">No photo yet</span>
        )}
      </Link>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate">
              {propertyTypeLabels[data.propertyType] ?? "Stay"} in {data.where}
            </p>
            <H className="mt-0.5 text-lg leading-snug">
              <Link href={link} className="hover:text-sapphire focus-visible:text-sapphire">
                {data.title}
              </Link>
            </H>
          </div>
          {action}
        </div>
        {data.summary && <p className="mt-1.5 line-clamp-2 text-sm text-slate">{data.summary}</p>}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {data.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Rating value={data.ratingAvg} count={data.ratingCount} />
          {data.freeCancellation && <Badge tone="good">Free cancellation</Badge>}
          {data.instantBook && <Badge tone="info">Instant book</Badge>}
          {data.isDemo && <SampleBadge />}
        </div>
        <div className="mt-auto pt-3 sm:text-right">
          <p>
            {data.pricePrefix && <span className="text-sm text-slate">{data.pricePrefix} </span>}
            <span className="tnum text-xl font-extrabold">{formatMoney({ amount: data.price, currency: data.currency })}</span>{" "}
            <span className="text-sm text-slate">{data.priceNote}</span>
          </p>
          {data.priceDetail && <p className="tnum text-sm text-slate">{data.priceDetail}</p>}
        </div>
      </div>
    </li>
  );
}

/** Marks seeded sample data so nobody mistakes it for a real place. */
export function SampleBadge() {
  return (
    <span title="Sample data for testing. This place does not exist.">
      <Badge tone="neutral">Sample listing</Badge>
    </span>
  );
}
