import "server-only";
import type { StaySearch } from "@/lib/search-params";
import type { PlaceSuggestion, StaySearchResult } from "./types";

/** CONTRACT (stays workstream). Used by /stays/search, /api/v1/search/stays and the MCP tool. */
export async function searchStays(params: StaySearch, opts?: { source?: "web" | "api" | "mcp" }): Promise<StaySearchResult> {
  void params;
  void opts;
  throw new Error("searchStays not implemented");
}

/** CONTRACT. Autocomplete for the place field. Backs GET /api/v1/places?q=. */
export async function suggestPlaces(q: string, limit = 8): Promise<PlaceSuggestion[]> {
  void q;
  void limit;
  throw new Error("suggestPlaces not implemented");
}
