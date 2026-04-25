import { z } from "zod";

export const workModeSchema = z.enum(["remote", "hybrid", "onsite"]);
export type WorkMode = z.infer<typeof workModeSchema>;

export const jobTypeSchema = z.enum(["full-time", "contract", "part-time"]);
export type JobType = z.infer<typeof jobTypeSchema>;

export const jobSourceSchema = z.enum(["adzuna", "remotive", "jsearch", "hn"]);
export type JobSource = z.infer<typeof jobSourceSchema>;

export const jobSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  description: z.string().optional(),
  source: jobSourceSchema,
  sourceUrl: z.string().url().optional(),
  workMode: workModeSchema.optional(),
  jobType: jobTypeSchema.optional(),
  postedAt: z.string().optional(),
});
export type Job = z.infer<typeof jobSchema>;

export const profileSchema = z.object({
  name: z.string().optional(),
  currentRole: z.string().optional(),
  yearsExperience: z.number().int().min(0).optional(),
  skills: z.array(z.string()).default([]),
  targetRoles: z.array(z.string()).default([]),
  targetLocations: z.array(z.string()).default([]),
  workMode: workModeSchema.optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
});
export type Profile = z.infer<typeof profileSchema>;

export const jobFiltersSchema = z.object({
  search: z.string().optional(),
  workMode: workModeSchema.optional(),
  location: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  sources: z.array(jobSourceSchema).optional(),
  jobType: jobTypeSchema.optional(),
  minMatchScore: z.number().min(0).max(100).optional(),
});
export type JobFilters = z.infer<typeof jobFiltersSchema>;

export const extractedSkillSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  required: z.boolean().default(true),
});
export type ExtractedSkill = z.infer<typeof extractedSkillSchema>;

export const applicationStatusSchema = z.enum([
  "discovered",
  "resume_tailored",
  "in_review",
  "applied",
  "tracking",
  "offer",
  "rejected",
  "ghosted",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
