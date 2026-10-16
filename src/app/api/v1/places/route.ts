import { z } from "zod";
import { suggestPlaces } from "@/server/stays/search";

const query = z.object({
  q: z.string().trim().max(80).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

/** GET /api/v1/places?q=goa: place suggestions for the stay search box, with listing counts. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = query.safeParse({ q: url.searchParams.get("q") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) {
    return Response.json({ error: "invalid_query", message: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }
  try {
    const places = await suggestPlaces(parsed.data.q, parsed.data.limit);
    return Response.json({ places }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    console.error("suggestPlaces failed", err);
    return Response.json({ error: "unavailable", message: "Place search is not available right now. Try again in a minute." }, { status: 503 });
  }
}
