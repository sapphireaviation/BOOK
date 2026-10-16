import { connection } from "next/server";
import { indexNowKey } from "@/server/seo/indexnow";

/**
 * IndexNow key file. Search engines fetch it at /<key>.txt; proxy.ts rewrites
 * that path here so the key never has to be committed as a file.
 */
export async function GET() {
  await connection();
  const key = indexNowKey();
  if (!key) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
