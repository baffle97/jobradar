import { data, redirect } from "react-router";
import { isTheme, safeRedirect, themeCookie } from "~/lib/ui/theme";
import type { Route } from "./+types/theme";

export function loader() {
  return redirect("/");
}

// Plain form POST (no JS) gets a redirect back; the fetcher (JS) gets data.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const theme = form.get("theme");
  if (!isTheme(theme)) return data({ ok: false as const }, { status: 400 });
  const headers = { "Set-Cookie": themeCookie(theme) };
  if (form.get("js") === "1") return data({ ok: true as const }, { headers });
  return redirect(safeRedirect(form.get("redirectTo")), { headers });
}
