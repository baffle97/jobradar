import { describe, expect, it } from "vitest";
import { normalizeAshby } from "./ashby";
import { normalizeGreenhouse } from "./greenhouse";
import { normalizeLever } from "./lever";

// Fixtures are made up, but follow the field shapes the live APIs returned in Oct 2026.

describe("normalizeAshby", () => {
  const data = {
    jobs: [
      {
        id: "a1",
        title: " Platform Engineer ",
        location: "Remote, Global",
        secondaryLocations: [{ location: "Europe" }],
        isListed: true,
        isRemote: null,
        workplaceType: null,
        employmentType: "FullTime",
        publishedAt: "2026-10-01T10:00:00.000+00:00",
        jobUrl: "https://jobs.ashbyhq.com/acme/a1",
        applyUrl: "https://jobs.ashbyhq.com/acme/a1/application",
        descriptionPlain: "We hire anywhere.",
        compensation: {
          compensationTierSummary: "$200K – $270K • Offers Equity",
          summaryComponents: [
            {
              compensationType: "Salary",
              interval: "1 YEAR",
              currencyCode: "USD",
              minValue: 200000,
              maxValue: 270000,
            },
          ],
        },
      },
      {
        id: "a2",
        title: "Hourly Contractor",
        location: "Berlin",
        workplaceType: "Hybrid",
        jobUrl: "https://jobs.ashbyhq.com/acme/a2",
        descriptionHtml: "<p>Paid hourly.</p>",
        compensation: {
          summaryComponents: [
            {
              compensationType: "Salary",
              interval: "1 HOUR",
              currencyCode: "EUR",
              minValue: 60,
              maxValue: 80,
            },
          ],
        },
      },
      { id: "a3", title: "Unlisted", isListed: false, jobUrl: "https://jobs.ashbyhq.com/acme/a3" },
    ],
  };

  const jobs = normalizeAshby("acme-labs", data);

  it("skips unlisted postings", () => {
    expect(jobs.map((j) => j.externalId)).toEqual(["a1", "a2"]);
  });

  it("collects primary and secondary locations and infers remote", () => {
    expect(jobs[0].locations).toEqual(["Remote, Global", "Europe"]);
    expect(jobs[0].workMode).toBe("remote");
    expect(jobs[0].jobType).toBe("full-time");
    expect(jobs[0].title).toBe("Platform Engineer");
  });

  it("keeps yearly salary as numbers and every salary as text", () => {
    expect(jobs[0]).toMatchObject({
      salaryMin: 200000,
      salaryMax: 270000,
      salaryCurrency: "USD",
      salaryText: "$200K – $270K • Offers Equity",
    });
    expect(jobs[1].salaryMin).toBeUndefined();
    expect(jobs[1].workMode).toBe("hybrid");
    expect(jobs[1].description).toBe("Paid hourly.");
  });

  it("names the company from the board token when Ashby gives no name", () => {
    expect(jobs[0].company).toBe("Acme Labs");
    expect(normalizeAshby("acme-labs", data, "ACME")[0].company).toBe("ACME");
  });
});

describe("normalizeGreenhouse", () => {
  const data = {
    jobs: [
      {
        id: 101,
        title: "Backend Engineer",
        absolute_url: "https://job-boards.greenhouse.io/quill/jobs/101",
        company_name: "Quill",
        location: { name: "Remote, Canada; Remote, India" },
        offices: [{ name: "India", location: "India" }],
        content:
          "&lt;p&gt;Candidates must reside in the US &amp;amp; Canada.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Go&lt;/li&gt;&lt;/ul&gt;",
        first_published: "2026-09-20T09:00:00-04:00",
        pay_input_ranges: [
          {
            min_cents: 13920000,
            max_cents: 23520000,
            currency_type: "USD",
            title: "United States Salary Range",
          },
        ],
      },
    ],
  };

  const [job] = normalizeGreenhouse("quill", data);

  it("splits joined locations and merges offices without duplicates", () => {
    expect(job.locations).toEqual(["Remote, Canada", "Remote, India", "India"]);
    expect(job.workMode).toBe("remote");
  });

  it("decodes the escaped HTML body into readable text", () => {
    expect(job.description).toBe("Candidates must reside in the US & Canada.\n\n- Go");
  });

  it("converts pay ranges from cents and keeps the range label", () => {
    expect(job).toMatchObject({
      externalId: "101",
      company: "Quill",
      salaryMin: 139200,
      salaryMax: 235200,
      salaryCurrency: "USD",
      salaryText: "United States Salary Range: USD 139,200 – 235,200",
    });
  });

  it("does not double the colon when the range title already ends with one", () => {
    const [withColon] = normalizeGreenhouse("quill", {
      jobs: [
        {
          ...data.jobs[0],
          pay_input_ranges: [
            {
              min_cents: 10000000,
              max_cents: 15000000,
              currency_type: "USD",
              title: "Hiring Range:",
            },
          ],
        },
      ],
    });
    expect(withColon.salaryText).toBe("Hiring Range: USD 100,000 – 150,000");
  });
});

describe("normalizeLever", () => {
  const data = [
    {
      id: "l1",
      text: "Senior Software Engineer",
      hostedUrl: "https://jobs.lever.co/curio/l1",
      applyUrl: "https://jobs.lever.co/curio/l1/apply",
      createdAt: 1790794199400,
      country: "US",
      workplaceType: "remote",
      categories: { location: "Remote", allLocations: ["Remote", "New York"], commitment: "W2" },
      descriptionPlain: "Intro.",
      lists: [{ text: "Requirements", content: "<li>Must be based in the US</li>" }],
      additionalPlain: "Compensation: $175,000 - $210,000/year",
      salaryRange: { min: 175000, max: 210000, currency: "USD", interval: "per-year-salary" },
    },
    {
      id: "l2",
      text: "Office Manager",
      hostedUrl: "https://jobs.lever.co/curio/l2",
      workplaceType: "on-site",
      categories: { location: "London", commitment: "Part-time" },
      salaryRange: { min: 20, max: 25, currency: "GBP", interval: "per-hour-wage" },
    },
  ];

  const jobs = normalizeLever("curio", data);

  it("puts list sections into the description, where hiring rules usually are", () => {
    expect(jobs[0].description).toBe(
      "Intro.\n\nRequirements\n- Must be based in the US\n\nCompensation: $175,000 - $210,000/year",
    );
  });

  it("maps workplace type, country and commitment", () => {
    expect(jobs[0]).toMatchObject({ workMode: "remote", country: "US", jobType: undefined });
    expect(jobs[1]).toMatchObject({ workMode: "onsite", jobType: "part-time" });
    expect(jobs[0].locations).toEqual(["Remote", "New York"]);
    expect(jobs[1].locations).toEqual(["London"]);
  });

  it("only treats yearly ranges as salary numbers", () => {
    expect(jobs[0]).toMatchObject({ salaryMin: 175000, salaryMax: 210000 });
    expect(jobs[1].salaryMin).toBeUndefined();
    expect(jobs[1].salaryText).toBe("GBP 20 – 25 (per-hour-wage)");
  });

  it("converts createdAt milliseconds to ISO", () => {
    expect(jobs[0].postedAt).toBe(new Date(1790794199400).toISOString());
  });
});
