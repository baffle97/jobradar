import { Button } from "@heroui/react";
import { Briefcase, LayoutDashboard, LogOut, Settings, Workflow } from "lucide-react";
import { Form, NavLink } from "react-router";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/settings/profile", label: "Settings", icon: Settings },
];

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-separator bg-surface p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">JobRadar</h1>
        <p className="text-xs text-muted-foreground">Career Intelligence</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`
            }
            end={item.to === "/"}
          >
            <item.icon className="size-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-separator pt-4">
        <p className="mb-2 truncate text-xs text-muted-foreground">{email}</p>
        <Form method="post" action="/logout">
          <Button type="submit" size="sm" variant="ghost" fullWidth>
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </Form>
      </div>
    </aside>
  );
}
