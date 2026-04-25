import { Outlet, redirect, useLoaderData } from "react-router";
import { getSessionFromCookie, validateSession } from "~/lib/auth.server";
import { Sidebar } from "./sidebar";

export async function loader({ request }: { request: Request }) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (!sessionId) throw redirect("/login");
  const user = validateSession(sessionId);
  if (!user) throw redirect("/login");
  return { email: user.email };
}

export default function AppLayout() {
  const { email } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-screen">
      <Sidebar email={email} />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
