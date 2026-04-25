import { createHash } from "node:crypto";

export function dedupHash(title: string, company: string, location: string): string {
  const normalized = `${title.toLowerCase().trim()}|${company.toLowerCase().trim()}|${(location || "").toLowerCase().trim()}`;
  return createHash("md5").update(normalized).digest("hex");
}
