import { corsHeaders, preflight, queryOf, respond, searchFlightsPublic } from "@/server/ai/public-api";
import { limitRequest, policies } from "@/server/rate-limit";

/** GET /api/v1/search/flights?from=DEL&to=GOI&depart=2026-10-24&adults=1, or ?q=a sentence */
export async function GET(req: Request) {
  const limit = await limitRequest(req, "api:flights", policies.api, corsHeaders);
  if (limit.blocked) return limit.blocked;
  const { limit: max, ...query } = queryOf(req);
  const n = Number(max);
  return respond(await searchFlightsPublic(query, "api", Number.isInteger(n) && n > 0 ? n : 20), limit.headers);
}

export function OPTIONS() {
  return preflight();
}
