import { isISODate } from "@/lib/dates";
import { corsHeaders, getListingPublicApi, preflight, queryOf, respond } from "@/server/ai/public-api";
import { limitRequest, policies } from "@/server/rate-limit";

/** GET /api/v1/listings/{slug}?checkin=2026-10-24&checkout=2026-10-27&adults=2 */
export async function GET(req: Request, ctx: RouteContext<"/api/v1/listings/[slug]">) {
  const limit = await limitRequest(req, "api:listing", policies.api, corsHeaders);
  if (limit.blocked) return limit.blocked;
  const { slug } = await ctx.params;
  const q = queryOf(req);
  const adults = Number(q.adults);
  const dates =
    isISODate(q.checkin) && isISODate(q.checkout) && q.checkout > q.checkin
      ? { checkin: q.checkin, checkout: q.checkout, ...(Number.isInteger(adults) && adults > 0 && adults <= 16 ? { adults } : {}) }
      : undefined;
  return respond(await getListingPublicApi(slug.toLowerCase(), dates), limit.headers);
}

export function OPTIONS() {
  return preflight();
}
