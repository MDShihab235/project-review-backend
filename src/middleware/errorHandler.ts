import { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "../generated/prisma/client";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { isProd } from "../config/env";

export const notFound: RequestHandler = (req, _res, next) =>
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ success: false, message: err.message, errors: err.errors });
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return res.status(409).json({
      success: false,
      message: "A record with these details already exists",
    });
  }
  if (err?.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ success: false, message: "Malformed JSON body" });
  }
  console.error(err);
  res.status(500).json({
    success: false,
    message: isProd
      ? "Internal server error"
      : (err?.message ?? "Internal server error"),
  });
};
