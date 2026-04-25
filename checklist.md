# JobRadar — Build Checklist

> **Single-user AI-powered career intelligence tool.**
> Built entirely by AI, tracked sprint-by-sprint.
>
> **Status legend:** `[ ]` = not started | `[~]` = in progress | `[x]` = done | `[-]` = cut/deferred

---

## Data Sources

| Source | Type | Free Tier | Rate Limits | Notes |
|--------|------|-----------|-------------|-------|
| Adzuna API | REST API | 250 req/day | Per-day cap | Requires API key signup. Covers US, UK, IN, DE, etc. |
| Remotive API | REST API | Free, no key | 2 req/min, recommended few times/day | Remote-only jobs. Must attribute Remotive, link back. No reposting to aggregators. |
| JSearch (RapidAPI) | REST API | 200 req/month (free) | Per-month cap | LinkedIn, Indeed, Glassdoor aggregated. Good for breadth. |
| HN Who's Hiring | Web scrape | Free | Monthly thread | Parse top-level comments from monthly HN thread via HN API. |

---

## Sprint 0 — Project Scaffolding
**Goal:** Empty but runnable monorepo. Everything compiles, deploys to free tiers, auth works.

- [x] Initialize pnpm monorepo at `/jobradar`
  - [x] Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
  - [x] Biome config (double quotes, 2-space indent, trailing commas, semicolons)
  - [x] `.gitignore` (node_modules, .env*, dist)
- [x] `apps/web` — React Router 7 SSR app
  - [x] Vite + React Router 7 + React 19 setup
  - [x] HeroUI + Tailwind CSS 4 integration
  - [x] Zustand installed, empty root store
  - [x] Basic layout shell (sidebar nav + content area)
  - [x] Auth gate — redirect to login if not authenticated
  - [x] Login page with Supabase email magic link
  - [ ] Deploy to Vercel free tier (confirm it runs)
- [x] `apps/web/app/db` — SQLite + Drizzle ORM (replaced Supabase)
  - [x] SQLite database with better-sqlite3 + Drizzle ORM
  - [x] Schema: users, sessions, profile, jobs, saved_searches, watchlist tables
  - [x] Server-side cookie auth (scrypt password hashing, session tokens)
  - [x] Initial migration generated and applied
  - [x] Drizzle Kit config for migrations (`pnpm db:generate`, `pnpm db:migrate`)
- [x] In-process task scheduler (replaced Trigger.dev)
  - [x] `croner` for cron scheduling (zero external deps)
  - [x] SQLite-backed `task_runs` table for run history/tracking
  - [x] `defineTask` / `runTask` / `scheduleCron` API
- [x] `packages/shared` — Shared types and utilities
  - [x] Shared Zod schemas (job, profile, filters, applicationStatus, extractedSkill)
- [x] CI/CD
  - [x] GitHub repo created
  - [x] GitHub Action: lint + typecheck on PR
  - [ ] Vercel auto-deploy from `main`
- [x] Environment & config
  - [x] `.env.example` with all required keys documented
  - [x] Config for API keys, Telegram bot token, session secret

---

## Sprint 1 — Job Scraping Pipeline
**Goal:** Jobs flowing into the database from multiple sources. Deduplicated and normalized.

- [ ] Database schema
  - [ ] `jobs` table with all fields (title, company, location, salary, description, source, source_url, work_mode, posted_at, is_active, dedup_hash, embedding, skills, match_score)
  - [ ] Indexes: dedup_hash unique, embedding ivfflat, match_score descending
  - [ ] `saved_searches` table
  - [ ] `watchlist` table (company watchlist)
- [ ] Adzuna scraper (scheduled task)
  - [ ] API client with key auth
  - [ ] Fetch jobs by category (software, engineering, IT)
  - [ ] Normalize response into `jobs` table schema
  - [ ] Dedup hash: md5(lower(title) + lower(company) + lower(location))
  - [ ] Upsert into DB (skip existing dedup_hash)
  - [ ] Cron schedule: every 4 hours
- [ ] Remotive scraper (scheduled task)
  - [ ] Fetch from `https://remotive.com/api/remote-jobs?category=software-dev`
  - [ ] Normalize fields (map `candidate_required_location` to `location`, parse `salary`, strip HTML from `description`)
  - [ ] Dedup + upsert
  - [ ] Cron schedule: every 6 hours (respect 2 req/min limit)
