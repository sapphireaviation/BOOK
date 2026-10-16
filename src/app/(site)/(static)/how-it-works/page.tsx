import Link from "next/link";
import { FeeLine } from "@/components/ui";
import { site } from "@/config/site";
import { Prose, StaticPage, staticMetadata } from "../_components/static-page";

const path = "/how-it-works";
const title = "How prices work with no platform fee";
const description = `On ${site.name} you pay the airline's own fare for flights and the owner's own price for stays. No booking fee, no convenience fee, no host commission.`;

export const metadata = staticMetadata({ title: "How prices work", description, path });

export default function HowItWorksPage() {
  return (
    <StaticPage
      title={title}
      path={path}
      lead={
        <p>
          Flights cost what the airline charges. Stays cost what the owner charges. {site.name} adds no booking fee, convenience fee or service charge for
          travelers, and takes no commission from hosts. Every price breakdown ends with a platform fee of 0 so you can check it yourself.
        </p>
      }
    >
      <Prose>
        <h2>Flights</h2>
        <p>
          Fares come straight from the airline&apos;s own booking system through a flight aggregator. The price you see is the airline&apos;s fare
          with the airline&apos;s taxes and charges included. We do not add a markup on top of it.
        </p>
        <p>
          The breakdown shows the base fare, the taxes and the platform fee of 0. The total is the amount we charge you. Fares can change between searching
          and paying because airlines reprice seats often. We check the fare again before you pay, and if it changed we show you the new total first.
        </p>
        <p>
          Baggage, refunds and changes follow the airline&apos;s fare rules. We show them on each fare before you book.
        </p>

        <h2>Stays</h2>
        <p>
          Owners set their own nightly prices, cleaning fee and any taxes they must charge. The total for your dates is those amounts added up, with a
          platform fee of 0. The owner receives the full amount you pay for the room, the cleaning fee and the taxes.
        </p>
        <p>
          Some owners charge different prices on different dates, so the total for your dates may be higher or lower than the lowest nightly price shown
          on a listing. The listing page shows the price for every night of your stay before you book.
        </p>

        <h2>What a breakdown looks like</h2>
        <div className="mt-4 max-w-sm rounded-md border border-line bg-surface p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate">3 nights</dt>
              <dd className="tnum">set by the owner</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate">Cleaning fee</dt>
              <dd className="tnum">set by the owner</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate">Taxes</dt>
              <dd className="tnum">as required by law</dd>
            </div>
            <FeeLine currency={site.defaultCurrency} />
          </dl>
        </div>

        <h2>Paying</h2>
        <p>
          The amount charged is the total you see before you pay. Payment is handled by our payment providers. We never see or store your full card
          number. If you pay in a currency your bank does not use, your bank may charge its own conversion fee; that charge is between you and your bank.
        </p>

        <h2>Cancelling</h2>
        <p>
          Refunds for stays follow the cancellation policy shown on the listing. Refunds for flights follow the airline&apos;s fare rules. We do not keep
          a fee from a refund. Read the <Link href="/cancellation">cancellation and refund policies</Link> for the details.
        </p>

        <h2>Questions</h2>
        <p>
          The <Link href="/help">help centre</Link> answers the common ones. For anything else, write to{" "}
          <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </p>
      </Prose>
    </StaticPage>
  );
}
