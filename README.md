# JobRadar

A single-user job intelligence tool. Pulls postings from several sources on a
schedule, deduplicates them, and puts everything in one feed with a pipeline
board — instead of checking six job boards by hand.

Built for myself, while job hunting. Which turned out to be the useful part:
every feature exists because the manual version of it annoyed me first.

**Status:** Sprint 1. Scraping pipeline, dedup and job feed are working.
The scoring and alerting layers are not built yet.

---

## How it works

```
scheduler (croner)
  → source adapters       Adzuna · Remotive · Hacker News "Who is hiring?"
  → normalise             one shape, whatever the source
  → dedup                 same job, three boards, one row
  → SQLite (Drizzle)
  → feed + pipeline board
```

**Deduplication is the interesting bit.** The same role appears on Adzuna, a
company's own site and an HN thread with three different titles and no shared
id. `lib/scrapers/dedup.ts` decides what counts as the same job.

**Each source is its own adapter** — `adzuna.ts`, `remotive.ts`, `hn.ts` — so a
new board is one file, not a change to the pipeline. Remotive's terms require
attribution and no re-syndication; that's respected in the adapter rather than
bolted on later.

**The HN scraper** parses top-level comments from the monthly thread through the
HN API rather than scraping HTML.

## Stack

React Router 7 (SSR) · TypeScript · Drizzle + SQLite · croner · HeroUI ·
Zustand · pnpm workspaces

## Running it

```bash
pnpm install
cp .env.example .env      # Adzuna key optional; Remotive and HN need none
pnpm dev
```

## Layout

```
apps/web/app/
  lib/scrapers/    source adapters, dedup, upsert, cleanup
  lib/scheduler/   cron-driven refresh
  db/              Drizzle schema
  routes/          dashboard · jobs · pipeline · settings · auth
packages/shared/   schemas shared across the workspace
```

`checklist.md` is the running build plan — what's done, what's deferred.