- [ ] JSearch scraper (scheduled task)
  - [ ] RapidAPI client setup
  - [ ] Fetch software engineering jobs (budget 200 req/month wisely — 6-7 req/day)
  - [ ] Normalize + dedup + upsert
  - [ ] Cron schedule: twice daily
- [ ] HN Who's Hiring parser (scheduled task)
  - [ ] Detect current month's "Who's Hiring" thread via HN API
  - [ ] Fetch all top-level comments
  - [ ] LLM extraction (Gemini Flash): parse each comment into structured job (company, role, location, salary, url, description)
  - [ ] Dedup + upsert
  - [ ] Cron schedule: 1st and 15th of each month
- [ ] Stale job cleanup (scheduled task)
  - [ ] Mark jobs older than 30 days as `is_active = false`
  - [ ] Cron schedule: daily at 3am UTC
- [ ] Job processing pipeline (triggered on new job insert)
  - [ ] Embed job (title + company + description snippet) using Gemini text-embedding-004
  - [ ] Store embedding in `jobs.embedding` column
  - [ ] Cosine similarity dedup check: if embedding similarity > 0.95 with existing job, mark as duplicate
- [ ] Verification
  - [ ] Manually trigger each scraper, confirm jobs land in DB
  - [ ] Confirm dedup works (no exact or near-duplicates)
  - [ ] Confirm cron schedules fire correctly

---

## Sprint 2 — Job Feed UI
**Goal:** Browse all scraped jobs in a clean, filterable feed. No AI scoring yet — just raw listings.

- [ ] Job feed page (`/jobs`)
  - [ ] Fetch jobs from Supabase, paginated (20 per page)
  - [ ] Job card component: title, company, location, salary, source badge, posted date
  - [ ] Sort by: newest first (default), salary high-to-low
  - [ ] "New" badge for jobs added since last visit (localStorage timestamp)
  - [ ] Freshness decay: jobs > 14 days old visually dimmed
  - [ ] Click to expand: full description, apply link (opens source_url)
  - [ ] Infinite scroll or load-more pagination
- [ ] Filters sidebar
  - [ ] Text search (title, company — Supabase `ilike`)
  - [ ] Work mode: remote / hybrid / onsite / any
  - [ ] Location text filter
  - [ ] Salary range slider (min-max)
  - [ ] Source filter: Adzuna, Remotive, JSearch, HN (multi-select)
  - [ ] Job type: full-time, contract, part-time (if available from source)
  - [ ] Filters persist in URL query params (shareable/bookmarkable)
- [ ] Saved searches
  - [ ] "Save this search" button stores current filter combo
  - [ ] Saved searches dropdown in sidebar for quick access
  - [ ] Delete saved search
- [ ] Company watchlist
  - [ ] "Watch this company" button on job cards
  - [ ] Watchlist page showing tracked companies + latest jobs from each
- [ ] Empty/loading states
  - [ ] Skeleton loaders while fetching
  - [ ] Empty state when no jobs match filters
- [ ] Mobile responsive
  - [ ] Filters collapse into a drawer on mobile
  - [ ] Job cards stack vertically

---

## Sprint 3 — User Profile & Onboarding
**Goal:** Capture who you are so we can score jobs against your profile.

- [ ] Profile setup wizard (first login flow)
  - [ ] Step 1: Basic info (name, current role title, years of experience)
  - [ ] Step 2: Skills (searchable multi-select with autocomplete, add custom skills)
  - [ ] Step 3: Preferences (target roles, target locations, work mode, salary range)
  - [ ] Step 4: Telegram setup (show bot link, input chat_id, send test message)
  - [ ] Save all to `profile` table
- [ ] Profile edit page (`/settings/profile`)
  - [ ] Edit all fields from wizard
  - [ ] "Update profile" saves and triggers re-embedding + re-scoring
- [ ] Profile embedding
  - [ ] On profile save: embed (skills + target_roles + experience) via Gemini text-embedding-004
  - [ ] Store in `profile.embedding`
- [ ] Base resume upload
  - [ ] Structured resume builder (not file upload — structured JSONB)
  - [ ] Sections: work experience (company, title, dates, bullets), education, projects, certifications
  - [ ] Store in `profile.base_resume` as JSONB
  - [ ] Edit/reorder resume sections inline
- [ ] Telegram bot setup
  - [ ] Create Telegram bot via BotFather
  - [ ] `/start` command sends chat_id back to web app
  - [ ] Test notification button in settings
  - [ ] Store `telegram_chat_id` in profile

