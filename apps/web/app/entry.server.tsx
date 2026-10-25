import { handleRequest } from "@vercel/react-router/entry.server";
import type { AppLoadContext, EntryContext } from "react-router";
import { registerScraperTasks, scheduleScraperCrons } from "~/lib/scrapers";

let initialized = false;

function initServer() {
  if (initialized) return;
  initialized = true;

  registerScraperTasks();

  // Vercel functions don't stay alive between requests; vercel.json crons hit /api/cron instead.
  if (process.env.VERCEL) {
    console.log("[server] scraper tasks registered (crons run via Vercel Cron)");
  } else if (process.env.NODE_ENV === "production") {
    scheduleScraperCrons();
    console.log("[server] scraper crons scheduled");
  } else {
    console.log("[server] scraper tasks registered (crons disabled in dev)");
  }
}

initServer();

export default function (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext?: AppLoadContext,
) {
  return handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext);
}
