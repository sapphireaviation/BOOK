import { openApiDocument } from "@/server/seo/openapi";

export function GET() {
  return Response.json(openApiDocument(), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