---

## Sprint 4 — AI Skill Extraction & Match Scoring
**Goal:** Every job gets a structured skill profile and a personal match score.

- [ ] AI skill extraction (scheduled task)
  - [ ] Input: job description text
  - [ ] Model: Gemini 2.5 Flash with structured output (Zod schema)
  - [ ] Extract: skills (name + category + must/nice-to-have), experience_level (junior/mid/senior/lead/staff), work_mode if not already set
  - [ ] Store extracted skills in `jobs.skills` JSONB
  - [ ] Run on all existing jobs (backfill), then on each new job insert
- [ ] Skill taxonomy
  - [ ] `skills` table: aggregate extracted skills across all jobs
  - [ ] Merge duplicates (e.g., "React.js" = "React" = "ReactJS")
  - [ ] Parent-child relationships (React -> JavaScript, Kubernetes -> DevOps)
  - [ ] Update `demand_count` on each extraction run
  - [ ] Scheduled task: `update_skill_taxonomy` (daily)
- [ ] Match scoring algorithm
  - [ ] Supabase RPC function: `compute_match_score(job_id, profile_id)`
  - [ ] Weighted formula:
    - 40% — skill overlap (count of user skills matching job skills / total required skills)
    - 20% — experience fit (user years vs job level expectations)
    - 15% — location match (user preference vs job location/work_mode)
    - 15% — salary fit (job salary range overlaps user target range)
    - 10% — embedding similarity (cosine between profile and job embeddings)
  - [ ] Store score in `jobs.match_score` and breakdown in `jobs.score_breakdown`
- [ ] Batch scoring (scheduled task)
  - [ ] `score_all_jobs`: re-score all active jobs against profile
  - [ ] Triggered on: profile update, new jobs ingested
  - [ ] Chunked processing (50 jobs per batch to stay in free tier)
- [ ] UI updates
  - [ ] Match score badge on each job card (color-coded: green >80, yellow 60-80, gray <60)
  - [ ] Sort option: "Best match" (match_score DESC)
  - [ ] Filter: minimum match score slider
  - [ ] Job detail: show skill breakdown (matched skills highlighted green, missing skills red)
  - [ ] Job detail: show score breakdown chart (radar or bar)

---

## Sprint 5 — Market Intelligence Dashboard
**Goal:** Trend charts, salary data, skill gap analysis. Your career radar.

- [ ] Market data aggregation (scheduled task)
  - [ ] `compute_market_stats`: daily cron
  - [ ] Count jobs per skill per day -> insert into `market_snapshots`
  - [ ] Compute average salary per skill per day
  - [ ] Compute demand_trend on `skills` table (% change vs 30 days ago)
- [ ] Dashboard page (`/dashboard`)
  - [ ] Summary cards at top:
    - Total active jobs matching your profile
    - Average match score
    - Jobs added this week
    - Applications in pipeline
  - [ ] Skill demand trends chart (Recharts line chart)
    - Your skills highlighted in bold
    - Show last 30/60/90 days
    - Indicate trending up/down with arrows
  - [ ] Salary distribution chart (Recharts bar chart)
    - By role type, by location
    - Your target range overlaid
  - [ ] Skill gap analysis
    - Top skills in your target roles that you DON'T have
    - Sorted by demand frequency
    - "Learn this" actionable list
  - [ ] Company activity
    - Watchlisted companies: jobs posted this week
    - Hiring velocity (jobs/week trend)
- [ ] Mobile responsive dashboard
  - [ ] Cards stack, charts scroll horizontally

---

## Sprint 6 — AI Resume Tailoring
**Goal:** One-click resume adaptation per job. Cover letter generation. PDF export.

- [ ] Resume tailoring (scheduled task)
  - [ ] Input: base_resume (from profile) + job description + extracted skills
  - [ ] Model: Gemini 2.5 Pro (highest quality for writing)
  - [ ] Process:
    1. Analyze JD: extract key requirements, culture signals, ATS keywords
    2. Gap map: which resume bullets align, which need reframing
    3. Rewrite: adapt bullet points to lead with relevant impact, mirror JD language
    4. Output: structured JSONB (same schema as base_resume, but tailored)
  - [ ] Store in `applications.tailored_resume`
- [ ] Cover letter generation (scheduled task)
  - [ ] Input: tailored_resume + job description + company info
  - [ ] Model: Gemini 2.5 Flash (fast, good enough for covers)
  - [ ] Output: markdown text, references specific role and company details
  - [ ] Store in `applications.cover_letter`
