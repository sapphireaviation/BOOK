import Image from "next/image";

type Photo = { url: string; alt: string };

/**
 * Listing photos. Phones get a swipeable strip; wider screens get one large photo and up to four beside it.
 * The first photo is the LCP element, so it loads with priority.
 */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  if (!photos.length) {
    return <div className="grid aspect-[3/1] place-items-center rounded-sm border border-line bg-mist text-sm text-slate">The owner has not added photos yet.</div>;
  }
  const [first, ...rest] = photos;
  const side = rest.slice(0, 4);

  return (
    <div>
      <ul className="scrollbar-none -mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 md:hidden" aria-label={`Photos of ${title}`}>
        {photos.map((p, i) => (
          <li key={p.url + i} className="relative aspect-[3/2] w-[85%] shrink-0 snap-start overflow-hidden rounded-sm bg-mist">
            <Image src={p.url} alt={p.alt || `Photo ${i + 1} of ${title}`} fill sizes="85vw" className="object-cover" priority={i === 0} />
          </li>
        ))}
      </ul>

      <div className={`hidden gap-2 md:grid ${side.length ? "md:grid-cols-4 md:grid-rows-2" : ""} md:h-[26rem] lg:h-[30rem]`}>
        <div className={`relative overflow-hidden rounded-sm bg-mist ${side.length ? "md:col-span-2 md:row-span-2" : "h-full"}`}>
          <Image src={first.url} alt={first.alt || `Photo of ${title}`} fill sizes="(min-width: 1200px) 560px, 50vw" className="object-cover" priority />
        </div>
        {side.map((p, i) => (
          <div key={p.url + i} className={`relative overflow-hidden rounded-sm bg-mist ${side.length < 3 ? "md:row-span-2" : ""}`}>
            <Image src={p.url} alt={p.alt || `Photo ${i + 2} of ${title}`} fill sizes="(min-width: 1200px) 280px, 25vw" className="object-cover" />
          </div>
        ))}
      </div>
      {photos.length > 5 && <p className="mt-2 hidden text-sm text-slate md:block">Showing 5 of {photos.length} photos.</p>}
    </div>
  );
}
