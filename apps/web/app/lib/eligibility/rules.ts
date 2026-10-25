// Deterministic rules: decide only on explicit text, return null otherwise so
// the LLM (or "unclear") takes over. Every verdict quotes the text it rests on.
import type { EligibilityResult, Posting } from "./types";
import { PROMPT_VERSION } from "./types";

// Cities and states beyond the big metros matter too: a location list is read as
// "all outside India" once India appears nowhere in it (see plainPlaceName).
const INDIA_RE =
  /\b(?:india|bangalore|bengaluru|mumbai|bombay|new delhi|delhi|gurgaon|gurugram|noida|hyderabad|pune|chennai|kolkata|ahmedabad|kochi|cochin|thiruvananthapuram|trivandrum|coimbatore|mysore|mysuru|jaipur|chandigarh|mohali|indore|nagpur|lucknow|bhubaneswar|visakhapatnam|vizag|vadodara|surat|goa|karnataka|maharashtra|kerala|tamil nadu|telangana|haryana|uttar pradesh|gujarat|west bengal)\b/i;

const COUNTRIES = [
  "united states of america",
  "united states",
  "us",
  "usa",
  "canada",
  "united kingdom",
  "uk",
  "great britain",
  "britain",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "ireland",
  "germany",
  "france",
  "spain",
  "portugal",
  "italy",
  "netherlands",
  "the netherlands",
  "belgium",
  "luxembourg",
  "switzerland",
  "austria",
  "poland",
  "sweden",
  "norway",
  "denmark",
  "finland",
  "iceland",
  "estonia",
  "latvia",
  "lithuania",
  "czechia",
  "czech republic",
  "slovakia",
  "hungary",
  "romania",
  "bulgaria",
  "greece",
  "croatia",
  "serbia",
  "slovenia",
  "cyprus",
  "malta",
  "ukraine",
  "turkey",
  "israel",
  "brazil",
  "mexico",
  "argentina",
  "colombia",
  "chile",
  "uruguay",
  "peru",
  "costa rica",
  "australia",
  "new zealand",
  "japan",
  "south korea",
  "korea",
  "singapore",
  "philippines",
  "china",
  "hong kong",
  "taiwan",
  "vietnam",
  "indonesia",
  "malaysia",
  "thailand",
  "pakistan",
  "bangladesh",
  "sri lanka",
  "nepal",
  "south africa",
  "nigeria",
  "kenya",
  "ghana",
  "egypt",
  "morocco",
  "uae",
  "united arab emirates",
  "saudi arabia",
  "qatar",
  "bahrain",
  "kuwait",
  "jordan",
  "ecuador",
  "venezuela",
  "bolivia",
  "paraguay",
  "guatemala",
  "panama",
  "dominican republic",
  "puerto rico",
  "armenia",
  "moldova",
  "albania",
  "north macedonia",
  "bosnia and herzegovina",
];

// Regions that exclude India. Deliberately NOT here: APAC/APJ/Asia/global, which
// the rules leave to the LLM ("Americas/APAC" stays undecided for that reason).
const REGIONS = [
  "eu",
  "european union",
  "europe",
  "emea",
  "eea",
  "dach",
  "nordics",
  "benelux",
  "americas",
  "amer",
  "namer",
  "north america",
  "latam",
  "latin america",
  "south america",
];

const US_STATES = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
];

const CA_PROVINCES = [
  "ontario",
  "quebec",
  "british columbia",
  "alberta",
  "manitoba",
  "saskatchewan",
  "nova scotia",
  "new brunswick",
  "newfoundland and labrador",
  "prince edward island",
];

// Two-letter codes only count when they are a whole location segment ("Canada - Remote (ON, BC)").
const REGION_CODES =
  "al ak az ar ca co ct de fl ga hi id il ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok pa ri sc sd tn tx ut vt va wa wv wi wy dc on qc bc ab mb sk ns nb nl pe yt nt nu".split(
    " ",
  );

