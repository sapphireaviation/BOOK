import "server-only";
import { searchAirports } from "@/server/flights";
import { suggestPlaces } from "@/server/stays/search";
import type { Resolvers } from "./finish";

/** Production lookups for the parser, backed by the flights and stays services. */
export const defaultResolvers: Resolvers = {
  airports: async (q) => (await searchAirports(q, 5)).map((a) => ({ iata: a.iata, name: a.name, city: a.city })),
  places: async (q) => (await suggestPlaces(q, 5)).map((p) => ({ slug: p.slug, name: p.name })),
};
