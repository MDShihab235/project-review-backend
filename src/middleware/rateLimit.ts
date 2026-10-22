import rateLimit from "express-rate-limit";

const base = { standardHeaders: "draft-7" as const, legacyHeaders: false };
const msg = (message: string) => ({ success: false, message });

/** Global safety net for every API route. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: msg("Too many requests. Please slow down."),
});

/** Brute-force protection for login/signup (successful requests are not counted). */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: msg("Too many authentication attempts. Try again in a few minutes."),
});

/** Anti-spam for submissions/edits: 5 per 10 minutes per user (must run after authenticate). */
export const submissionLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  message: msg("You are submitting too quickly. Please wait a few minutes and try again."),
});
