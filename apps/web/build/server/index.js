import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, Meta, Links, ScrollRestoration, Scripts, useActionData, useNavigation, Form, redirect, NavLink, useLoaderData } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { HeroUIProvider, Card, CardHeader, CardBody, Input, Button } from "@heroui/react";
import { eq } from "drizzle-orm";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    className: "dark",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      className: "min-h-screen bg-background text-foreground antialiased",
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsx(HeroUIProvider, {
    children: /* @__PURE__ */ jsx(Outlet, {})
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Layout,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => (/* @__PURE__ */ new Date()).toISOString())
});
const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull()
});
const profile = sqliteTable("profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id),
  name: text("name"),
  currentRole: text("current_role"),
  yearsExperience: integer("years_experience"),
  skills: text("skills", { mode: "json" }).$type(),
  targetRoles: text("target_roles", { mode: "json" }).$type(),
  targetLocations: text("target_locations", { mode: "json" }).$type(),
  workMode: text("work_mode"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  embedding: text("embedding", { mode: "json" }).$type(),
  baseResume: text("base_resume", { mode: "json" }),
  telegramChatId: text("telegram_chat_id"),
  alertThreshold: integer("alert_threshold").default(80),
  updatedAt: text("updated_at").notNull().$defaultFn(() => (/* @__PURE__ */ new Date()).toISOString())
});
const jobs$1 = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  description: text("description"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  workMode: text("work_mode"),
  jobType: text("job_type"),
  postedAt: text("posted_at"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  dedupHash: text("dedup_hash").unique(),
  embedding: text("embedding", { mode: "json" }).$type(),
  skills: text("skills", { mode: "json" }),
  matchScore: real("match_score"),
  scoreBreakdown: text("score_breakdown", { mode: "json" }),
  createdAt: text("created_at").notNull().$defaultFn(() => (/* @__PURE__ */ new Date()).toISOString())
});
const savedSearches = sqliteTable("saved_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  filters: text("filters", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => (/* @__PURE__ */ new Date()).toISOString())
});
const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  company: text("company").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => (/* @__PURE__ */ new Date()).toISOString())
});
const taskRuns = sqliteTable("task_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskName: text("task_name").notNull(),
  status: text("status").notNull().default("pending"),
  payload: text("payload", { mode: "json" }),
  result: text("result", { mode: "json" }),
  error: text("error"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => (/* @__PURE__ */ new Date()).toISOString())
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  jobs: jobs$1,
  profile,
  savedSearches,
  sessions,
  taskRuns,
  users,
  watchlist
}, Symbol.toStringTag, { value: "Module" }));
const dbPath = path.resolve(process.cwd(), "data", "jobradar.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedBuffer);
}
function createSession(userId) {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
  db.insert(sessions).values({ id: sessionId, userId, expiresAt }).run();
  return sessionId;
}
function validateSession(sessionId) {
  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session) return null;
  if (new Date(session.expiresAt) < /* @__PURE__ */ new Date()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return null;
  }
  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  return user ?? null;
}
function deleteSession(sessionId) {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
function getSessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/session=([^;]+)/);
  return (match == null ? void 0 : match[1]) ?? null;
}
function sessionCookie(sessionId) {
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}
function clearSessionCookie() {
  return "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}
async function loader$1({
  request
}) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (sessionId && validateSession(sessionId)) {
    throw redirect("/");
  }
  return null;
}
async function action$1({
  request
}) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  if (!email || !password) {
    return {
      error: "Email and password are required."
    };
  }
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    if (!verifyPassword(password, existing.passwordHash)) {
      return {
        error: "Invalid credentials."
      };
    }
    const sessionId2 = createSession(existing.id);
    return redirect("/", {
      headers: {
        "Set-Cookie": sessionCookie(sessionId2)
      }
    });
  }
  const result = db.insert(users).values({
    email,
    passwordHash: hashPassword(password)
  }).returning().get();
  db.insert(profile).values({
    userId: result.id
  }).run();
  const sessionId = createSession(result.id);
  return redirect("/", {
    headers: {
      "Set-Cookie": sessionCookie(sessionId)
    }
  });
}
const login = UNSAFE_withComponentProps(function LoginPage() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx("div", {
    className: "flex min-h-screen items-center justify-center bg-background p-4",
    children: /* @__PURE__ */ jsxs(Card, {
      className: "w-full max-w-md",
      children: [/* @__PURE__ */ jsxs(CardHeader, {
        className: "flex flex-col items-center gap-2 pb-0",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "text-3xl font-bold text-primary",
          children: "JobRadar"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-sm text-default-500",
          children: "AI-Powered Career Intelligence"
        })]
      }), /* @__PURE__ */ jsx(CardBody, {
        className: "gap-4",
        children: /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "flex flex-col gap-4",
          children: [/* @__PURE__ */ jsx(Input, {
            type: "email",
            label: "Email",
            name: "email",
            placeholder: "you@example.com",
            isRequired: true,
            autoFocus: true
          }), /* @__PURE__ */ jsx(Input, {
            type: "password",
            label: "Password",
            name: "password",
            placeholder: "Enter password",
            isRequired: true
          }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("p", {
            className: "text-sm text-danger",
            children: actionData.error
          }), /* @__PURE__ */ jsx(Button, {
            type: "submit",
            color: "primary",
            isLoading: isSubmitting,
            fullWidth: true,
            children: "Sign In"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-center text-xs text-default-400",
            children: "First time? Your account will be created automatically."
          })]
        })
      })]
    })
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: login,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
async function action({
  request
}) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (sessionId) {
    deleteSession(sessionId);
  }
  return redirect("/login", {
    headers: {
      "Set-Cookie": clearSessionCookie()
    }
  });
}
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action
}, Symbol.toStringTag, { value: "Module" }));
const navItems = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/jobs", label: "Jobs", icon: "💼" },
  { to: "/pipeline", label: "Pipeline", icon: "📋" },
  { to: "/settings/profile", label: "Settings", icon: "⚙️" }
];
function Sidebar({ email }) {
  return /* @__PURE__ */ jsxs("aside", { className: "flex h-screen w-64 flex-col border-r border-divider bg-content1 p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold text-primary", children: "JobRadar" }),
      /* @__PURE__ */ jsx("p", { className: "text-xs text-default-500", children: "Career Intelligence" })
    ] }),
    /* @__PURE__ */ jsx("nav", { className: "flex flex-1 flex-col gap-1", children: navItems.map((item) => /* @__PURE__ */ jsxs(
      NavLink,
      {
        to: item.to,
        className: ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-primary/10 font-medium text-primary" : "text-default-600 hover:bg-default-100"}`,
        end: item.to === "/",
        children: [
          /* @__PURE__ */ jsx("span", { children: item.icon }),
          /* @__PURE__ */ jsx("span", { children: item.label })
        ]
      },
      item.to
    )) }),
    /* @__PURE__ */ jsxs("div", { className: "border-t border-divider pt-4", children: [
      /* @__PURE__ */ jsx("p", { className: "mb-2 truncate text-xs text-default-500", children: email }),
      /* @__PURE__ */ jsx(Form, { method: "post", action: "/logout", children: /* @__PURE__ */ jsx(Button, { type: "submit", size: "sm", variant: "flat", fullWidth: true, children: "Sign Out" }) })
    ] })
  ] });
}
async function loader({
  request
}) {
  const sessionId = getSessionFromCookie(request.headers.get("Cookie"));
  if (!sessionId) throw redirect("/login");
  const user = validateSession(sessionId);
  if (!user) throw redirect("/login");
  return {
    email: user.email
  };
}
const appLayout = UNSAFE_withComponentProps(function AppLayout() {
  const {
    email
  } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", {
    className: "flex h-screen",
    children: [/* @__PURE__ */ jsx(Sidebar, {
      email
    }), /* @__PURE__ */ jsx("main", {
      className: "flex-1 overflow-y-auto p-6",
      children: /* @__PURE__ */ jsx(Outlet, {})
    })]
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: appLayout,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const dashboard = UNSAFE_withComponentProps(function DashboardPage() {
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h2", {
      className: "mb-6 text-2xl font-bold",
      children: "Dashboard"
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
      children: [/* @__PURE__ */ jsxs(Card, {
        children: [/* @__PURE__ */ jsx(CardHeader, {
          className: "pb-0",
          children: /* @__PURE__ */ jsx("p", {
            className: "text-sm text-default-500",
            children: "Active Jobs"
          })
        }), /* @__PURE__ */ jsx(CardBody, {
          children: /* @__PURE__ */ jsx("p", {
            className: "text-3xl font-bold",
            children: "—"
          })
        })]
      }), /* @__PURE__ */ jsxs(Card, {
        children: [/* @__PURE__ */ jsx(CardHeader, {
          className: "pb-0",
          children: /* @__PURE__ */ jsx("p", {
            className: "text-sm text-default-500",
            children: "Avg Match Score"
          })
        }), /* @__PURE__ */ jsx(CardBody, {
          children: /* @__PURE__ */ jsx("p", {
            className: "text-3xl font-bold",
            children: "—"
          })
        })]
      }), /* @__PURE__ */ jsxs(Card, {
        children: [/* @__PURE__ */ jsx(CardHeader, {
          className: "pb-0",
          children: /* @__PURE__ */ jsx("p", {
            className: "text-sm text-default-500",
            children: "New This Week"
          })
        }), /* @__PURE__ */ jsx(CardBody, {
          children: /* @__PURE__ */ jsx("p", {
            className: "text-3xl font-bold",
            children: "—"
          })
        })]
      }), /* @__PURE__ */ jsxs(Card, {
        children: [/* @__PURE__ */ jsx(CardHeader, {
          className: "pb-0",
          children: /* @__PURE__ */ jsx("p", {
            className: "text-sm text-default-500",
            children: "Applications"
          })
        }), /* @__PURE__ */ jsx(CardBody, {
          children: /* @__PURE__ */ jsx("p", {
            className: "text-3xl font-bold",
            children: "—"
          })
        })]
      })]
    })]
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard
}, Symbol.toStringTag, { value: "Module" }));
const jobs = UNSAFE_withComponentProps(function JobsPage() {
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h2", {
      className: "mb-6 text-2xl font-bold",
      children: "Job Feed"
    }), /* @__PURE__ */ jsx("p", {
      className: "text-default-500",
      children: "Job listings will appear here once the scraping pipeline is active."
    })]
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: jobs
}, Symbol.toStringTag, { value: "Module" }));
const pipeline = UNSAFE_withComponentProps(function PipelinePage() {
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h2", {
      className: "mb-6 text-2xl font-bold",
      children: "Application Pipeline"
    }), /* @__PURE__ */ jsx("p", {
      className: "text-default-500",
      children: "Your application pipeline will appear here."
    })]
  });
});
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: pipeline
}, Symbol.toStringTag, { value: "Module" }));
const settings = UNSAFE_withComponentProps(function SettingsPage() {
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h2", {
      className: "mb-6 text-2xl font-bold",
      children: "Settings"
    }), /* @__PURE__ */ jsx("p", {
      className: "text-default-500",
      children: "Profile and preferences will be configurable here."
    })]
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: settings
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-DcbeUt3y.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js", "/assets/index-BcejYgu_.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/root-BA_9U4FA.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js", "/assets/index-BcejYgu_.js", "/assets/filter-props-C3fcyhSj.js", "/assets/resolve-transition-BJWjhhQ7.js"], "css": ["/assets/root-BrdyQEz-.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/login": { "id": "routes/login", "parentId": "root", "path": "login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/login-BeTdNxJy.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js", "/assets/chunk-QNLCCAKT-CtU1vkZY.js", "/assets/filter-props-C3fcyhSj.js", "/assets/chunk-6VC6TS2O-1hvmt3Pb.js", "/assets/chunk-JXT5O7F3-D3G4eY-V.js", "/assets/index-BcejYgu_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/logout": { "id": "routes/logout", "parentId": "root", "path": "logout", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": false, "hasErrorBoundary": false, "module": "/assets/logout-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "components/app-layout": { "id": "components/app-layout", "parentId": "root", "path": void 0, "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/app-layout-DzibhEJ5.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js", "/assets/chunk-JXT5O7F3-D3G4eY-V.js", "/assets/filter-props-C3fcyhSj.js", "/assets/chunk-6VC6TS2O-1hvmt3Pb.js", "/assets/index-BcejYgu_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard": { "id": "routes/dashboard", "parentId": "components/app-layout", "path": "/", "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/dashboard-C7Pb_gnd.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js", "/assets/chunk-QNLCCAKT-CtU1vkZY.js", "/assets/chunk-6VC6TS2O-1hvmt3Pb.js", "/assets/filter-props-C3fcyhSj.js", "/assets/index-BcejYgu_.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/jobs": { "id": "routes/jobs", "parentId": "components/app-layout", "path": "jobs", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/jobs-CFln10ah.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/pipeline": { "id": "routes/pipeline", "parentId": "components/app-layout", "path": "pipeline", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/pipeline-DnvfjgId.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/settings": { "id": "routes/settings", "parentId": "components/app-layout", "path": "settings/profile", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/settings-BG0GJPbF.js", "imports": ["/assets/chunk-EVOBXE3Y-zs2oTvzF.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-83c95b39.js", "version": "83c95b39", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_passThroughRequests": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/logout": {
    id: "routes/logout",
    parentId: "root",
    path: "logout",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "components/app-layout": {
    id: "components/app-layout",
    parentId: "root",
    path: void 0,
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/dashboard": {
    id: "routes/dashboard",
    parentId: "components/app-layout",
    path: "/",
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/jobs": {
    id: "routes/jobs",
    parentId: "components/app-layout",
    path: "jobs",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/pipeline": {
    id: "routes/pipeline",
    parentId: "components/app-layout",
    path: "pipeline",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/settings": {
    id: "routes/settings",
    parentId: "components/app-layout",
    path: "settings/profile",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
