import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { eq } from "drizzle-orm";
import { Form, redirect, useActionData, useNavigation } from "react-router";
import { db, schema } from "~/db";
import {
  createSession,
  getSessionFromCookie,
  hashPassword,
  sessionCookie,
  validateSession,
  verifyPassword,
} from "~/lib/auth.server";

export async function loader({ request }: { request: Request }) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (sessionId && validateSession(sessionId)) {
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

  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();

  if (existing) {
    if (!verifyPassword(password, existing.passwordHash)) {
      return { error: "Invalid credentials." };
    }
    const sessionId = createSession(existing.id);
    return redirect("/", {
      headers: { "Set-Cookie": sessionCookie(sessionId) },
    });
  }

  const result = db
    .insert(schema.users)
    .values({ email, passwordHash: hashPassword(password) })
    .returning()
    .get();

  db.insert(schema.profile).values({ userId: result.id }).run();

  const sessionId = createSession(result.id);
  return redirect("/", {
    headers: { "Set-Cookie": sessionCookie(sessionId) },
  });
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 pb-0">
          <h1 className="text-3xl font-bold text-primary">JobRadar</h1>
          <p className="text-sm text-default-500">AI-Powered Career Intelligence</p>
        </CardHeader>
        <CardBody className="gap-4">
          <Form method="post" className="flex flex-col gap-4">
            <Input
              type="email"
              label="Email"
              name="email"
              placeholder="you@example.com"
              isRequired
              autoFocus
            />
            <Input
              type="password"
              label="Password"
              name="password"
              placeholder="Enter password"
              isRequired
            />
            {actionData?.error && <p className="text-sm text-danger">{actionData.error}</p>}
            <Button type="submit" color="primary" isLoading={isSubmitting} fullWidth>
              Sign In
            </Button>
            <p className="text-center text-xs text-default-400">
              First time? Your account will be created automatically.
            </p>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}
