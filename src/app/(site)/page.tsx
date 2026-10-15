import { FlightSearchForm } from "@/components/search/flight-search-form";

/** Placeholder until the search and home workstream lands the sentence search hero. */
export default function HomePage() {
  return (
    <section className="container-page py-16">
      <h1 className="text-4xl">Flights and stays with no platform fee</h1>
      <div className="mt-8">
        <FlightSearchForm layout="hero" />
      </div>
    </section>
  );
}
