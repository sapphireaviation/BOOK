import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { amenityKeys } from "@/lib/amenities";
import { cabinClasses } from "@/lib/search-params";
import { formatDay, type ISODate } from "@/lib/dates";
import { intentSchema, propertyTypes, type Intent } from "./intent";

const TIMEOUT_MS = 3000;
const TOOL_NAME = "record_trip_request";

let client: Anthropic | undefined;

const tool: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Record the structured search a traveler asked for. Call this exactly once. Leave out any field the traveler did not state or clearly imply.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: {
        type: "string",
        enum: ["flight", "stay", "unknown"],
        description: "flight when they want to fly somewhere, stay when they want a place to sleep, unknown when it is unclear.",
      },
      origin: { type: "string", description: "City or IATA code they fly from, as written. Flights only." },
      destination: { type: "string", description: "City, region or area they fly to or stay in, as written, without words like 'north' removed." },
      start: { type: "string", description: "Departure or check in date as YYYY-MM-DD, resolved against today's date." },
      end: { type: "string", description: "Return or check out date as YYYY-MM-DD." },
      nights: { type: "integer", minimum: 1, maximum: 60, description: "Number of nights when given instead of an end date." },
      oneWay: { type: "boolean", description: "True when they asked for a one way flight." },
      roundTrip: { type: "boolean", description: "True when they asked for a return or round trip flight." },
      adults: { type: "integer", minimum: 1, maximum: 16 },
      children: { type: "integer", minimum: 0, maximum: 10, description: "Children aged 2 to 17." },
      infants: { type: "integer", minimum: 0, maximum: 4, description: "Babies under 2. Flights only." },
      cabin: { type: "string", enum: [...cabinClasses] },
      maxStops: { type: "integer", minimum: 0, maximum: 2, description: "0 for non-stop or direct." },
      departWindow: { type: "string", enum: ["early", "morning", "afternoon", "evening"] },
      minPrice: { type: "number", description: "Lowest price in major units (rupees, not paise). Per night for stays, total for flights." },
      maxPrice: { type: "number", description: "Highest price in major units (rupees, not paise). Per night for stays, total for flights." },
      currency: { type: "string", description: "ISO 4217 code when a currency is stated." },
      sort: {
        type: "string",
        enum: ["cheap", "luxury", "fast", "rating", "early"],
        description: "cheap for cheap or budget, luxury for luxury, fast for quickest flight, rating for best rated, early for earliest departure.",
      },
      amenities: { type: "array", items: { type: "string", enum: amenityKeys }, description: "Stays only. Use pets for pet friendly, beach_access for beach." },
      types: { type: "array", items: { type: "string", enum: [...propertyTypes] }, description: "Stays only. Property types they asked for." },
      freeCancellation: { type: "boolean" },
      instantBook: { type: "boolean" },
      minRating: { type: "number", minimum: 0, maximum: 5 },
    },
  },
};

/**
 * Asks Claude to read the sentence into an Intent. Returns null when the model
 * declines or does not call the tool; throws on network errors and timeouts.
 * The caller falls back to the rule parser in every case.
 */
export async function intentFromModel(text: string, ctx: { today: ISODate; defaultCurrency: string }): Promise<Intent | null> {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

  const response = await client.messages.create(
    {
      model,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: [
        `You turn a traveler's request into search filters for a flight and stay booking site.`,
        `Today is ${formatDay(ctx.today)} (${ctx.today}). Prices are in ${ctx.defaultCurrency} unless stated.`,
        `"Next weekend" means Friday to Sunday of next week. "This weekend" is the coming Friday to Sunday.`,
        `A family of four is 2 adults and 2 children. Dates are day first: 24/10 is 24 October.`,
        `Always answer by calling the ${TOOL_NAME} tool once.`,
      ].join("\n"),
      tools: [tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: text }],
    },
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );

  if (response.stop_reason === "refusal") return null;
  const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME);
  if (!call) return null;
  const parsed = intentSchema.safeParse(call.input);
  if (!parsed.success) throw new Error(`Model output failed validation: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}
