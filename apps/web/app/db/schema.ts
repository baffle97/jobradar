import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Hint } from "../lib/eligibility/types";

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
  // Role tags from the title, space-padded: " ai eng ", " nontech " (roleTags in
  // lib/ui/roles.ts). Written with the title; null until backfill:roles runs.
  roles: text("roles"),
  skills: text("skills", { mode: "json" }),
  matchScore: real("match_score"),
  scoreBreakdown: text("score_breakdown", { mode: "json" }),
  // Latest eligibility result (can someone in India do this remotely?). The full
  // history lives in eligibility_checks.
  eligibility: text("eligibility"), // eligible | not_eligible | unclear
  eligibilityEvidence: text("eligibility_evidence"),
  eligibilityReason: text("eligibility_reason"),
  eligibilityMethod: text("eligibility_method"), // rules | llm
  eligibilityBasis: text("eligibility_basis"), // explicit | hints | null (unclear)
  // Verified hints, JSON array; null on rows checked before elig-v0.4.
  eligibilityHints: text("eligibility_hints", { mode: "json" }).$type<Hint[]>(),
  // PROMPT_VERSION of the latest result; null means "re-check on the next run".
  eligibilityVersion: text("eligibility_version"),
  // Hash of the posting text the latest result was computed from.
  eligibilityInputHash: text("eligibility_input_hash"),
  eligibilityCheckedAt: text("eligibility_checked_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Audit trail: one row per eligibility check, never updated.
export const eligibilityChecks = sqliteTable(
  "eligibility_checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id),
    verdict: text("verdict").notNull(),
    evidence: text("evidence"),
    reason: text("reason").notNull(),
    method: text("method").notNull(),
    basis: text("basis"),
    hints: text("hints", { mode: "json" }).$type<Hint[]>(),
    model: text("model"),
    promptVersion: text("prompt_version").notNull(),
    inputHash: text("input_hash").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [index("eligibility_checks_job_id").on(t.jobId)],
);

// The user's hand labels, the ground truth for `pnpm eval:eligibility`.
export const eligibilityLabels = sqliteTable("eligibility_labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .unique()
    .references(() => jobs.id),
  label: text("label").notNull(), // eligible | not_eligible | unclear
  note: text("note"),
  labelledAt: text("labelled_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Jobs a user saved, and how far their application got (lib/ui/saved.ts).
export const savedJobs = sqliteTable(
  "saved_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id),
    status: text("status").notNull().default("saved"), // saved | applied | interviewing | offer | rejected
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [uniqueIndex("saved_jobs_user_job").on(t.userId, t.jobId)],
);

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
