import "dotenv/config";
import { defineConfig } from "prisma/config";

// Read DATABASE_URL straight from the environment instead of importing src/config/env.
// That file validates *every* variable and calls process.exit(1), which would make
// `prisma generate` (run on every Vercel install via postinstall) fail for unrelated reasons.
export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