const NON_INDIA_PLACES = new Set(
  [...COUNTRIES, ...REGIONS, ...US_STATES, ...CA_PROVINCES, ...REGION_CODES].map(stripDots),
);

// Anything that makes a location string fuzzy: the rules don't classify it.
const AMBIGUOUS_LOCATION_RE =
  /\b(?:worldwide|global|globally|anywhere|international|apac|apj|asia|asian|pacific|time ?zones?|tz|gmt|utc|est|edt|pst|pdt|cet|cst|ist|hours|overlap)\b/i;

// A location that is only a place name ("Seattle", "Toronto, Canada", "NYC,
// Chicago"): letters, no remote/hybrid/region/placeholder words, short parts.
const PLAIN_PLACE_RE = /^[a-z .'-]+(?:,[a-z .'-]+)*$/i;
const NOT_A_PLACE_RE =
  /\b(?:remote|hybrid|on-?site|office|home|virtual|distributed|flexible|any|anywhere|other|multiple|various|tbd|tba|location|locations|field|travel|region|regions|na|emea|apj|apac)\b/i;

const WORLDWIDE_LOCATION_RES = [
  /^(?:remote\W*)?(?:worldwide|anywhere in the world)(?:\W*remote)?\W*$/i,
  /^(?:remote\W*global|global\W*remote)\W*$/i,
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripDots(s: string): string {
  return s.replace(/\./g, "");
}

// Description place names: countries, regions, states/provinces by name, plus
// dotted spellings of US/UK. Longest first so "united states of america" wins.
const PLACE_ALT = [
  ...COUNTRIES,
  ...REGIONS,
  ...US_STATES,
  ...CA_PROVINCES,
  "u.s.a.",
  "u.s.a",
  "u.s.",
  "u.s",
  "u.k.",
  "u.k",
]
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join("|");

// "must be located in / must reside in / must live in / must be based in <place>",
// including "must reside in and be authorized to work in <place>".
const RESIDE_RE = new RegExp(
  String.raw`\b(?:must|need to|needs to|required to|have to)\s+(?:currently\s+)?(?:be\s+)?(?:located|based|residing|reside|resident|living|live)\s+(?:in|within)\s+(?:and\s+[^.;:!?]{0,80}?\s+(?:in|for)\s+)?(?:the\s+)?(?:${PLACE_ALT})(?![a-z])`,
  "gi",
);

const ONLY_OPEN_RE = new RegExp(
  String.raw`\bonly open to (?:candidates|applicants|people|individuals|those)\s+(?:who are\s+)?(?:based|located|residing|living)\s+(?:in|within)\s+(?:the\s+)?(?:${PLACE_ALT})(?![a-z])`,
  "gi",
);

const US_AUTH_RE =
  /\b(?:authorized|authorised|eligible)\s+to\s+work\s+in\s+(?:the\s+)?(?:united states(?: of america)?|u\.s\.a?\.?|usa|us)(?![a-z])/i;

const WORLDWIDE_DESC_RES = [
  /\b(?:work|working|live|living|based|located|reside|hire|hiring|remote|remotely|from)\b[^.!?]{0,40}?(?<!almost )\banywhere in the world\b/gi,
  /\b(?:remote|work|working|live|living|based|located|candidates|applicants|hire|hiring)\b[^.!?]{0,30}?\bany country\b/gi,
  /\bworldwide remote\b/gi,
];

const INDIA_OR_WORLDWIDE_RE = /\bindia\b|\bworldwide\b|\banywhere in the world\b|\bany country\b/i;
const TIMEZONE_AFTER_RE = /^\W*(?:time\s*zones?|timezones?|hours|business hours|working hours)\b/i;
// "anywhere in the world, with US / EU timezone overlap" is qualified: leave it to the LLM.
const EXCEPTION_AFTER_RE =
  /\b(?:except|excluding|other than|but not|time\s*zones?|timezones?|overlap|hours)\b/i;

const KNOWN_CITY_CODES = new Set(["NYC", "SF", "LA", "DC"]);

// "Location: Seoul, Korea OR Singapore OR New Delhi, India" in the body: the
// location fields may list only some of the options.
const DESC_INDIA_LOCATION_RE = new RegExp(
  String.raw`\blocations?\s*:[^.\n]{0,150}?${INDIA_RE.source}`,
  "i",
);

// "help entrepreneurs start a business from anywhere in the world" is about the
// product, not about hiring.
const PRODUCT_SUBJECT_RE =
  /\b(?:business|businesses|customers?|users?|companies|company|merchants?|entrepreneurs?|founders?|sellers?|creators?|clients?)\b/i;
const HIRING_SUBJECT_RE =
  /\b(?:hire|hiring|candidates?|applicants?|employees?|teammates?|team members?|you can work|you can live|work remotely)\b/i;

type LocationClass = "india" | "worldwide" | "non_india" | "unknown";

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// "Canada Locations" -> "canada", "US-PERM" -> "us".
function normalizeLocation(raw: string): string {
  return collapse(raw)
    .toLowerCase()
    .replace(/\s+locations$/, "")
    .replace(/\bus-perm\b/, "us");
}

function classifyLocation(raw: string): LocationClass {
  const s = normalizeLocation(raw);
  if (!s) return "unknown";
  if (INDIA_RE.test(s)) return "india";
  if (WORLDWIDE_LOCATION_RES.some((re) => re.test(s))) return "worldwide";
  if (AMBIGUOUS_LOCATION_RE.test(s)) return "unknown";

  const clean = (seg: string) =>
    stripDots(seg)
      .replace(/\b(?:remote|only|fully|full[- ]time|part[- ]time|based)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const segments = s
    .split(/[,/()|;:+&–—-]|\bor\b|\band\b/)
    .map(clean)
    .filter(Boolean);
  if (segments.length === 0) return "unknown"; // bare "Remote"
  if (segments.every((seg) => NON_INDIA_PLACES.has(seg))) return "non_india";

  // "City, Country" / "City, State": the last comma part names the place. Not
  // for a city list with a bare "Remote" option ("London, New York, Remote").
  const rawCommaParts = s.split(",").map((p) => p.trim());
  const commaParts = rawCommaParts.map(clean).filter(Boolean);
  if (
    commaParts.length >= 2 &&
    !rawCommaParts.includes("remote") &&
    NON_INDIA_PLACES.has(commaParts[commaParts.length - 1])
  ) {
    return "non_india";
  }
  return "unknown";
}

// Only plain place names: no acronyms beyond the known ones (an office code like
// "BCC" is not a city), at most three words per comma part.
function plainPlaceName(raw: string): boolean {
  const s = collapse(raw);
  if (!PLAIN_PLACE_RE.test(s) || NOT_A_PLACE_RE.test(s) || AMBIGUOUS_LOCATION_RE.test(s)) {
    return false;
  }
  return s.split(",").every((part) => {
    const words = part.trim().split(" ");
    const acronym = /^[A-Z.]{2,5}$/.test(part.trim()) && !KNOWN_CITY_CODES.has(part.trim());
    return words.length <= 3 && !acronym;
  });
}

interface Match {
  text: string;
  before: string;
  after: string;
}

function* matchesOf(re: RegExp, text: string): Generator<Match> {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  for (const m of text.matchAll(global)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    yield {
      text: m[0],
      before: text.slice(Math.max(0, start - 120), start),
      after: text.slice(end, end + 80),
    };
  }
}

function firstRestriction(description: string): string | null {
  for (const re of [RESIDE_RE, ONLY_OPEN_RE]) {
    for (const m of matchesOf(re, description)) {
      if (TIMEZONE_AFTER_RE.test(m.after)) continue;
      // "must be located in the US or India" is not a restriction against India.
      const sentenceTail = m.after.split(/[.!?;](?:\s|$)/)[0];
      if (INDIA_OR_WORLDWIDE_RE.test(m.text) || INDIA_OR_WORLDWIDE_RE.test(sentenceTail)) continue;
      return m.text;
    }
  }
  return null;
}

function firstWorldwide(description: string): string | null {
  for (const re of WORLDWIDE_DESC_RES) {
    for (const m of matchesOf(re, description)) {
      const sentenceTail = m.after.split(/[.!?;](?:\s|$)/)[0];
      if (EXCEPTION_AFTER_RE.test(sentenceTail)) continue;
      const sentence = `${m.before.split(/[.!?;](?:\s|$)/).pop() ?? ""}${m.text}`;
      if (PRODUCT_SUBJECT_RE.test(sentence) && !HIRING_SUBJECT_RE.test(sentence)) continue;
      return m.text;
    }
  }
  return null;
}

function result(
  verdict: "eligible" | "not_eligible",
  evidence: string,
  reason: string,
): EligibilityResult {
  return { verdict, evidence, reason, method: "rules", promptVersion: PROMPT_VERSION };
}

export function applyRules(posting: Posting): EligibilityResult | null {
  const locations = posting.locations.map(collapse).filter(Boolean);
  const description = collapse(posting.description ?? "");
  const classes = locations.map((loc) => ({ loc, cls: classifyLocation(loc) }));

  // 1. One India option that is remote is enough.
  const india = classes.find(
    ({ loc, cls }) => cls === "india" && (/\bremote\b/i.test(loc) || posting.workMode === "remote"),
  );
  if (india) {
    return result(
      "eligible",
      india.loc,
      `Lists an Indian location for a remote role: "${india.loc}".`,
    );
  }

  // 2. Collect explicit signals on each side; a conflict goes to the LLM.
  const worldwideLoc = classes.find(({ cls }) => cls === "worldwide")?.loc ?? null;
  const worldwideDesc = firstWorldwide(description);
  // Every location outside India. Plain city names ("Seattle") count too once one
  // location is a known non-India place and India appears in neither title nor
  // locations: ["Seattle", "US"].
  const anchor = classes.find(({ cls }) => cls === "non_india")?.loc ?? null;
  const indiaInFields = INDIA_RE.test([posting.title, ...locations].join("\n"));
  const allNonIndia =
    anchor &&
    classes.every(
      ({ loc, cls }) =>
        cls === "non_india" || (cls === "unknown" && !indiaInFields && plainPlaceName(loc)),
    )
      ? anchor
      : null;
  const descIndiaLocation = DESC_INDIA_LOCATION_RE.exec(posting.description ?? "")?.[0] ?? null;
  const restriction = firstRestriction(description);
  const fullText = [posting.title, ...locations, description].join("\n");
  const usAuth = !INDIA_OR_WORLDWIDE_RE.test(fullText)
    ? (description.match(US_AUTH_RE)?.[0] ?? null)
    : null;

  const eligibleQuote = worldwideLoc ?? worldwideDesc;
  const notEligibleQuote = allNonIndia ?? restriction ?? usAuth;

  if (eligibleQuote && notEligibleQuote) return null;
  // The body names an Indian location the location fields leave out.
  if (notEligibleQuote && descIndiaLocation) return null;
  if (eligibleQuote) {
    return result("eligible", eligibleQuote, `Open worldwide: "${eligibleQuote}".`);
  }
  if (allNonIndia) {
    return result(
      "not_eligible",
      allNonIndia,
      `Every location is outside India (e.g. "${allNonIndia}").`,
    );
  }
  if (restriction) {
    return result("not_eligible", restriction, `Restricted to a non-India location.`);
  }
  if (usAuth) {
    return result(
      "not_eligible",
      usAuth,
      "Requires US work authorization and never mentions India or worldwide hiring.",
    );
  }
  return null;
}
