import { z } from "zod";
import { searchAirports } from "@/server/flights";

const querySchema = z.object({
  q: z.string().trim().min(1, "Add a search term, for example ?q=goa").max(64),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

/**
 * GET /api/v1/airports?q=goa&limit=8
 * Airport autocomplete by IATA code, city or airport name. Public and cacheable: the data only
 * changes when the airport seed is refreshed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ q: url.searchParams.get("q") ?? "", limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const data = await searchAirports(parsed.data.q, parsed.data.limit);
  return Response.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
