import { Card, CardBody, CardHeader } from "@heroui/react";

export default function DashboardPage() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-0">
            <p className="text-sm text-default-500">Active Jobs</p>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">—</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="pb-0">
            <p className="text-sm text-default-500">Avg Match Score</p>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">—</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="pb-0">
            <p className="text-sm text-default-500">New This Week</p>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">—</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="pb-0">
            <p className="text-sm text-default-500">Applications</p>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">—</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
