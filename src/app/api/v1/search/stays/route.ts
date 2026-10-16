import { corsHeaders, preflight, queryOf, respond, searchStaysPublic } from "@/server/ai/public-api";
import { limitRequest, policies } from "@/server/rate-limit";

/** GET /api/v1/search/stays?place=goa&checkin=2026-10-24&checkout=2026-10-27&adults=2, or ?q=a sentence */
export async function GET(req: Request) {
  const limit = await limitRequest(req, "api:stays", policies.api, corsHeaders);
  if (limit.blocked) return limit.blocked;
  return respond(await searchStaysPublic(queryOf(req), "api"), limit.headers);
}

export function OPTIONS() {
  return preflight();
}
