import {
  Button,
  ButtonGroup,
  Card,
  Chip,
  Dropdown,
  Input,
  ListBox,
  ListBoxItem,
  Select,
} from "@heroui/react";
import { and, desc, eq, sql } from "drizzle-orm";
import { ChevronDown, ExternalLink, MapPin, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { db, schema } from "~/db";
import type { Route } from "./+types/jobs";

const PAGE_SIZE = 20;

const SOURCE_COLORS: Record<string, "accent" | "success" | "warning" | "default"> = {
  adzuna: "accent",
  remotive: "success",
  jsearch: "warning",
  hn: "default",
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const search = url.searchParams.get("search") || undefined;
  const workMode = url.searchParams.get("workMode") || undefined;
  const source = url.searchParams.get("source") || undefined;
  const sortBy = url.searchParams.get("sort") || "newest";

  const conditions = [eq(schema.jobs.isActive, true)];

  if (search) {
    conditions.push(
      sql`(${schema.jobs.title} LIKE ${"%" + search + "%"} OR ${schema.jobs.company} LIKE ${"%" + search + "%"})`,
    );
  }
  if (workMode) {
    conditions.push(eq(schema.jobs.workMode, workMode));
  }
  if (source) {
    conditions.push(eq(schema.jobs.source, source));
  }

  const where = and(...conditions);

  const [{ count }] = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.jobs)
    .where(where)
    .all();

  const orderBy = sortBy === "salary" ? desc(schema.jobs.salaryMax) : desc(schema.jobs.createdAt);

  const jobs = db
    .select()
    .from(schema.jobs)
    .where(where)
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return {
    jobs,
    total: count,
    page,
    totalPages: Math.ceil(count / PAGE_SIZE),
  };
}

export default function JobsPage({ loaderData }: Route.ComponentProps) {
  const { jobs, total, page, totalPages } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    setSearchParams(next);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(p));
    setSearchParams(next);
  }

  const isRunning = fetcher.state !== "idle";
  const [selectedTask, setSelectedTask] = useState("scrape:all");

  const scraperOptions: Record<string, string> = {
    "scrape:all": "All Sources",
    "scrape:adzuna": "Adzuna",
    "scrape:remotive": "Remotive",
    "scrape:jsearch": "JSearch",
    "scrape:hn": "HN Who's Hiring",
  };

  function runScraper(task: string) {
    setSelectedTask(task);
    fetcher.submit({ task }, { method: "post", action: "/api/scrape" });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Feed</h2>
          <p className="text-sm text-muted-foreground">{total} active jobs</p>
        </div>
        <ButtonGroup size="sm">
          <Button isDisabled={isRunning} onPress={() => runScraper(selectedTask)}>
            <Sparkles className="size-4" />
            {isRunning ? "Scraping..." : `Run ${scraperOptions[selectedTask]}`}
          </Button>
          <Dropdown>
            <Dropdown.Trigger>
              <Button isIconOnly>
                <ChevronDown className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => runScraper(key as string)}>
                {Object.entries(scraperOptions).map(([key, label]) => (
                  <Dropdown.Item key={key} id={key}>
                    {label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search title or company..."
          defaultValue={searchParams.get("search") || ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParam("search", e.currentTarget.value);
            }
          }}
        />
        <Select
          className="max-w-[160px]"
          placeholder="Work mode"
          selectedKey={searchParams.get("workMode") || null}
          onSelectionChange={(key) => updateParam("workMode", (key as string) || "")}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBoxItem id="remote">Remote</ListBoxItem>
              <ListBoxItem id="hybrid">Hybrid</ListBoxItem>
              <ListBoxItem id="onsite">Onsite</ListBoxItem>
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          className="max-w-[160px]"
          placeholder="Source"
          selectedKey={searchParams.get("source") || null}
          onSelectionChange={(key) => updateParam("source", (key as string) || "")}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBoxItem id="adzuna">Adzuna</ListBoxItem>
              <ListBoxItem id="remotive">Remotive</ListBoxItem>
              <ListBoxItem id="jsearch">JSearch</ListBoxItem>
              <ListBoxItem id="hn">HN</ListBoxItem>
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          className="max-w-[160px]"
          placeholder="Sort"
          selectedKey={searchParams.get("sort") || "newest"}
          onSelectionChange={(key) => updateParam("sort", (key as string) || "newest")}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBoxItem id="newest">Newest</ListBoxItem>
              <ListBoxItem id="salary">Salary (high)</ListBoxItem>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {jobs.length === 0 ? (
        <Card className="py-12 text-center">
          <Card.Content>
            <Search className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No jobs found. Try adjusting your filters or run a scraper to fetch jobs.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page <= 1}
            onPress={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page >= totalPages}
            onPress={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: typeof schema.jobs.$inferSelect }) {
  const daysOld = Math.floor(
    (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const isNew = daysOld <= 1;
  const isFading = daysOld > 14;

  return (
    <Card className={isFading ? "opacity-60" : ""}>
      <Card.Content className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{job.title}</h3>
              {isNew && (
                <Chip size="sm" color="success" variant="soft">
                  New
                </Chip>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {job.company}
              {job.location && (
                <>
                  {" · "}
                  <MapPin className="inline size-3" /> {job.location}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {job.workMode && (
              <Chip size="sm" variant="secondary">
                {job.workMode}
              </Chip>
            )}
            <Chip size="sm" color={SOURCE_COLORS[job.source] || "accent"} variant="primary">
              {job.source}
            </Chip>
          </div>
        </div>

        {(job.salaryMin || job.salaryMax) && (
          <p className="text-sm font-medium text-success">
            {job.salaryMin && job.salaryMax
              ? `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()}`
              : job.salaryMin
                ? `From $${job.salaryMin.toLocaleString()}`
                : `Up to $${job.salaryMax!.toLocaleString()}`}
          </p>
        )}

        {job.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {job.description.substring(0, 300)}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {job.postedAt
              ? new Date(job.postedAt).toLocaleDateString()
              : new Date(job.createdAt).toLocaleDateString()}
          </span>
          {job.sourceUrl && (
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Apply <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
