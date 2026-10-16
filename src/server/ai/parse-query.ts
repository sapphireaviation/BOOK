import "server-only";
import { site } from "../../config/site";
import { toISODate, type ISODate } from "../../lib/dates";
import { finishIntent, type ParsedTrip, type Resolvers } from "./finish";
import { extractIntent } from "./rules";

export type { ParsedTrip, MissingField } from "./finish";

export type ParseOptions = {
  /** "YYYY-MM-DD" the sentence is read against. Defaults to the current date in UTC. */
  today?: ISODate;
  defaultCurrency?: string;
  /** Inject lookups (tests). Defaults to the airport and place services. */
  resolvers?: Resolvers;
  /** Set to false to skip the model even when a key is configured. */
  useModel?: boolean;
};

/**
 * Turns a sentence into flight or stay search parameters.
 *
 * With ANTHROPIC_API_KEY set the model reads the sentence first (3 second
 * budget). Any failure, timeout or invalid output falls back to the rule
 * parser, which always works.
 */
export async function parseTripQuery(text: string, opts: ParseOptions = {}): Promise<ParsedTrip> {
  const today = opts.today ?? toISODate(new Date());
  const defaultCurrency = opts.defaultCurrency ?? site.defaultCurrency;
  const input = text.slice(0, 500);
  const resolvers = opts.resolvers ?? (await import("./resolvers")).defaultResolvers;

  if (opts.useModel !== false && process.env.ANTHROPIC_API_KEY) {
    try {
      const { intentFromModel } = await import("./llm");
      const intent = await intentFromModel(input, { today, defaultCurrency });
      if (intent) return await finishIntent(intent, { today, defaultCurrency, resolvers, source: "ai" });
    } catch (err) {
      console.warn("[parse-query] model parse failed, using rules:", err instanceof Error ? err.message : err);
    }
  }

  const intent = extractIntent(input, { today, defaultCurrency });
  return finishIntent(intent, { today, defaultCurrency, resolvers, source: "rules" });
}
