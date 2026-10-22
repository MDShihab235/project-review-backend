import { ProjectStatus } from "../../generated/prisma/client";
import z from "zod";

const GIT_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"];
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/i;

const httpsUrl = z
  .string()
  .trim()
  .max(300, "URL is too long")
  .url("Enter a valid URL")
  .refine(
    (v) => v.toLowerCase().startsWith("https://"),
    "URL must start with https://",
  );

export const repoUrlSchema = httpsUrl.refine((v) => {
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return (
      GIT_HOSTS.includes(host) &&
      u.pathname.split("/").filter(Boolean).length >= 2
    );
  } catch {
    return false;
  }
}, "Must be a repository URL on GitHub, GitLab or Bitbucket (e.g. https://github.com/user/repo)");

export const liveUrlSchema = httpsUrl.refine((v) => {
  try {
    const host = new URL(v).hostname;
    return host.includes(".") && !PRIVATE_HOST.test(host);
  } catch {
    return false;
  }
}, "Live link must be a publicly reachable URL");

export const projectBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Project name must be at least 3 characters")
    .max(100),
  repoUrl: repoUrlSchema,
  liveUrl: liveUrlSchema,
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters")
    .max(1000, "Description must be at most 1000 characters"),
});

export const idParamSchema = z.object({ id: z.string().trim().min(1).max(40) });

const statusFilter = z.preprocess(
  (v) =>
    typeof v === "string" && v.trim() !== "" && v.toUpperCase() !== "ALL"
      ? v.toUpperCase()
      : undefined,
  z.nativeEnum(ProjectStatus).optional(),
);

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: statusFilter,
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const reviewSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
    feedback: z
      .string()
      .trim()
      .max(500, "Feedback must be at most 500 characters")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "REJECTED" && (!v.feedback || v.feedback.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["feedback"],
        message:
          "Please give the student a reason (at least 5 characters) when rejecting",
      });
    }
  });

export type ProjectInput = z.infer<typeof projectBodySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
