/**
 * Promote a user to admin by email.
 *
 *   pnpm tsx --env-file=.env.local scripts/make-admin.ts ops@example.com
 *
 * The person must have signed up first. Uses DATABASE_URL directly, so it works without the app running.
 */
import postgres from "postgres";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: tsx --env-file=.env.local scripts/make-admin.ts <email>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Pass --env-file=.env.local or export it.");
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false, max_pipeline: 0, max: 1 });
  try {
    const found = await sql<{ id: string; role: string }[]>`select id, role from booking."user" where lower(email) = ${email} limit 1`;
    if (!found.length) {
      console.error(`No account with the email ${email}. Ask them to sign up first, then run this again.`);
      process.exitCode = 1;
      return;
    }
    const [u] = found;
    if (u.role === "admin") {
      console.log(`${email} is already an admin.`);
      return;
    }
    await sql`update booking."user" set role = 'admin', updated_at = now() where id = ${u.id}`;
    console.log(`${email} is now an admin (was ${u.role}). They may need to reload the page.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
