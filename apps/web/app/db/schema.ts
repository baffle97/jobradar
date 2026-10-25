import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
});

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  name: text("name"),
  currentRole: text("current_role"),
  yearsExperience: integer("years_experience"),
  skills: text("skills", { mode: "json" }).$type<string[]>(),
  targetRoles: text("target_roles", { mode: "json" }).$type<string[]>(),
  targetLocations: text("target_locations", { mode: "json" }).$type<string[]>(),
  workMode: text("work_mode"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  embedding: text("embedding", { mode: "json" }).$type<number[]>(),
  baseResume: text("base_resume", { mode: "json" }),
  telegramChatId: text("telegram_chat_id"),
  alertThreshold: integer("alert_threshold").default(80),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// One row per company job board on an ATS (Ashby / Greenhouse / Lever).
// Boards are discovered from HN threads and YC, then polled directly.
export const companyBoards = sqliteTable(
  "company_boards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ats: text("ats").notNull(),
    token: text("token").notNull(),
    companyName: text("company_name"),
    discoveredFrom: text("discovered_from").notNull(),
    // pending | ok | not_found | error
    status: text("status").notNull().default("pending"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastError: text("last_error"),
    lastPolledAt: text("last_polled_at"),
    jobCount: integer("job_count"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("company_boards_ats_token").on(t.ats, sql`lower(${t.token})`)],
);

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  locations: text("locations", { mode: "json" }).$type<string[]>(),
  country: text("country"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency"),
  salaryText: text("salary_text"),
  description: text("description"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  applyUrl: text("apply_url"),
  boardId: integer("board_id").references(() => companyBoards.id),
  externalId: text("external_id"),
  lastSeenAt: text("last_seen_at"),
  workMode: text("work_mode"),
  jobType: text("job_type"),
  postedAt: text("posted_at"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  dedupHash: text("dedup_hash").unique(),
  embedding: text("embedding", { mode: "json" }).$type<number[]>(),
  skills: text("skills", { mode: "json" }),
  matchScore: real("match_score"),
  scoreBreakdown: text("score_breakdown", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const savedSearches = sqliteTable("saved_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  filters: text("filters", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  company: text("company").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const taskRuns = sqliteTable("task_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskName: text("task_name").notNull(),
  status: text("status").notNull().default("pending"),
  payload: text("payload", { mode: "json" }),
  result: text("result", { mode: "json" }),
  error: text("error"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
