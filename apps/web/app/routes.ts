import { layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  layout("components/app-layout.tsx", [
    route("/", "routes/dashboard.tsx", { index: true }),
    route("jobs", "routes/jobs.tsx"),
    route("pipeline", "routes/pipeline.tsx"),
    route("settings/profile", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
