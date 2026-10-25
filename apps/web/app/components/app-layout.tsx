import { Outlet, redirect, useLoaderData } from "react-router";
import { getSessionFromCookie, validateSession } from "~/lib/auth.server";
import { AppShell } from "./app-shell";

export async function loader({ request }: { request: Request }) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (!sessionId) throw redirect("/login");
  const user = await validateSession(sessionId);
  if (!user) throw redirect("/login");
  return { email: user.email };
}

export default function AppLayout() {
  useLoaderData<typeof loader>();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
