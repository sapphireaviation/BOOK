import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { site } from "@/config/site";
import { sendEmail } from "@/server/email/send";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {};

export const auth = betterAuth({
  appName: site.name,
  baseURL: process.env.BETTER_AUTH_URL ?? site.url,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        template: "reset-password",
        subject: `Reset your ${site.name} password`,
        text: `Use this link to set a new password. It works for one hour.\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
        html: `<p>Use this link to set a new password. It works for one hour.</p><p><a href="${url}">Set a new password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
      });
    },
  },
  socialProviders: google,
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "traveler", input: false },
      phone: { type: "string", required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          template: "magic-link",
          subject: `Your ${site.name} sign in link`,
          text: `Use this link to sign in. It works for 5 minutes.\n\n${url}`,
          html: `<p>Use this link to sign in. It works for 5 minutes.</p><p><a href="${url}">Sign in</a></p>`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type Role = "traveler" | "host" | "admin";

/** Current session or null. Reads cookies, so call it inside a Suspense boundary. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/** Throws AuthError unless signed in (and, if given, holding one of the roles). */
export async function requireUser(roles?: Role[]) {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Sign in to continue.");
  const role = (session.user as { role?: Role }).role ?? "traveler";
  if (roles && !roles.includes(role) && role !== "admin") throw new AuthError(403, "You do not have access to this.");
  return { ...session, role };
}
