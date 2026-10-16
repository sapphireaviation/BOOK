import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button, ButtonLink, Field, Input, Notice, Skeleton, Textarea } from "@/components/ui";
import { site } from "@/config/site";
import { toISODate } from "@/lib/dates";
import { flatten } from "@/lib/search-params";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
import { parseTripQuery } from "@/server/ai/parse-query";
import { pathForParsed } from "@/server/ai/public-api";
import { clientIp, consume, policies } from "@/server/rate-limit";
import { applyAnswers, type Answers, type Completed } from "./complete";

export const metadata: Metadata = {
  title: "Describe your trip",
  description: `Type the trip you want in your own words, like "2 adults in Goa next weekend under ₹4,000 a night with a pool", and ${site.name} turns it into a search.`,
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

const examples = [
  "Delhi to Goa next Friday, back on Sunday, 2 adults",
  "Villa in North Goa next weekend for a family of four with a pool",
  "Homestay in Manali for 3 nights from 24 Oct under ₹3,000 a night",
  "One way Mumbai to Bengaluru tomorrow morning, business class",
];

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <Suspense fallback={<Loading />}>
        <Results searchParams={searchParams} />
      </Suspense>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Describe your trip", path: "/search" }])} />
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const sp = flatten(await searchParams);
  const q = (sp.q ?? "").trim().slice(0, 500);
  if (!q) return <Ask />;

  const limited = !(await consume(`search:${clientIp(await headers())}`, policies.search)).ok;
  const kind = sp.kind === "flight" || sp.kind === "stay" ? sp.kind : undefined;
  const parsed = await parseTripQuery(q, { kind, useModel: !limited });
  const answers: Answers = {};
  for (const k of ["from", "to", "depart", "return", "place", "checkin", "checkout"] as const) if (sp[k]) answers[k] = sp[k].slice(0, 120);
  const trip = await applyAnswers(parsed, answers, toISODate(new Date()));
  const path = pathForParsed(trip);

  // Answers from the follow-up form complete the search: go straight to results.
  if (path && trip.answered && !Object.keys(trip.errors).length) redirect(path);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">We read this as</h1>
        <p className="mt-2 text-slate">
          From <q className="text-ink">{q}</q>
        </p>
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {trip.understood.map((u) => (
          <li key={u} className="py-3 text-lg font-semibold">
            {u}
          </li>
        ))}
      </ul>
      {path ? (
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href={path} size="lg">
            {trip.kind === "flight" ? "Search flights" : "Search stays"}
          </ButtonLink>
          <Link href={`/search`} className="link">
            Describe it differently
          </Link>
        </div>
      ) : (
        <FollowUp q={q} trip={trip} />
      )}
    </div>
  );
}

const labels = {
  from: { label: "Flying from", hint: "City or airport code, like Delhi or DEL", type: "text" },
  to: { label: "Flying to", hint: "City or airport code, like Goa or GOI", type: "text" },
  depart: { label: "Leaving on", hint: undefined, type: "date" },
  return: { label: "Coming back on", hint: "Leave empty for a one way trip", type: "date" },
  place: { label: "Where do you want to stay?", hint: "A city, town or area", type: "text" },
  checkin: { label: "Check in", hint: undefined, type: "date" },
  checkout: { label: "Check out", hint: undefined, type: "date" },
} as const;

function FollowUp({ q, trip }: { q: string; trip: Completed }) {
  const today = toISODate(new Date());
  if (trip.kind === "unknown") {
    return (
      <form action="/search" className="space-y-4">
        <h2 className="text-xl">Is this a flight or a place to stay?</h2>
        <input type="hidden" name="q" value={q} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="kind" value="flight">
            Find flights
          </Button>
          <Button type="submit" name="kind" value="stay" variant="secondary">
            Find stays
          </Button>
        </div>
      </form>
    );
  }

  const fields = trip.missing.filter((m): m is keyof typeof labels => m in labels);
  const current = { ...(trip.flight ?? {}), ...(trip.stay ?? {}) } as Record<string, unknown>;
  return (
    <form action="/search" className="space-y-5">
      <h2 className="text-xl">{fields.length === 1 ? "One more detail" : "A few more details"}</h2>
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="kind" value={trip.kind} />
      {Object.keys(trip.errors).length > 0 && <Notice tone="bad">Some answers need another look. Check the fields marked below.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const meta = labels[f];
          return (
            <Field key={f} label={meta.label} hint={meta.hint} error={trip.errors[f]}>
              {(p) => (
                <Input
                  {...p}
                  name={f}
                  type={meta.type}
                  min={meta.type === "date" ? today : undefined}
                  defaultValue={typeof current[f] === "string" ? (current[f] as string) : undefined}
                  required={f !== "return"}
                  autoComplete="off"
                />
              )}
            </Field>
          );
        })}
      </div>
      <Button type="submit" size="lg">
        {trip.kind === "flight" ? "Search flights" : "Search stays"}
      </Button>
    </form>
  );
}

function Ask() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Describe your trip</h1>
        <p className="mt-2 max-w-prose text-slate">
          Write it the way you would tell a friend. We pick out the places, dates, travelers and budget, and ask for anything that is missing.
        </p>
      </div>
      <form action="/search" className="space-y-4">
        <Field label="Your trip">
          {(p) => <Textarea {...p} name="q" required maxLength={500} placeholder="2 adults in Goa next weekend under ₹4,000 a night with a pool" />}
        </Field>
        <Button type="submit" size="lg">
          Read my trip
        </Button>
      </form>
      <div>
        <h2 className="text-lg">Try one of these</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {examples.map((e) => (
            <li key={e}>
              <Link href={`/search?q=${encodeURIComponent(e)}`} className="block py-3 text-sapphire hover:underline">
                {e}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <p className="text-3xl font-extrabold tracking-tight">Reading your trip</p>
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12 w-2/3" />
    </div>
  );
}
