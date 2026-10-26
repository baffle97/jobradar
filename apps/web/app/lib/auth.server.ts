import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { db, schema } from "~/db";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedBuffer);
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.insert(schema.sessions).values({ id: sessionId, userId, expiresAt }).run();

  return sessionId;
}

export async function validateSession(sessionId: string) {
  const session = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .get();

  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    return null;
  }

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .get();

  return user ?? null;
}

// The only way to make an account (the login page has no sign-up), used by
// `pnpm user:create`. Refuses an email that already has one.
export async function createUser(email: string, password: string): Promise<number> {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) throw new Error(`An account for ${email} already exists.`);
  const user = await db
    .insert(schema.users)
    .values({ email, passwordHash: hashPassword(password) })
    .returning()
    .get();
  await db.insert(schema.profile).values({ userId: user.id }).run();
  return user.id;
}

export async function deleteSession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; nothing passes when it is unset.
export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("Authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Session cookie for the UI, cron secret for schedulers and scripts.
export async function isAuthorized(request: Request): Promise<boolean> {
  if (hasCronSecret(request)) return true;
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  return sessionId !== null && (await validateSession(sessionId)) !== null;
}

export function getSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/session=([^;]+)/);
  return match?.[1] ?? null;
}

export function sessionCookie(sessionId: string): string {
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

export function clearSessionCookie(): string {
  return "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

// For route actions: a POST to a child route does not run the layout's loader,
// so every action that writes must check the session itself.
export async function requireUser(request: Request) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  const user = sessionId ? await validateSession(sessionId) : null;
  if (!user) throw redirect("/login");
  return user;
}
