export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function parseThemeCookie(header: string | null): Theme {
  const value = header?.match(/(?:^|;\s*)theme=([a-z]+)/)?.[1];
  return isTheme(value) ? value : "system";
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; SameSite=Lax; Max-Age=${365 * 24 * 60 * 60}`;
}

// Only same-site paths; "//evil.com" would be read as another host.
export function safeRedirect(to: unknown, fallback = "/"): string {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) return fallback;
  return to;
}
