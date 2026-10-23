import { Router } from "express";
import { authenticate, reviewerOnly, studentOnly } from "../../middleware/auth.js";
import { submissionLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import * as ctrl from "./project.controller.js";
import {
  idParamSchema,
  listQuerySchema,
  projectBodySchema,
  reviewSchema,
} from "./project.schema.js";

export const projectRouter = Router();

projectRouter.use(authenticate);

// ----- Student -----
projectRouter.post(
  "/",
  studentOnly,
  submissionLimiter,
  validate(projectBodySchema),
  ctrl.create,
);
projectRouter.get(
  "/mine",
  studentOnly,
  validate(listQuerySchema, "query"),
  ctrl.listMine,
);
projectRouter.patch(
  "/:id",
  studentOnly,
  submissionLimiter,
  validate(idParamSchema, "params"),
  validate(projectBodySchema),
  ctrl.update,
);
projectRouter.delete(
  "/:id",
  studentOnly,
  validate(idParamSchema, "params"),
  ctrl.remove,
);

// ----- Mentor / Admin (static routes must stay above "/:id/..." routes) -----
projectRouter.get(
  "/",
  reviewerOnly,
  validate(listQuerySchema, "query"),
  ctrl.listAll,
);
projectRouter.get("/stats", reviewerOnly, ctrl.stats);
projectRouter.get(
  "/export.csv",
  reviewerOnly,
  validate(listQuerySchema, "query"),
  ctrl.exportCsv,
);
projectRouter.patch(
  "/:id/review",
  reviewerOnly,
  validate(idParamSchema, "params"),
  validate(reviewSchema),
  ctrl.review,
);
