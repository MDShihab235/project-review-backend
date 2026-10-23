import "./types/express.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { projectRouter } from "./modules/projects/project.routes.js";

export const app = express();

if (isProd) app.set("trust proxy", 1); // so rate limiting sees the real client IP behind a proxy

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN.split(","), credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan(isProd ? "combined" : "dev"));

app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() }),
);

app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
