import { redirect } from "react-router";
import type { Route } from "./+types/jobs";

// The feed moved to "/". Old links (and their ?search=) keep working.
export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const next = new URLSearchParams();
  const q = url.searchParams.get("q") ?? url.searchParams.get("search");
  if (q) next.set("q", q);
  const v = url.searchParams.get("v");
  if (v) next.set("v", v);
  const s = next.toString();
  return redirect(s ? `/?${s}` : "/", 301);
}
