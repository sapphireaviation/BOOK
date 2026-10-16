import Link from "next/link";
import { site } from "@/config/site";
import { faqLd } from "@/lib/jsonld";
import { slugify } from "@/lib/slug";
import { StaticPage, staticMetadata } from "../_components/static-page";

const path = "/help";
const title = "Help centre";
const description = `Answers about booking flights and stays on ${site.name}: fees, payment, tickets, cancellations, refunds, hosting, accounts and using AI assistants.`;

export const metadata = staticMetadata({ title: "Help and common questions", description, path });

type Faq = { q: string; a: string; links?: { href: string; label: string }[] };

const sections: { title: string; faqs: Faq[] }[] = [
  {
    title: "Prices and fees",
    faqs: [
      {
        q: `Does ${site.name} charge a booking fee?`,
        a: "No. Travelers pay no booking, convenience or service fee, and hosts pay no commission. Every price breakdown shows a platform fee of 0.",
        links: [{ href: "/how-it-works", label: "How prices work" }],
      },
      {
        q: "Is the flight price the same as on the airline's website?",
        a: "We show the fare the airline returns to us, with its taxes, and add nothing. Airlines sometimes offer different fares on their own website or app, so prices can differ.",
      },
      {
        q: "Why did the price change when I went to pay?",
        a: "Airlines and hosts can change prices at any time. We check the price again before you pay, and if it changed we show you the new total before charging anything.",
      },
    ],
  },
  {
    title: "Booking and paying",
    faqs: [
      {
        q: "Do I need an account to book?",
        a: "No. You can book as a guest with your email address, and we email you a link to your booking. With an account you see all your trips in one place.",
      },
      {
        q: "How can I pay?",
        a: "Indian cards, UPI and net banking are handled by Razorpay. International cards are handled by Stripe. We never see or store your full card number.",
      },
      {
        q: "Where is my flight ticket?",
        a: "Once the airline issues the ticket, your confirmation email and the booking page show the airline booking reference. Use it to check in on the airline's website or app.",
      },
      {
        q: "How do I contact the host of my stay?",
        a: "After your booking is confirmed, the booking page shows the host's phone number and email. The host also sees your contact details.",
      },
    ],
  },
  {
    title: "Changes, cancellations and refunds",
    faqs: [
      {
        q: "How do I cancel a booking?",
        a: "Open the booking from Trips, or from the link in your confirmation email, and choose Cancel booking. You see the refund amount before you confirm.",
        links: [{ href: "/trips", label: "Go to Trips" }],
      },
      {
        q: "How much do I get back if I cancel a stay?",
        a: "It depends on the cancellation policy shown on the listing when you booked: Flexible, Moderate, Strict or Non-refundable.",
        links: [{ href: "/cancellation", label: "Cancellation policies" }],
      },
      {
        q: "Can I change the date of my flight?",
        a: "Changes follow the airline's fare rules, shown on the fare before you book. Write to support with your booking reference and we will tell you the options and any cost the airline charges.",
      },
      {
        q: "How long does a refund take?",
        a: "We send the refund to your original payment method as soon as the cancellation is confirmed. Banks usually take 5 to 10 working days to show it.",
      },
    ],
  },
  {
    title: "Hosting",
    faqs: [
      {
        q: "What does it cost to list my place?",
        a: "Nothing. There is no listing fee and no commission. You receive the full amount the guest pays for the room, the cleaning fee and the taxes you charge.",
        links: [{ href: "/hosting", label: "How hosting works" }],
      },
      {
        q: "When do hosts get paid?",
        a: "Payouts for a stay are released after the guest checks in, usually the day after check in.",
      },
    ],
  },
  {
    title: "Your account and data",
    faqs: [
      {
        q: "How do I delete my account?",
        a: "Go to your profile and choose Delete my account. We remove your name, email, phone and saved stays. Past bookings stay in our records without your details because we must keep them for accounting.",
        links: [{ href: "/account", label: "Your profile" }],
      },
      {
        q: "I forgot my password.",
        a: "Use Forgot password on the sign in page, or sign in with a one time link sent to your email instead.",
        links: [{ href: "/forgot-password", label: "Reset your password" }],
      },
    ],
  },
  {
    title: "AI assistants",
    faqs: [
      {
        q: "Can I search from ChatGPT, Claude or another assistant?",
        a: `Yes. ${site.name} has an MCP server and a public API that assistants can use to search flights and stays. They give you a link to book on our website.`,
        links: [{ href: "/developers", label: "Connect an assistant" }],
      },
    ],
  },
];

const allFaqs = sections.flatMap((s) => s.faqs);

export default function HelpPage() {
  return (
    <StaticPage
      title={title}
      path={path}
      jsonLd={[faqLd(allFaqs)]}
      lead={
        <p>
          Short answers to the questions people ask most. If yours is not here, write to{" "}
          <a className="link" href={`mailto:${site.supportEmail}`}>
            {site.supportEmail}
          </a>{" "}
          with your booking reference if you have one.
        </p>
      }
    >
      {sections.map((s) => (
        <section key={s.title} aria-labelledby={`h-${slugify(s.title)}`} className="mt-10 first:mt-6">
          <h2 id={`h-${slugify(s.title)}`} className="text-2xl">
            {s.title}
          </h2>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {s.faqs.map((f) => (
              <div key={f.q} className="py-5">
                <h3 className="text-lg">{f.q}</h3>
                <p className="mt-2 max-w-[70ch] text-slate">{f.a}</p>
                {f.links && (
                  <p className="mt-2 flex flex-wrap gap-4 text-sm">
                    {f.links.map((l) => (
                      <Link key={l.href} href={l.href} className="link">
                        {l.label}
                      </Link>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </StaticPage>
  );
}