- [ ] Resume review UI (`/applications/:id/resume`)
  - [ ] Side-by-side: original resume vs tailored version
  - [ ] Diff highlighting: changed bullets marked
  - [ ] Inline editing: user can tweak any bullet before export
  - [ ] Cover letter tab: editable markdown
- [ ] PDF export
  - [ ] `@react-pdf/renderer` for client-side PDF generation
  - [ ] ATS-friendly template: clean fonts, standard sections, no columns/tables
  - [ ] Download as PDF button
  - [ ] Cover letter as separate PDF
- [ ] "Tailor for this job" button on job cards
  - [ ] Creates application record (status: `resume_tailored`)
  - [ ] Triggers tailoring + cover letter tasks
  - [ ] Shows loading state, then redirects to review page

---

## Sprint 7 — Application Pipeline
**Goal:** Kanban board tracking every application from discovery to outcome.

- [ ] Database
  - [ ] `applications` table (if not already from Sprint 6)
  - [ ] Status enum: discovered -> resume_tailored -> in_review -> applied -> tracking -> offer / rejected / ghosted
  - [ ] `notifications` table for reminders
- [ ] Pipeline page (`/pipeline`)
  - [ ] Kanban board view (columns = statuses)
  - [ ] Drag-and-drop cards between columns
  - [ ] Card shows: company, role, match score, days in stage
  - [ ] Click card to expand: full details, resume, cover letter, notes, timeline
- [ ] Application actions
  - [ ] "Mark as applied": set status, log applied_at date, set follow_up_at = +7 days
  - [ ] "Add notes": free-text notes per application
  - [ ] "Mark outcome": offer / rejected / ghosted
  - [ ] "Snooze follow-up": push reminder by N days
- [ ] List view toggle
  - [ ] Table view alternative to kanban: sortable columns, bulk actions
- [ ] Stats
  - [ ] Pipeline summary: N discovered, N in review, N applied, N offers, N rejected
  - [ ] Response rate: offers / total applied
  - [ ] Average time in each stage

---

## Sprint 8 — Alerts & Telegram Notifications
**Goal:** Proactive notifications. Don't check the dashboard — let it come to you.

- [ ] Alert engine (scheduled tasks)
  - [ ] `check_high_match_alerts`: runs after job scoring
    - If any new job scores above `profile.alert_threshold` (default 80)
    - Send Telegram message with job summary + match score
    - Log to `notifications` table
  - [ ] `check_watchlist_alerts`: runs after job scraping
    - If any new job from a watchlisted company
    - Send Telegram alert
  - [ ] `send_follow_up_reminder`: daily cron
    - Query applications where `follow_up_at <= now()` and status = 'applied' or 'tracking'
    - Send Telegram reminder
  - [ ] `send_weekly_digest`: Sunday 6pm cron
    - Aggregate: new matches this week, pipeline status, top trending skills
    - Send as formatted Telegram message
  - [ ] `check_market_shift`: weekly cron
    - If any skill in user's profile spiked >20% demand or dropped >20%
    - Send Telegram alert
- [ ] Telegram bot commands
  - [ ] `/start` — Register chat_id
  - [ ] `/status` — Pipeline summary (N applied, N pending, N offers)
  - [ ] `/top` — Top 5 highest-match jobs right now
  - [ ] `/mute` — Pause alerts for N hours
  - [ ] `/unmute` — Resume alerts
- [ ] Email alerts (Resend free tier — 100/day)
  - [ ] Weekly digest as HTML email (React Email template)
  - [ ] High-match alert email (optional, user toggleable)
- [ ] In-app notification center
  - [ ] Bell icon in navbar with unread count
  - [ ] Notification dropdown: recent alerts, click to navigate
  - [ ] Mark as read / mark all read
- [ ] Alert preferences (`/settings/alerts`)
  - [ ] Toggle each alert type on/off
  - [ ] Set match threshold slider (default 80%)
  - [ ] Choose channels per alert type (Telegram / email / in-app)
  - [ ] Quiet hours (no Telegram between 11pm-7am)

---

## Sprint 9 — Polish & Quality of Life
**Goal:** Make it feel finished. Fix rough edges, add small features that compound.

- [ ] Semantic search on job feed
  - [ ] "Search by meaning" toggle: embed user query via Gemini, cosine search against job embeddings
  - [ ] Falls back to text search when toggle is off
