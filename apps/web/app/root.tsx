import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetchers,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { isTheme, parseThemeCookie, type Theme } from "~/lib/ui/theme";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap",
  },
];

export function meta() {
  return [{ title: "jobradar" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return { theme: parseThemeCookie(request.headers.get("Cookie")) };
}

// Runs before first paint: marks JS as available (for the highlight sweep) and
// re-applies the theme cookie in case this HTML came from a cache.
const BOOT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add('js');try{var m=document.cookie.match(/(?:^|;\\s*)theme=(light|dark|system)/);var t=m?m[1]:'system';if(t==='system')d.removeAttribute('data-theme');else d.setAttribute('data-theme',t);}catch(e){}})();`;

// The theme being switched to while the request is in flight, so the toggle feels instant.
function usePendingTheme(): Theme | null {
  const fetchers = useFetchers();
  for (const f of fetchers) {
    const value = f.formData?.get("theme");
    if (f.formAction === "/theme" && isTheme(value)) return value;
  }
  return null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = usePendingTheme() ?? data?.theme ?? "system";

  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F3F4F1" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111317" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static boot script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let detail = "Try again in a moment.";
  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Not found" : `Error ${error.status}`;
    detail = error.status === 404 ? "That page or job does not exist." : error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }
  return (
    <main className="jr-login">
      <div className="jr-login__box jr-panel">
        <h1 className="jr-h2">{title}</h1>
        <p className="jr-sub">{detail}</p>
        <p style={{ marginTop: 16 }}>
          <a className="jr-btn" href="/">
            Back to the feed
          </a>
        </p>
      </div>
    </main>
  );
}
