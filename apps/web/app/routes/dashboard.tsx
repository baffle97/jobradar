import { Card } from "@heroui/react";
import { Activity, Briefcase, Sparkles, TrendingUp } from "lucide-react";

const stats = [
  { label: "Active Jobs", value: "—", icon: Briefcase, color: "text-primary" },
  { label: "Avg Match Score", value: "—", icon: Sparkles, color: "text-warning" },
  { label: "New This Week", value: "—", icon: TrendingUp, color: "text-success" },
  { label: "Applications", value: "—", icon: Activity, color: "text-secondary" },
];

export default function DashboardPage() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <Card.Header className="flex flex-row items-center justify-between pb-0">
              <Card.Description>{stat.label}</Card.Description>
              <stat.icon className={`size-5 ${stat.color}`} />
            </Card.Header>
            <Card.Content>
              <p className="text-3xl font-bold">{stat.value}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
}
