import { Inbox, ListChecks, Newspaper, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  {
    to: "/",
    label: "Feed",
    icon: Newspaper,
    match: (p: string) => p === "/" || p.startsWith("/jobs"),
  },
  { to: "/label", label: "Label", icon: ListChecks, match: (p: string) => p.startsWith("/label") },
  { to: "/pipeline", label: "Saved", icon: Inbox, match: (p: string) => p.startsWith("/pipeline") },
  {
    to: "/settings/profile",
    label: "Profile",
    icon: UserRound,
    match: (p: string) => p.startsWith("/settings"),
  },
];

// Phone: compact top bar + bottom tab bar (thumb reach). >= 768px: top bar with the nav inline.
export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <>
      <a className="jr-skip" href="#main">
        Skip to content
      </a>
      <header className="jr-top">
        <div className="jr-top__in">
          <Link to="/" className="jr-logo" aria-label="jobradar, feed">
            <span className="jr-logo__mark" aria-hidden="true" />
            jobradar
          </Link>
          <nav className="jr-topnav" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.match(pathname) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="jr-top__end">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="jr-main" id="main">
        {children}
      </main>

      <nav className="jr-tabs" aria-label="Main">
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <Link to={item.to} aria-current={item.match(pathname) ? "page" : undefined}>
                <item.icon aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
