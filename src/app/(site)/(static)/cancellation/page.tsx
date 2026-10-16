import Link from "next/link";
import { site } from "@/config/site";
import { cancellationPolicyText } from "@/lib/amenities";
import { Prose, StaticPage, staticMetadata } from "../_components/static-page";

const path = "/cancellation";
const title = "Cancellation and refund policies";
const description = `How cancellations and refunds work on ${site.name}: the four stay policies hosts choose from, airline fare rules for flights, and how long refunds take.`;

export const metadata = staticMetadata({ title: "Cancellation and refunds", description, path });

export default function CancellationPage() {
  return (
    <StaticPage
      title={title}
      path={path}
      updated="16 October 2026"
      lead={
        <p>
          Each stay has one of four cancellation policies, chosen by the host and shown before you book. Flight refunds and changes follow the
          airline&apos;s fare rules. {site.name} keeps no fee from any refund.
        </p>
      }
    >
      <Prose>
        <h2>Stays</h2>
        <p>The policy on your booking is the one shown when you booked, even if the host changes it later. Times are counted to the check in date of the listing.</p>
      </Prose>
      <dl className="mt-6 max-w-[70ch] divide-y divide-line border-y border-line">
        {Object.entries(cancellationPolicyText).map(([key, p]) => (
          <div key={key} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
            <dt className="font-bold">{p.label}</dt>
            <dd className="text-slate">{p.summary}</dd>
          </div>
        ))}
      </dl>
      <Prose>
        <p>
          The refund covers the amount you paid for the nights, the cleaning fee and the taxes, in line with the policy. Cancel from{" "}
          <Link href="/trips">Trips</Link>, or from the link in your confirmation email if you booked as a guest. You see the exact refund before you
          confirm.
        </p>
        <h3>If the host cancels</h3>
        <p>If a host cancels a confirmed booking, you get a full refund of everything you paid.</p>

        <h2>Flights</h2>
        <p>
          Every fare shows whether it is refundable and whether it can be changed, with any penalty the airline charges. Those are the airline&apos;s rules
          and we apply them as they are. If a fare is not refundable, the airline may still refund some taxes; write to us and we will ask on your behalf.
        </p>
        <p>
          If the airline cancels or reschedules your flight, the airline&apos;s own policy decides your options. We pass on any refund the airline
          gives in full.
        </p>

        <h2>How refunds are paid</h2>
        <p>
          Refunds go back to the card, UPI account or bank account you paid with. We send the refund as soon as the cancellation is confirmed. Banks
          usually take 5 to 10 working days to show it on your statement.
        </p>

        <h2>Help with a cancellation</h2>
        <p>
          Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> with your booking reference. Answers to common questions are in the{" "}
          <Link href="/help">help centre</Link>.
        </p>
      </Prose>
    </StaticPage>
  );
}