- [ ] Job comparison
  - [ ] Select 2-3 jobs, side-by-side comparison view
  - [ ] Compare: skills required, salary, match score, location
- [ ] Keyboard shortcuts
  - [ ] `j/k` to navigate job list
  - [ ] `s` to save/unsave
  - [ ] `t` to tailor resume
  - [ ] `Enter` to expand job detail
  - [ ] `Esc` to close
- [ ] Dark mode
  - [ ] HeroUI dark theme toggle
  - [ ] Persisted in localStorage
- [ ] Data export
  - [ ] Export all applications as CSV
  - [ ] Export job feed as CSV (with filters applied)
- [ ] Bulk actions
  - [ ] Select multiple jobs -> bulk save, bulk skip, bulk tailor
- [ ] Performance
  - [ ] Virtual scrolling on job feed (react-virtuoso)
  - [ ] Skeleton loaders everywhere
  - [ ] Optimistic UI updates on pipeline drag-and-drop
- [ ] Error handling
  - [ ] Toast notifications for actions (saved, tailored, applied, errors)
  - [ ] Retry failed tasks with backoff
  - [ ] Graceful handling when Gemini rate-limited (queue and retry)

---

## Future / Backlog (Not Scheduled)

These are ideas worth tracking but not committed to any sprint.

- [ ] Browser extension: "Add to JobRadar" button on any job listing page
- [ ] LinkedIn integration: import profile to seed base resume
- [ ] Interview prep: AI-generated practice questions based on JD
- [ ] Salary negotiation assistant: given offer + market data, suggest counter
- [ ] Application auto-fill: browser extension pre-fills common application forms
- [ ] Multi-resume support: different base resumes for different role types
- [ ] AI cover letter voice tuning: formal / conversational / enthusiastic
- [ ] GitHub activity analysis: auto-extract skills from your repos
- [ ] Referral network: flag jobs where you have LinkedIn connections at the company
- [ ] Calendar integration: interview scheduling from pipeline

---

## Infrastructure Costs (Monthly Estimate)

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| Vercel (web hosting) | 100GB bandwidth | ~1GB | $0 |
| Supabase (DB + auth) | 500MB DB, 1GB storage | ~50MB | $0 |
| Gemini API (AI) | 15 RPM Flash / 5 RPM Pro | ~1,500 extractions + ~30 tailors | $2-5 |
| Gemini Embeddings | 1,500 RPM free | ~1,500/month | $0 |
| Resend (email) | 100 emails/day | ~10/week | $0 |
| Telegram Bot API | Unlimited | Unlimited | $0 |
| Adzuna API | 250 req/day | ~100/day | $0 |
| Remotive API | Free, 2 req/min | ~4 req/day | $0 |
| JSearch (RapidAPI) | 200 req/month | ~100/month | $0 |
| **Total** | | | **$2-5/month** |

---

## API Reference (Data Sources)

### Adzuna
- **Docs:** Developer portal (requires signup)
- **Auth:** API key + App ID
- **Endpoint:** `https://api.adzuna.com/v1/api/jobs/{country}/search/{page}`
- **Free tier:** 250 requests/day
- **Fields:** title, company, location, salary_min, salary_max, description, redirect_url, created, category

### Remotive
- **Docs:** https://github.com/remotive-com/remote-jobs-api
- **Auth:** None (public API)
- **Endpoint:** `https://remotive.com/api/remote-jobs`
- **Params:** `category`, `company_name`, `search`, `limit`
- **Free tier:** Unlimited (2 req/min, recommended few times/day)
- **Fields:** id, url, title, company_name, company_logo, category, job_type, publication_date, candidate_required_location, salary, description (HTML)
- **Terms:** Must attribute Remotive, link back, no reposting to aggregators

### JSearch (RapidAPI)
- **Auth:** RapidAPI key
- **Endpoint:** Via RapidAPI proxy
- **Free tier:** 200 requests/month
- **Fields:** job_title, employer_name, job_city, job_min_salary, job_max_salary, job_description, job_apply_link, job_posted_at

### HN Who's Hiring
- **Auth:** None
- **Endpoint:** HN API (`https://hacker-news.firebaseio.com/v0/`)
- **Method:** Find monthly thread, fetch top-level comments, LLM-parse each comment
- **Fields:** Unstructured text -> LLM extracts company, role, location, salary, url, remote status

---

*Last updated: 2026-04-12*
*Built by AI. Tracked by humans.*
