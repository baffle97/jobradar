import { PassThrough } from "node:stream";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { registerScraperTasks, scheduleScraperCrons } from "~/lib/scrapers";

const ABORT_DELAY = 5_000;

let initialized = false;

function initServer() {
  if (initialized) return;
  initialized = true;

  registerScraperTasks();

  if (process.env.NODE_ENV === "production") {
    scheduleScraperCrons();
    console.log("[server] scraper crons scheduled");
  } else {
    console.log("[server] scraper tasks registered (crons disabled in dev)");
  }
}

initServer();

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");
    const callbackName = userAgent && isbot(userAgent) ? "onAllReady" : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [callbackName]() {
          shellRendered = true;
          const body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(body as unknown as BodyInit, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        },
      } satisfies RenderToPipeableStreamOptions,
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
