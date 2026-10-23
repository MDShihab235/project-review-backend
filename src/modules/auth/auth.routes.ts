import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { login, logout, me, signup } from "./auth.controller.js";
import { loginSchema, signupSchema } from "./auth.schema.js";

export const authRouter = Router();

authRouter.post("/signup", authLimiter, validate(signupSchema), signup);
authRouter.post("/login", authLimiter, validate(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
