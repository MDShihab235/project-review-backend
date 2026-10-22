import bcrypt from "bcryptjs";
import { CookieOptions, Response } from "express";
import { Role } from "../../generated/prisma/client";
import { env, isProd } from "../../config/env";
import { AppError } from "../../lib/errors";
import { asyncHandler, ok } from "../../lib/http";
import { signToken } from "../../lib/jwt";
import { prisma } from "../../lib/prisma";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd || env.COOKIE_SAME_SITE === "none",
  sameSite: env.COOKIE_SAME_SITE,
  path: "/",
};

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const publicUser = (u: {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
});

function startSession(res: Response, user: { id: string; role: Role }) {
  const token = signToken(user.id, user.role);
  res.cookie("token", token, { ...cookieOptions, maxAge: COOKIE_MAX_AGE });
  return token;
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    throw new AppError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  // Role is never taken from the request body: public signup is always STUDENT.
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: Role.STUDENT },
  });

  const token = startSession(res, user);
  ok(res, { user: publicUser(user), token }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  if (!user || !valid) throw new AppError(401, "Invalid email or password");

  const token = startSession(res, user);
  ok(res, { user: publicUser(user), token });
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie("token", cookieOptions);
  ok(res, { message: "Logged out" });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new AppError(401, "Account no longer exists");
  ok(res, publicUser(user));
});
