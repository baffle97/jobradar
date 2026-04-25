import { Button } from "@heroui/react";
import { Form, NavLink } from "react-router";

const navItems = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/jobs", label: "Jobs", icon: "💼" },
  { to: "/pipeline", label: "Pipeline", icon: "📋" },
  { to: "/settings/profile", label: "Settings", icon: "⚙️" },
];

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-divider bg-content1 p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary">JobRadar</h1>
        <p className="text-xs text-default-500">Career Intelligence</p>
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
                  : "text-default-600 hover:bg-default-100"
              }`
            }
            end={item.to === "/"}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-divider pt-4">
        <p className="mb-2 truncate text-xs text-default-500">{email}</p>
        <Form method="post" action="/logout">
          <Button type="submit" size="sm" variant="flat" fullWidth>
            Sign Out
          </Button>
        </Form>
      </div>
    </aside>
  );
}
