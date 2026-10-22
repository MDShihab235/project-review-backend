import type { Role } from "../generated/prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: Role };
  }
}

export {};
