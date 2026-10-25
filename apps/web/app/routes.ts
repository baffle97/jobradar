import { layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("theme", "routes/theme.ts"),
  route("jobs", "routes/jobs.tsx"),
  route("api/scrape", "routes/api.scrape.ts"),
  route("api/cron/:task", "routes/api.cron.ts"),
  layout("components/app-layout.tsx", [
    route("/", "routes/feed.tsx", { index: true }),
    route("jobs/:id", "routes/job.tsx"),
    route("label", "routes/label.tsx"),
    route("pipeline", "routes/pipeline.tsx"),
    route("settings/profile", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig;
