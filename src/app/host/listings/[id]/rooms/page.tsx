import type { Metadata } from "next";
import { CurrencyForm, UnitList } from "@/components/host/editor/rooms";
import { formatMoney } from "@/lib/money";
import { loadEditor } from "@/server/host/editor";
import { minorToInput } from "@/server/host/rules";
import { supportedCurrencies } from "@/server/host/schemas";

export const instant = false;
export const metadata: Metadata = { title: "Rooms and pricing" };

export default async function RoomsPage({ params }: PageProps<"/host/listings/[id]/rooms">) {
  const { id } = await params;
  const { listing, units } = await loadEditor(id);
  const currency = listing.currency;
  const options: string[] = [...supportedCurrencies];
  if (!options.includes(currency)) options.unshift(currency);
  return (
    <div className="space-y-8">
      <CurrencyForm listingId={id} currency={currency} options={options} hasPrices={units.length > 0 || listing.cleaningFee > 0} />
      <UnitList
        listingId={id}
        currency={currency}
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          description: u.description,
          maxGuests: u.maxGuests,
          beds: u.beds,
          basePrice: minorToInput(u.basePrice, currency),
          extraGuestPrice: u.extraGuestPrice ? minorToInput(u.extraGuestPrice, currency) : "",
          includedGuests: u.includedGuests,
          quantity: u.quantity,
          active: u.active,
          priceLabel: formatMoney({ amount: u.basePrice, currency }),
          extraLabel: u.extraGuestPrice ? formatMoney({ amount: u.extraGuestPrice, currency }) : null,
        }))}
      />
    </div>
  );
}
