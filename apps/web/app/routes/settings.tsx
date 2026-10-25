import { Form, useFetcher, useLoaderData, useLocation } from "react-router";
import { useCurrentTheme } from "~/components/theme-toggle";
import { getSessionFromCookie, validateSession } from "~/lib/auth.server";
import { countLabels, LABEL_TARGET } from "~/lib/labels.server";
import { THEMES } from "~/lib/ui/theme";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Profile · jobradar" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  const user = sessionId ? await validateSession(sessionId) : null;
  return { email: user?.email ?? "", labelled: await countLabels(), target: LABEL_TARGET };
}

const TASKS: Record<string, string> = {
  "scrape:all": "All job boards",
  "ingest:ats": "Company boards (ATS)",
  "scrape:hn": "HN Who's Hiring",
  "discover:yc": "Discover YC boards",
  "eligibility:check": "Eligibility check",
};

function RunTask() {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const busy = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post" action="/api/scrape">
      <label className="jr-label" htmlFor="task">
        Run a task now
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <select id="task" name="task" className="jr-select" defaultValue="ingest:ats">
          {Object.entries(TASKS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="jr-btn" disabled={busy}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      <p
        className={`jr-status ${fetcher.data?.ok ? "jr-status--ok" : fetcher.data?.error ? "jr-status--err" : ""}`}
        role="status"
        aria-live="polite"
      >
        {busy
          ? "Running. This can take a few minutes."
          : fetcher.data?.ok
            ? "Done."
            : (fetcher.data?.error ?? "")}
      </p>
    </fetcher.Form>
  );
}

export default function SettingsPage() {
  const { email, labelled, target } = useLoaderData<typeof loader>();
  const theme = useCurrentTheme();
  const location = useLocation();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>
      <div>
        <h1 className="jr-h1">Profile</h1>
        <p className="jr-sub" style={{ overflowWrap: "anywhere" }}>
          Signed in as {email}
        </p>
      </div>

      <section className="jr-panel">
        <h2 className="jr-h2" style={{ fontSize: 16 }}>
          Theme
        </h2>
        <Form method="post" action="/theme" className="jr-choice" style={{ marginTop: 10 }}>
          <input type="hidden" name="redirectTo" value={location.pathname} />
          {THEMES.map((t) => (
            <button
              key={t}
              type="submit"
              name="theme"
              value={t}
              className={`jr-btn ${theme === t ? "jr-btn--primary" : ""}`}
              aria-pressed={theme === t}
              style={{ textTransform: "capitalize" }}
            >
              {t}
            </button>
          ))}
        </Form>
      </section>

      <section className="jr-panel">
        <h2 className="jr-h2" style={{ fontSize: 16 }}>
          Eval labels
        </h2>
        <p className="jr-sub">
          <span className="mono" style={{ color: "var(--ink)" }}>
            {labelled} / {target}
          </span>{" "}
          hand labels saved. Export them with <code className="mono">pnpm labels:export</code>.
        </p>
      </section>

      <section className="jr-panel">
        <h2 className="jr-h2" style={{ fontSize: 16 }}>
          Admin
        </h2>
        <div style={{ marginTop: 10 }}>
          <RunTask />
        </div>
      </section>

      <Form method="post" action="/logout">
        <button type="submit" className="jr-btn jr-btn--block">
          Sign out
        </button>
      </Form>
    </div>
  );
}
