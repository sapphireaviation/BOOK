import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { site } from "@/config/site";
import { cancellationPolicyText } from "@/lib/amenities";
import { Prose, StaticPage, staticMetadata } from "../_components/static-page";

const path = "/hosting";
const title = "How hosting works";
const description = `List your home, homestay, guesthouse or hotel on ${site.name} with no commission. Set your own prices and dates, and keep everything guests pay you.`;

export const metadata = staticMetadata({ title, description, path });

const steps = [
  { title: "Create your listing", body: "Describe the place, add photos, the address and the amenities you offer. Choose house rules, check in and check out times." },
  {
    title: "Add rooms or units",
    body: "A home can be one unit. A guesthouse or hotel adds each room type with how many identical rooms it has, how many guests fit and the nightly price.",
  },
  { title: "Set prices and dates", body: "Change the price for any date, close dates you are not available, and set a minimum and maximum stay." },
  { title: "Publish", body: "Your listing appears in search and on the destination page. Guests book and pay on the site." },
];

export default function HostingPage() {
  return (
    <StaticPage
      title={title}
      path={path}
      lead={
        <p>
          Hosts list their place on {site.name} for free and pay no commission on bookings. You set the nightly price, the cleaning fee and the taxes you
          must charge. Guests pay that amount with a platform fee of 0, and you receive all of it.
        </p>
      }
    >
      <ol className="mt-6 divide-y divide-line border-y border-line">
        {steps.map((s, i) => (
          <li key={s.title} className="grid gap-2 py-5 sm:grid-cols-[3rem_1fr]">
            <span className="tnum text-2xl font-extrabold text-slate">{i + 1}</span>
            <div>
              <h2 className="text-lg">{s.title}</h2>
              <p className="mt-1 max-w-[70ch] text-slate">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Prose>
        <h2>Bookings and guests</h2>
        <p>
          With instant booking on, a booking is confirmed as soon as the guest pays. You see the guest&apos;s name, email and phone number for every
          confirmed booking at your place, and the guest sees yours.
        </p>
        <h2>Getting paid</h2>
        <p>
          We collect the payment from the guest. Your payout is the full amount the guest paid for the room, the cleaning fee and the taxes. It is released
          after the guest checks in, usually the day after check in. The dashboard shows what is owed and what has been paid.
        </p>
        <h2>Cancellation policy</h2>
        <p>Choose one of these. Guests see it before they book, and it applies to their booking even if you change it later.</p>
        <ul>
          {Object.values(cancellationPolicyText).map((p) => (
            <li key={p.label}>
              <strong>{p.label}.</strong> {p.summary}
            </li>
          ))}
        </ul>
        <h2>Your responsibilities</h2>
        <p>
          You need the right to rent the place, any local registration or licence it requires, and you are responsible for the taxes on your income. The
          listing must describe the place truthfully, with real photos. Read the <Link href="/terms">terms</Link> before you publish.
        </p>
      </Prose>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <ButtonLink href="/host" size="lg">
          List your place
        </ButtonLink>
        <Link href="/help" className="link">
          Read common questions
        </Link>
      </div>
    </StaticPage>
  );
}
