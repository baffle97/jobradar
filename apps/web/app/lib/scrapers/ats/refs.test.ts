import { describe, expect, it } from "vitest";
import {
  boardBelongsTo,
  candidateTokens,
  extractBoardRefs,
  registrableDomain,
  ycBoardIsTrusted,
} from "./refs";

describe("boardBelongsTo", () => {
  it("compares names when the ATS reports one", () => {
    expect(boardBelongsTo("GOAT Group", "Goat group", [])).toBe(true);
    expect(boardBelongsTo("Tempo", "Tempo Automation", [])).toBe(false);
  });

  it("otherwise needs the name as a whole word in some posting", () => {
    const jobs = [{ description: "Join Reach Power and build grid software." }];
    expect(boardBelongsTo("Reach Power", undefined, jobs)).toBe(true);
    expect(boardBelongsTo("Reach", undefined, [{ description: "We are reaching users." }])).toBe(
      false,
    );
    expect(boardBelongsTo("Hive", undefined, [])).toBe(false);
  });
});

describe("extractBoardRefs", () => {
  it("finds boards inside HN comment HTML, where slashes are entity-encoded", () => {
    const comment =
      'Acme | Engineer | REMOTE<p>Apply: <a href="https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme&#x2F;123">https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme&#x2F;123</a>';
    expect(extractBoardRefs(comment)).toEqual([{ ats: "ashby", token: "acme" }]);
  });

  it("recognises every Greenhouse and Lever URL form", () => {
    const text = [
      "https://boards.greenhouse.io/quill/jobs/1",
      "https://job-boards.greenhouse.io/oklo",
      "https://boards.greenhouse.io/embed/job_board?for=coast",
      "https://jobs.lever.co/curio/abc.",
    ].join(" ");
    expect(extractBoardRefs(text)).toEqual([
      { ats: "greenhouse", token: "quill" },
      { ats: "greenhouse", token: "oklo" },
      { ats: "greenhouse", token: "coast" },
      { ats: "lever", token: "curio" },
    ]);
  });

  it("dedupes case-insensitively and ignores path words that are not boards", () => {
    const text = "jobs.ashbyhq.com/Acme jobs.ashbyhq.com/acme boards.greenhouse.io/embed";
    expect(extractBoardRefs(text)).toEqual([{ ats: "ashby", token: "Acme" }]);
  });
});

describe("registrableDomain", () => {
  it("drops www and marketing subdomains but keeps two-part TLDs", () => {
    expect(registrableDomain("https://www.acme.com/")).toBe("acme.com");
    expect(registrableDomain("go.acme.com")).toBe("acme.com");
    expect(registrableDomain("https://acme.co.uk")).toBe("acme.co.uk");
    expect(registrableDomain("picnic.ai")).toBe("picnic.ai");
    expect(registrableDomain(null)).toBeUndefined();
  });
});

describe("ycBoardIsTrusted", () => {
  const base = { companyName: "Acme Robotics", jobs: [{ description: "Join Acme Robotics." }] };

  it("trusts a board whose postings mention the company's domain", () => {
    expect(
      ycBoardIsTrusted({
        ...base,
        token: "tempo",
        website: "https://acmerobotics.com",
        jobs: [{ description: "See acmerobotics.com/careers" }],
      }),
    ).toBe(true);
  });

  it("trusts a long token that is the domain's own name when the name matches", () => {
    expect(
      ycBoardIsTrusted({ ...base, token: "acmerobotics", website: "https://acmerobotics.com" }),
    ).toBe(true);
  });

  it("rejects short generic tokens without a domain mention", () => {
    expect(
      ycBoardIsTrusted({
        companyName: "Tempo",
        token: "tempo",
        website: "https://tempo.fit",
        boardCompanyName: "Tempo",
        jobs: [{ description: "Tempo Energy builds batteries. tempoenergy.com" }],
      }),
    ).toBe(false);
  });

  it("rejects a token that differs from the domain name", () => {
    expect(
      ycBoardIsTrusted({
        companyName: "RADAR",
        token: "radar",
        website: "https://goradar.com",
        jobs: [{ description: "RADAR at radar.com" }],
      }),
    ).toBe(false);
  });
});

describe("candidateTokens", () => {
  it("uses the slug and the website's first label", () => {
    expect(candidateTokens("acme-labs", "https://www.acme.dev")).toEqual(["acme-labs", "acme"]);
  });

  it("dedupes and survives a missing or malformed website", () => {
    expect(candidateTokens("acme", "acme.com")).toEqual(["acme"]);
    expect(candidateTokens("acme", null)).toEqual(["acme"]);
    expect(candidateTokens("acme", "http://")).toEqual(["acme"]);
  });
});
