import { describe, expect, it } from "vitest";
import { normalizeTitle, ROLE_KEYS, roleLabel, rolesForTitle } from "./roles";

describe("rolesForTitle", () => {
  it.each([
    ["Software Engineer, Agents", ["ai", "eng"]],
    ["Email Marketing Manager", ["nontech"]],
    ["Senior iOS Engineer", ["mobile", "eng"]],
    ["Maintenance Technician", ["nontech"]],
    ["Staff SRE", ["infra", "eng"]],
    ["AI/ML Engineer", ["ai", "eng"]],
    ["Senior Machine Learning Engineer - Inference", ["ai", "eng"]],
    ["GenAI Solutions Architect", ["ai", "eng"]],
    ["Applied Scientist, LLMs", ["ai", "eng"]],
    ["Back-End Developer (Go)", ["backend", "eng"]],
    ["API Platform Engineer", ["backend", "infra", "eng"]],
    ["Rapid Response Coordinator", ["nontech"]],
    ["Front-end Engineer (React)", ["frontend", "eng"]],
    ["Full-Stack Developer", ["fullstack", "eng"]],
    ["Fullstack Engineer", ["fullstack", "eng"]],
    ["DevOps / Kubernetes Specialist", ["infra", "eng"]],
    ["Senior Data Engineer", ["data", "eng"]],
    ["Product Analyst", ["data", "eng"]],
    ["Android Developer", ["mobile", "eng"]],
    ["React Native Engineer", ["frontend", "mobile", "eng"]],
    ["AppSec Lead", ["security", "eng"]],
    ["HTML Email Designer", ["nontech"]],
    ["Account Executive, Biosciences", ["nontech"]],
    ["Head of People", ["nontech"]],
    // agent / cloud / platform need an engineering or science word too.
    ["Sr. Director of Agents Growth", ["nontech"]],
    ["Support Agent", ["nontech"]],
    ["Real Estate Agent (Remote)", ["nontech"]],
    ["Agentic Systems Engineer", ["ai", "eng"]],
    ["Research Scientist, Agents", ["ai", "eng"]],
    ["Reagent Lab Technician", ["nontech"]],
    ["Cloud Sales Executive", ["nontech"]],
    ["Platform Marketing Manager", ["nontech"]],
    ["Cloud Infrastructure Engineer", ["infra", "eng"]],
    ["Senior Cloud Developer", ["infra", "eng"]],
    ["Platform Developer", ["backend", "eng"]],
  ])("%s -> %j", (title, groups) => {
    expect(rolesForTitle(title)).toEqual(groups);
  });

  it("matches short words only as whole words", () => {
    for (const title of ["Maintain", "Email Ops", "Biosafety Officer"]) {
      expect(rolesForTitle(title)).not.toContain("ai");
    }
    expect(rolesForTitle("HTML wizard")).not.toContain("ai");
    expect(rolesForTitle("Bios Engineer")).not.toContain("mobile");
  });

  it("every group has a label and nontech is last", () => {
    for (const key of ROLE_KEYS) expect(roleLabel(key).length).toBeGreaterThan(0);
    expect(ROLE_KEYS.at(-1)).toBe("nontech");
    expect(roleLabel("ai")).toBe("AI / ML / Agents");
  });
});

describe("normalizeTitle", () => {
  it("lowercases ASCII, turns punctuation into spaces and pads both ends", () => {
    expect(normalizeTitle("AI/ML Engineer (Remote)")).toBe(" ai ml engineer  remote  ");
    expect(normalizeTitle("Back-End, Sr.")).toBe(" back end  sr  ");
  });
});
