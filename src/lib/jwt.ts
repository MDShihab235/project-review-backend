import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "../generated/prisma/client";
import { env } from "../config/env";

export interface TokenPayload {
  sub: string;
  role: Role;
}

export const signToken = (userId: string, role: Role) =>
  jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });

export const verifyToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload & jwt.JwtPayload;
