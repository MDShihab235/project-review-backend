// import { PrismaClient } from "../generated/prisma/client.js";

// const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// export const prisma = globalForPrisma.prisma ?? new PrismaClient();
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
