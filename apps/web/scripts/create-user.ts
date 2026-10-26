// Make an account; the login page has no sign-up. The password comes from the
// environment so it never lands in shell history:
//   NEW_USER_PASSWORD=... pnpm user:create someone@example.com
// Uses the same ~/db fallback as the app: Turso when TURSO_DATABASE_URL is set, else the local file.
import { createUser } from "~/lib/auth.server";

const [email] = process.argv.slice(2);
const password = process.env.NEW_USER_PASSWORD;
if (!email || !password) {
  console.error("usage: NEW_USER_PASSWORD=... pnpm user:create <email>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("NEW_USER_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const id = await createUser(email, password);
console.log(`Created user ${id} for ${email}.`);
