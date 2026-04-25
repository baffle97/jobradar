import { redirect } from "react-router";
import { clearSessionCookie, deleteSession, getSessionFromCookie } from "~/lib/auth.server";

export async function action({ request }: { request: Request }) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (sessionId) {
    deleteSession(sessionId);
  }
  return redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
