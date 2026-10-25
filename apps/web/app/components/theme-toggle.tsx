import { Monitor, Moon, Sun } from "lucide-react";
import { useFetcher, useLocation, useRouteLoaderData } from "react-router";
import { isTheme, nextTheme, type Theme } from "~/lib/ui/theme";
import { useHydrated } from "./use-hydrated";

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

export function useCurrentTheme(): Theme {
  const root = useRouteLoaderData("root") as { theme?: Theme } | undefined;
  return root?.theme ?? "system";
}

// One button that cycles system -> light -> dark. Works as a plain form POST without JS.
export function ThemeToggle() {
  const fetcher = useFetcher({ key: "theme" });
  const location = useLocation();
  const hydrated = useHydrated();
  const saved = useCurrentTheme();
  const pending = fetcher.formData?.get("theme");
  const theme = isTheme(pending) ? pending : saved;
  const next = nextTheme(theme);
  const Icon = ICONS[theme];

  return (
    <fetcher.Form method="post" action="/theme">
      <input type="hidden" name="theme" value={next} />
      <input type="hidden" name="redirectTo" value={location.pathname + location.search} />
      {hydrated && <input type="hidden" name="js" value="1" />}
      <button
        type="submit"
        className="jr-btn jr-btn--icon"
        aria-label={`Theme: ${theme}. Switch to ${next}.`}
        title={`Theme: ${theme}`}
      >
        <Icon aria-hidden="true" />
      </button>
    </fetcher.Form>
  );
}
