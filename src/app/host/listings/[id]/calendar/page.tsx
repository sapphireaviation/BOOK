import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, EmptyState, cn } from "@/components/ui";
import { CalendarGrid } from "@/components/host/editor/calendar-grid";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { parseISODate, toISODate } from "@/lib/dates";
import { getUnitMonth, listUnitsForCalendar } from "@/server/host/calendar";
import { loadEditor } from "@/server/host/editor";
import { shiftMonth } from "@/server/host/rules";

export const instant = false;
export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ params, searchParams }: PageProps<"/host/listings/[id]/calendar">) {
  const { id } = await params;
  const sp = await searchParams;
  const { actor, listing } = await loadEditor(id);
  const units = await listUnitsForCalendar(id);
  const base = `/host/listings/${id}/calendar`;

  if (!units.length) {
    return (
      <EmptyState title="Add a room first" action={<ButtonLink href={`/host/listings/${id}/rooms`}>Add a room</ButtonLink>}>
        The calendar shows prices and availability for each room type. Add one under Rooms and pricing.
      </EmptyState>
    );
  }

  const today = toISODate(new Date());
  const thisMonth = today.slice(0, 7);
  const unitParam = typeof sp.unit === "string" ? sp.unit : "";
  const monthParam = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : thisMonth;
  const month = monthParam < thisMonth ? thisMonth : monthParam > shiftMonth(thisMonth, 24) ? shiftMonth(thisMonth, 24) : monthParam;
  const unit = units.find((u) => u.id === unitParam) ?? units.find((u) => u.active) ?? units[0];

  const data = await getUnitMonth(actor, id, unit.id, month);
  const currency = listing.currency;
  const href = (m: string, u = unit.id) => `${base}?unit=${u}&month=${m}`;
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseISODate(`${month}-01`));

  return (
    <div className="space-y-5">
      {units.length > 1 && (
        <nav aria-label="Room types" className="flex flex-wrap gap-2">
          {units.map((u) => (
            <Link
              key={u.id}
              href={href(month, u.id)}
              aria-current={u.id === unit.id ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-semibold",
                u.id === unit.id ? "border-sapphire bg-sapphire-wash text-sapphire" : "border-line-strong bg-surface hover:border-ink",
              )}
            >
              {u.name}
              {!u.active && <span className="ml-1 font-normal text-slate">(not bookable)</span>}
            </Link>
          ))}
        </nav>
      )}
      <CalendarGrid
        key={`${unit.id}-${month}`}
        listingId={id}
        unitId={unit.id}
        currency={currency}
        monthLabel={units.length > 1 ? `${unit.name}, ${monthLabel}` : monthLabel}
        prevHref={month > thisMonth ? href(shiftMonth(month, -1)) : null}
        nextHref={href(shiftMonth(month, 1))}
        basePriceLabel={formatMoney({ amount: data.unit.basePrice, currency })}
        quantity={data.unit.quantity}
        cells={data.cells.map((c) => {
          const d = parseISODate(c.date);
          return {
            ...c,
            day: d.getUTCDate(),
            weekday: (d.getUTCDay() + 6) % 7,
            priceLabel: formatMoney({ amount: c.price, currency }),
            priceShort: formatMoneyCompact({ amount: c.price, currency }),
            past: c.date < today,
          };
        })}
      />
    </div>
  );
}
