import { eq } from "drizzle-orm";
import { Form, redirect, useActionData, useNavigation } from "react-router";
import { ThemeToggle } from "~/components/theme-toggle";
import { db, schema } from "~/db";
import {
  createSession,
  getSessionFromCookie,
  sessionCookie,
  validateSession,
  verifyPassword,
} from "~/lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (sessionId && (await validateSession(sessionId))) {
    throw redirect("/");
  }
  return null;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Sign-ups are closed: only accounts made with `pnpm user:create` can sign in.
  // An unknown email gets the same answer as a wrong password.
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!existing || !verifyPassword(password, existing.passwordHash)) {
    return { error: "Invalid credentials." };
  }

  const sessionId = await createSession(existing.id);
  return redirect("/", {
    headers: { "Set-Cookie": sessionCookie(sessionId) },
  });
}

export function meta() {
  return [{ title: "Sign in · jobradar" }];
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="jr-login">
      <div className="jr-login__box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="jr-logo">
            <span className="jr-logo__mark" aria-hidden="true" />
            jobradar
          </span>
          <ThemeToggle />
        </div>
        <div className="jr-panel" style={{ marginTop: 16 }}>
          <h1 className="jr-h2">Sign in</h1>
          <p className="jr-sub">
            Remote jobs you can actually take from India, each with the line that proves it.
          </p>
          <Form method="post" style={{ display: "grid", gap: 16, marginTop: 20 }}>
            <div>
              <label className="jr-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="jr-input"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>
            <div>
              <label className="jr-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="jr-input"
                type="password"
                name="password"
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </div>
            {actionData?.error ? (
              <p className="jr-status jr-status--err" role="alert" style={{ margin: 0 }}>
                {actionData.error}
              </p>
            ) : null}
            <button
              type="submit"
              className="jr-btn jr-btn--primary jr-btn--block"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
            <p className="jr-sub" style={{ margin: 0, fontSize: 13, textAlign: "center" }}>
              Invite only. There is no sign-up.
            </p>
          </Form>
        </div>
      </div>
    </main>
  );
}
