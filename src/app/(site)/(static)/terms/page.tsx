import Link from "next/link";
import { site } from "@/config/site";
import { Prose, StaticPage, staticMetadata } from "../_components/static-page";

const path = "/terms";
const title = "Terms of service";
const description = `The terms for using ${site.name} to book flights and stays or to list a property: bookings, payments, cancellations, host duties, liability and disputes.`;

export const metadata = staticMetadata({ title, description, path });

export default function TermsPage() {
  return (
    <StaticPage
      title={title}
      path={path}
      updated="16 October 2026"
      lead={
        <p>
          These terms are an agreement between you and {site.legalName} (&quot;we&quot;, &quot;us&quot;), which runs {site.name}. By using the site,
          the API or the MCP server, or by making or accepting a booking, you agree to them.
        </p>
      }
    >
      <Prose>
        <h2>1. What we do</h2>
        <p>
          {site.name} is a marketplace. For flights, we sell tickets on behalf of airlines at the airline&apos;s fare; the airline operates the flight
          and its conditions of carriage apply to your journey. For stays, the host offers the place and the contract for the stay is between the guest and
          the host; we provide the listing, the booking system and payment collection.
        </p>
        <p>We charge travelers no platform fee and charge hosts no commission. Every price breakdown shows a platform fee of 0.</p>

        <h2>2. Your account</h2>
        <p>
          You must be at least 18 to create an account or make a booking. Give accurate details and keep your password private. You are responsible for
          what happens under your account. You can delete your account at any time from your profile; see the{" "}
          <Link href="/privacy">privacy notice</Link> for what we keep.
        </p>

        <h2>3. Booking and paying</h2>
        <ul>
          <li>The price shown before you pay is the total you are charged. We check flight fares and stay prices again before payment.</li>
          <li>A flight booking is complete when the airline issues the ticket. If the airline does not issue it, we refund you in full.</li>
          <li>A stay booking is complete when we confirm it after payment.</li>
          <li>
            Payments are processed by our payment providers. Their terms also apply to the payment. We do not store your full card number.
          </li>
          <li>Passenger names must match the travel document each passenger will use. Airlines may refuse boarding when they do not.</li>
        </ul>

        <h2>4. Cancellations, changes and refunds</h2>
        <p>
          Stay cancellations follow the policy shown on the listing at the time you booked. Flight cancellations and changes follow the airline&apos;s fare
          rules shown on the fare. Details are in our <Link href="/cancellation">cancellation and refund policies</Link>.
        </p>

        <h2>5. Travelers</h2>
        <p>
          You are responsible for valid passports, visas, health documents and anything else you need to travel, for arriving on time, and for following
          the airline&apos;s rules and the host&apos;s house rules. Treat the place you stay with care; the host may claim for damage you cause.
        </p>

        <h2>6. Hosts</h2>
        <ul>
          <li>You must have the right to rent the place and hold any registration or licence it needs.</li>
          <li>Listings must be accurate, with real photos, correct prices, amenities and availability.</li>
          <li>You must honour confirmed bookings and the cancellation policy you chose. If you cancel a confirmed booking, the guest gets a full refund.</li>
          <li>You are responsible for taxes on your income and for any tax you charge guests.</li>
          <li>We pay out the amount guests pay for your listing, after check in, to the payout account you set up.</li>
          <li>We may pause or remove a listing that breaks these terms or that guests report as unsafe or misleading.</li>
        </ul>

        <h2>7. Using the site, the API and the MCP server</h2>
        <p>
          You may search and link to bookings through our public API and MCP server within the published rate limits. Do not scrape the site around those
          limits, try to break its security, resell our content as your own, add fees to our prices, or use it for anything unlawful.
        </p>

        <h2>8. Content</h2>
        <p>
          Hosts keep ownership of the text and photos they upload and give us permission to show them on the site and in search engines and assistants
          that link to it. Reviews must describe a real stay and must not include personal information about others.
        </p>

        <h2>9. Our responsibility</h2>
        <p>
          We work to keep listings, fares and the site accurate and available, but we do not operate flights or properties. We are not responsible for
          what an airline or host does or fails to do, beyond refunding money we hold for a booking as these terms and the cancellation policies
          describe. Nothing in these terms limits rights you have under consumer protection law that cannot be limited.
        </p>
        <p>
          To the extent the law allows, our total liability to you for a booking is limited to the amount you paid for that booking through{" "}
          {site.name}.
        </p>

        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms. We show the date of the latest version at the top of this page. Bookings already made stay under the terms that applied
          when they were made.
        </p>

        <h2>11. Law and disputes</h2>
        <p>
          These terms are governed by the laws of India. Write to us first so we can try to resolve any problem. Courts in India have jurisdiction over
          disputes, without taking away your right to use the courts where you live if consumer law gives you that right.
        </p>

        <h2>12. Contact</h2>
        <p>
          {site.legalName}. Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </p>
      </Prose>
    </StaticPage>
  );
}
