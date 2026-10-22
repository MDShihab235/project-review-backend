import { RequestHandler } from "express";
import { Role } from "../generated/prisma/client";
import { AppError } from "../lib/errors";
import { verifyToken } from "../lib/jwt";

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token =
    req.cookies?.token ??
    (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (!token) return next(new AppError(401, "Authentication required"));

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub as string, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired session. Please log in again."));
  }
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new AppError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(403, "You do not have permission to perform this action"),
      );
    }
    next();
  };

/** Mentors and admins can review projects. */
export const reviewerOnly = authorize(Role.MENTOR, Role.ADMIN);
export const studentOnly = authorize(Role.STUDENT);
