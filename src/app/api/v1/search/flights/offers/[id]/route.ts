import { corsHeaders, getOfferPublic, preflight, respond } from "@/server/ai/public-api";
import { limitRequest, policies } from "@/server/rate-limit";

/** GET /api/v1/search/flights/offers/{id}: the current price and conditions of one fare. */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/search/flights/offers/[id]">) {
  const limit = await limitRequest(req, "api:offer", policies.api, corsHeaders);
  if (limit.blocked) return limit.blocked;
  const { id } = await ctx.params;
  return respond(await getOfferPublic(id), limit.headers);
}

export function OPTIONS() {
  return preflight();
}
