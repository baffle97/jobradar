// Title keyword groups for the feed's Role filter. Matched here, in JS, when a
// job is written: the tags go into jobs.roles (" ai eng "), and the feed's SQL
// only checks a tag (matching in SQL was too deep and too slow on Turso).
//
// Normalized title: " " + lowercase + " ", with punctuation turned into spaces
// ("AI/ML Engineer (Remote)" -> " ai ml engineer  remote  "). A term with
// spaces around it (" ai ") only matches a whole word, so "ai" never matches
// "maintain" or "email"; a bare term ("llm") matches anywhere ("llms").
// A term with `with` also needs one of those words in the title: "agents"
// is AI in "Software Engineer, Agents" but not in "Support Agent".

export const ROLE_KEYS = [
  "ai",
  "backend",
  "frontend",
  "fullstack",
  "infra",
  "data",
  "mobile",
  "security",
  "eng",
  "nontech",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

type TermGroup = Exclude<RoleKey, "nontech">;

export type RoleTerm = string | { term: string; with: readonly string[] };

// Engineering or science words that make an ambiguous term count.
const TECH_WORDS = [
  "engineer",
  "developer",
  "scientist",
  "researcher",
  "architect",
  " swe ",
  " ml ",
  " ai ",
] as const;
const withTech = (term: string): RoleTerm => ({ term, with: TECH_WORDS });

export const ROLE_GROUPS: Record<TermGroup, { label: string; terms: RoleTerm[] }> = {
  ai: {
    label: "AI / ML / Agents",
    terms: [
      withTech(" agent "),
      withTech(" agents "),
      withTech(" agentic "),
      " ai ",
      "llm",
      " ml ",
      "machine learning",
      "applied scientist",
      "research engineer",
      "genai",
      " nlp ",
      "inference",
    ],
  },
  backend: {
    label: "Backend",
    terms: ["backend", "back end", " api ", withTech("platform"), "distributed", " server"],
  },
  frontend: {
    label: "Frontend",
    terms: ["frontend", "front end", " ui engineer", "react", "web engineer"],
  },
  fullstack: { label: "Full stack", terms: ["full stack", "fullstack"] },
  infra: {
    label: "Infra / DevOps / SRE",
    terms: [
      "devops",
      " sre ",
      "site reliability",
      "infrastructure",
      withTech("cloud"),
      "kubernetes",
      "platform engineer",
    ],
  },
  data: {
    label: "Data",
    terms: ["data engineer", "data scientist", "analytics", "analyst", "data platform"],
  },
  mobile: {
    label: "Mobile",
    terms: [" ios ", "android", "mobile", "react native", "flutter"],
  },
  security: { label: "Security", terms: ["security", "appsec"] },
  // A superset: these terms, or any group above.
  eng: {
    label: "Any engineering",
    terms: ["engineer", "developer", "programmer", " swe ", "architect"],
  },
};

const NONTECH_LABEL = "Non-tech";

export function roleLabel(key: RoleKey): string {
  return key === "nontech" ? NONTECH_LABEL : ROLE_GROUPS[key].label;
}

export function parseRole(value: string | null): RoleKey | null {
  return (ROLE_KEYS as readonly string[]).includes(value ?? "") ? (value as RoleKey) : null;
}

// Characters that count as word breaks.
const TITLE_PUNCTUATION = [..."()[]{},./\\-–—:;|&!?'\"+#*_@"];

// ASCII-only lowercasing, like SQLite's lower(): terms are ASCII anyway.
export function normalizeTitle(title: string): string {
  let s = title.replace(/[A-Z]/g, (c) => c.toLowerCase());
  for (const ch of TITLE_PUNCTUATION) s = s.split(ch).join(" ");
  return ` ${s} `;
}

// Terms whose match puts a title in `key` (eng: every engineering term).
function roleTerms(key: TermGroup): RoleTerm[] {
  if (key !== "eng") return ROLE_GROUPS[key].terms;
  return Object.values(ROLE_GROUPS).flatMap((g) => g.terms);
}

export function rolesForTitle(title: string): RoleKey[] {
  const t = normalizeTitle(title);
  const has = (term: RoleTerm) =>
    typeof term === "string"
      ? t.includes(term)
      : t.includes(term.term) && term.with.some((w) => t.includes(w));
  const hit = (key: TermGroup) => roleTerms(key).some(has);
  const groups = ROLE_KEYS.filter((k): k is TermGroup => k !== "nontech" && hit(k));
  return groups.length ? groups : ["nontech"];
}

// What jobs.roles stores: space-padded tags, " ai eng " or " nontech ", so the
// feed can match one tag with LIKE '% ai %'.
export function roleTags(title: string): string {
  return ` ${rolesForTitle(title).join(" ")} `;
}
