import "server-only";
import { z } from "zod";

/**
 * Server environment. Optional values switch features off rather than crash,
 * so the site can run with only DATABASE_URL and BETTER_AUTH_SECRET set.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  DUFFEL_ACCESS_TOKEN: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** "true" enables the simulated test payment provider even in production builds. Never set it on the live site. */
  ALLOW_TEST_PAYMENTS: z.enum(["true", "false"]).optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-5-5"),

  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  INDEXNOW_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const features = {
  flights: () => Boolean(process.env.DUFFEL_ACCESS_TOKEN),
  razorpay: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  stripe: () => Boolean(process.env.STRIPE_SECRET_KEY),
  /** Simulated payments: on outside production, or when ALLOW_TEST_PAYMENTS=true. Never otherwise. */
  testPayments: () => process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_PAYMENTS === "true",
  email: () => Boolean(process.env.RESEND_API_KEY),
  google: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  ai: () => Boolean(process.env.ANTHROPIC_API_KEY),
  blob: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),
};
