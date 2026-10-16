import { ButtonLink } from "@/components/ui";

/** Calm state for when no flight provider is configured. The rest of the site keeps working. */
export function FlightsNotConnected({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="border-y border-line py-12">
      <Heading className={headingLevel === 1 ? "text-3xl" : "text-xl"}>Flight booking is not connected yet</Heading>
      <p className="mt-2 max-w-prose text-slate">
        We are setting up our connection to the airlines, so flights cannot be searched or booked here today. Stays are open, with no platform fee.
      </p>
      <div className="mt-5">
        <ButtonLink href="/stays" variant="secondary">
          Browse stays
        </ButtonLink>
      </div>
    </div>
  );
}
