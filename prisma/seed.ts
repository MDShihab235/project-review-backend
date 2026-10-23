import {
  PrismaClient,
  ProjectStatus,
  Role,
} from "../src/generated/prisma/client.js"; // Adjust path to your generated client
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import bcrypt from "bcryptjs";

// Setup connection pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Pass the adapter into PrismaClient
const prisma = new PrismaClient({ adapter });

// declare const process: {
//   env: Record<string, string | undefined>;
//   exit(code?: number): never;
// };

// const prisma = new PrismaClient();

async function upsertUser(
  name: string,
  email: string,
  password: string,
  role: Role,
) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role },
    create: { name, email: email.toLowerCase(), passwordHash, role },
  });
}

async function main() {
  const admin = await upsertUser(
    "Admin",
    process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
    Role.ADMIN,
  );
  await upsertUser(
    "Demo Mentor",
    process.env.SEED_MENTOR_EMAIL ?? "mentor@example.com",
    process.env.SEED_MENTOR_PASSWORD ?? "Mentor@12345",
    Role.MENTOR,
  );
  console.log(`Seeded admin: ${admin.email}`);

  if (process.env.SEED_DEMO === "true") {
    const student = await upsertUser(
      "Demo Student",
      "student@example.com",
      "Student@12345",
      Role.STUDENT,
    );
    const statuses: ProjectStatus[] = ["PENDING", "APPROVED", "REJECTED"];
    for (let i = 1; i <= 25; i++) {
      const status = statuses[i % 3];
      const repo = `https://github.com/demo-student/project-${i}`;
      const live = `https://project-${i}.demo-student.dev`;
      await prisma.project.upsert({
        where: { repoUrlNormalized: repo },
        update: {},
        create: {
          name: `Demo Project ${i}`,
          repoUrl: repo,
          liveUrl: live,
          repoUrlNormalized: repo,
          liveUrlNormalized: live,
          description: `Sample project number ${i} created by the seed script for testing pagination and filters.`,
          status,
          feedback:
            status === "REJECTED"
              ? "Please add a README with setup instructions."
              : null,
          reviewedAt: status === "PENDING" ? null : new Date(),
          reviewedById: status === "PENDING" ? null : admin.id,
          submittedById: student.id,
        },
      });
    }
    console.log(
      "Seeded demo student (student@example.com / Student@12345) and 25 projects",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
