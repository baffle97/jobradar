# JobRadar

A job intelligence tool for one question: **can I do this remote job from
India?** It pulls postings from several sources on a schedule, deduplicates
them, and an eligibility agent answers that question for each one, quoting the
line of the posting the answer rests on.

Built for myself, while job hunting. Which turned out to be the useful part:
every feature exists because the manual version of it annoyed me first.

**Status:** scraping, dedup, the eligibility agent, the phone-first feed (with a
pay filter in rupees a month) and a Saved page that tracks each application are
live at <https://jobradar-rust.vercel.app>. Hand-labelling 200 postings for the
eval is next; scoring and alerts are not built.

---

## How it works

```
scheduler (Vercel Cron; croner locally)
  → source adapters       Adzuna · Remotive · Hacker News "Who is hiring?"
                          · company ATS boards (Ashby · Greenhouse · Lever)
  → normalise             one shape, whatever the source
  → dedup                 same job, three boards, one row
  → libSQL (Drizzle)      Turso in production, a local file in dev
  → eligibility agent     rules first, Gemini for the rest, quote verified
  → feed · job page · /label
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

**Company boards come straight from the ATS.** Any Ashby, Greenhouse or Lever
link in an HN post registers that company's board, and `discover:yc` guesses
boards for hiring YC companies. Each board is then polled through its public
JSON API (`lib/scrapers/ats/`), which returns the company's full list with
locations, workplace type and often salary. A posting that disappears from its
board is marked inactive on the next poll. A guessed YC board is kept only if
its postings mention the company's domain, or if the token is the domain's own
name, at least six letters long and the company name matches. Short names like
"tempo" or "hive" often belong to someone else.

**The eligibility agent** (`lib/eligibility/`) decides `eligible`,
`not_eligible` or `unclear` for every remote posting:

- Deterministic rules go first and decide only on explicit text ("Remote - US",
  "must be located in Canada", "work from anywhere in the world"). They settle
  about three quarters of postings without a model call.
- The rest go to Gemini with the posting inside `<posting>` tags, marked as
  data, not instructions.
- No quote, no verdict: a yes/no must carry a phrase that is checked in code to
  appear verbatim in the posting. If it doesn't, the answer becomes `unclear`.
- Every check is written to an audit table with the model, prompt version,
  input hash, tokens and latency. A posting is re-checked only when its text or
  the prompt version changes.
- Calls are paced under the free tier's per-minute limit and the run stops
  before Vercel's 300s function limit; whatever is left waits for the next run.
- `/label` collects hand labels (the agent's answer stays hidden until you
  answer), and `pnpm eval:eligibility` scores the agent against them.

## Stack

React Router 7 (SSR) · TypeScript · Drizzle + libSQL (Turso) · AI SDK + Gemini ·
HeroUI v3 · Tailwind v4 · Vitest · Vercel · pnpm workspaces

## Running it

```bash
pnpm install
cp .env.example .env.local  # Adzuna key optional; Remotive and HN need none
pnpm dev
```

Without `TURSO_DATABASE_URL` the app uses `apps/web/data/jobradar.db`. Without
`GOOGLE_GENERATIVE_AI_API_KEY` the eligibility agent runs rules only and leaves
the rest `unclear`.

```bash
pnpm --filter @jobradar/web test
pnpm --filter @jobradar/web eval:eligibility   # score against hand labels
```

## Layout

```
apps/web/app/
  lib/scrapers/     source adapters, dedup, upsert, cleanup
  lib/eligibility/  rules, prompt, quote check, Gemini client, the cron task
  lib/scheduler/    croner (local) and the task registry behind /api/cron
  db/               Drizzle schema
  routes/           feed · job · label · settings · auth
packages/shared/   schemas shared across the workspace
```

`checklist.md` is the running build plan — what's done, what's deferred.
