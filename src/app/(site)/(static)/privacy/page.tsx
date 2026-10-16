import Link from "next/link";
import { site } from "@/config/site";
import { Prose, StaticPage, staticMetadata } from "../_components/static-page";

const path = "/privacy";
const title = "Privacy notice";
const description = `What personal data ${site.name} collects, why, who we share it with and how long we keep it, and your rights under India's DPDP Act 2023 and the GDPR.`;

export const metadata = staticMetadata({ title, description, path });

export default function PrivacyPage() {
  return (
    <StaticPage
      title={title}
      path={path}
      updated="16 October 2026"
      lead={
        <p>
          {site.legalName} runs {site.name} and decides how your personal data is used. Under India&apos;s Digital Personal Data Protection Act, 2023 we
          are the Data Fiduciary; under the GDPR we are the controller. This notice explains what we collect, why, and the choices you have.
        </p>
      }
    >
      <Prose>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong>: name, email address, phone number if you add it, and a securely hashed password if you set one. If you sign
            in with Google, we receive your name, email and profile picture from Google.
          </li>
          <li>
            <strong>Booking details</strong>: who is travelling, contact details, dates, and for flights each passenger&apos;s name, date of birth and
            gender, plus passport details when the airline requires them.
          </li>
          <li>
            <strong>Payment records</strong>: amount, status and the reference from the payment provider. Card numbers go to the payment provider and
            never reach us.
          </li>
          <li>
            <strong>Host details</strong>: listing information, payout reference and tax identifiers you give us.
          </li>
          <li>
            <strong>Technical data</strong>: IP address, browser type and sign in session records, used for security and to limit abuse.
          </li>
          <li>
            <strong>Searches</strong>: we log searches without your name or account (route or place, dates, number of travelers) to show typical prices
            and improve search.
          </li>
        </ul>

        <h2>Why we use it</h2>
        <ul>
          <li>To make and manage your bookings, take payment, issue tickets, process refunds and pay hosts. This is necessary to perform our contract with you.</li>
          <li>To send booking confirmations, receipts, sign in links and changes to your trip.</li>
          <li>To keep the site secure, prevent fraud and enforce rate limits.</li>
          <li>To meet legal duties such as tax and accounting records.</li>
        </ul>
        <p>We do not sell personal data, and we do not use it for advertising.</p>

        <h2>Who we share it with</h2>
        <ul>
          <li>The airline for your flight, through our flight booking provider, which needs passenger details to issue the ticket.</li>
          <li>The host of your stay, who sees your name, email and phone number for a confirmed booking.</li>
          <li>Payment providers (Razorpay and Stripe) to take payments and send refunds and payouts.</li>
          <li>Service providers that run the site for us: hosting, database, email delivery and file storage, under contracts that limit their use of the data.</li>
          <li>
            When you describe a trip in your own words, the text may be processed by an AI provider (Anthropic) to understand it. Do not include personal
            details in that box.
          </li>
          <li>Authorities, when the law requires it.</li>
        </ul>
        <p>
          Some of these providers process data outside India. We only transfer data to countries the Government of India has not restricted, and for
          users in the EEA or UK we rely on standard contractual clauses or adequacy decisions.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Account details: until you delete your account.</li>
          <li>Booking and payment records: for as long as tax and accounting law requires, currently up to 8 years, with your contact details removed when you delete your account.</li>
          <li>Passport details: only until the trip is over, unless the law requires longer.</li>
          <li>Security logs: up to 180 days.</li>
        </ul>

        <h2>Your rights under the DPDP Act</h2>
        <p>You can ask us to:</p>
        <ul>
          <li>tell you what personal data we hold about you and how we use it, and who we have shared it with;</li>
          <li>correct, complete or update it;</li>
          <li>erase it, where we no longer need it for a legal purpose; you can also delete your account yourself from your profile;</li>
          <li>withdraw consent you gave, which does not affect what we did before;</li>
          <li>nominate someone to exercise these rights if you die or become unable to.</li>
        </ul>
        <p>
          Our Grievance Officer answers complaints at <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. We reply within 30 days. If you
          are not satisfied, you can complain to the Data Protection Board of India.
        </p>

        <h2>If you are in the EEA or the UK</h2>
        <p>
          We rely on contract (to provide bookings), legal obligation (records we must keep), and legitimate interests (security and fraud prevention) as
          our legal bases. You have the rights of access, correction, erasure, restriction, portability and objection. You can complain to your local data
          protection authority.
        </p>

        <h2>Children</h2>
        <p>
          Accounts are for adults. Bookings may include children as travelers; a parent or guardian gives their details and consents for them when booking.
        </p>

        <h2>Cookies</h2>
        <p>
          We use cookies that are needed to keep you signed in and to protect the site. We do not use advertising cookies. Some preferences, such as a
          recent search, may be kept in your browser&apos;s local storage.
        </p>

        <h2>Security</h2>
        <p>
          Data is encrypted in transit. Passwords are hashed. Access to booking data is limited to you, the host or airline for your booking, and staff who
          need it to help you.
        </p>

        <h2>Changes and contact</h2>
        <p>
          We will post changes here and update the date above. For any privacy question, write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
          See also the <Link href="/terms">terms of service</Link>.
        </p>
      </Prose>
    </StaticPage>
  );
}
