import { Prisma, ProjectStatus } from "../../generated/prisma/client";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { normalizeUrl } from "../../lib/url";
import type { ListQuery, ProjectInput, ReviewInput } from "./project.schema";

const MAX_PENDING_PER_STUDENT = 5;

export const projectSelect = {
  id: true,
  name: true,
  repoUrl: true,
  liveUrl: true,
  description: true,
  status: true,
  feedback: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  submittedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.ProjectSelect;

function buildWhere(
  q: Pick<ListQuery, "status" | "search">,
  extra: Prisma.ProjectWhereInput = {},
) {
  const where: Prisma.ProjectWhereInput = { ...extra };
  if (q.status) where.status = q.status;
  if (q.search) {
    const contains = { contains: q.search, mode: "insensitive" as const };
    where.OR = [
      { name: contains },
      { repoUrl: contains },
      { submittedBy: { name: contains } },
      { submittedBy: { email: contains } },
    ];
  }
  return where;
}

async function paginate(where: Prisma.ProjectWhereInput, q: ListQuery) {
  // Ensure page and limit are strictly numbers
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 10;
  const sortBy = q.sortBy || "createdAt";
  const order = q.order || "desc";

  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      select: projectSelect,
      orderBy: [
        { [sortBy]: order } as Prisma.ProjectOrderByWithRelationInput,
        { id: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function assertNotDuplicate(
  repoUrlNormalized: string,
  liveUrlNormalized: string,
  excludeId?: string,
) {
  const dup = await prisma.project.findFirst({
    where: {
      OR: [{ repoUrlNormalized }, { liveUrlNormalized }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { repoUrlNormalized: true },
  });
  if (dup) {
    throw new AppError(
      409,
      dup.repoUrlNormalized === repoUrlNormalized
        ? "This repository has already been submitted"
        : "This live link has already been submitted",
      [
        {
          field:
            dup.repoUrlNormalized === repoUrlNormalized ? "repoUrl" : "liveUrl",
          message: "Already submitted",
        },
      ],
    );
  }
}

// ---------- student ----------
export async function createProject(userId: string, input: ProjectInput) {
  const repoUrlNormalized = normalizeUrl(input.repoUrl);
  const liveUrlNormalized = normalizeUrl(input.liveUrl);

  const pending = await prisma.project.count({
    where: { submittedById: userId, status: ProjectStatus.PENDING },
  });
  if (pending >= MAX_PENDING_PER_STUDENT) {
    throw new AppError(
      429,
      `You already have ${MAX_PENDING_PER_STUDENT} projects awaiting review. Wait for a review before submitting more.`,
    );
  }

  await assertNotDuplicate(repoUrlNormalized, liveUrlNormalized);

  // The unique indexes still protect against a race between the check above and the insert
  // (a P2002 is mapped to HTTP 409 by the error handler).
  return prisma.project.create({
    data: {
      ...input,
      repoUrlNormalized,
      liveUrlNormalized,
      submittedById: userId,
    },
    select: projectSelect,
  });
}

export const listMine = (userId: string, q: ListQuery) =>
  paginate(buildWhere(q, { submittedById: userId }), q);

async function getOwned(userId: string, id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, status: true, submittedById: true },
  });
  if (!project || project.submittedById !== userId)
    throw new AppError(404, "Project not found");
  if (project.status === ProjectStatus.APPROVED)
    throw new AppError(409, "Approved projects can no longer be changed");
  return project;
}

/** Students may fix a pending or rejected project; it goes back into the review queue. */
export async function updateOwnProject(
  userId: string,
  id: string,
  input: ProjectInput,
) {
  await getOwned(userId, id);
  const repoUrlNormalized = normalizeUrl(input.repoUrl);
  const liveUrlNormalized = normalizeUrl(input.liveUrl);
  await assertNotDuplicate(repoUrlNormalized, liveUrlNormalized, id);

  return prisma.project.update({
    where: { id },
    data: {
      ...input,
      repoUrlNormalized,
      liveUrlNormalized,
      status: ProjectStatus.PENDING,
      feedback: null,
      reviewedAt: null,
      reviewedById: null,
    },
    select: projectSelect,
  });
}

export async function deleteOwnProject(userId: string, id: string) {
  await getOwned(userId, id);
  await prisma.project.delete({ where: { id } });
}

// ---------- mentor / admin ----------
export const listAll = (q: ListQuery) => paginate(buildWhere(q), q);

export async function reviewProject(
  reviewerId: string,
  id: string,
  input: ReviewInput,
) {
  // Atomic guard: only a PENDING project can be reviewed, so two mentors can't overwrite each other.
  const { count } = await prisma.project.updateMany({
    where: { id, status: ProjectStatus.PENDING },
    data: {
      status: input.status,
      feedback: input.feedback || null,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });

  if (count === 0) {
    const exists = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new AppError(404, "Project not found");
    throw new AppError(409, "This project has already been reviewed");
  }
  return prisma.project.findUniqueOrThrow({
    where: { id },
    select: projectSelect,
  });
}

export async function getStats() {
  const [groups, last7] = await Promise.all([
    prisma.project.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.project.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  const c: Record<ProjectStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  groups.forEach((g) => (c[g.status] = g._count._all));
  const reviewed = c.APPROVED + c.REJECTED;
  return {
    total: c.PENDING + reviewed,
    pending: c.PENDING,
    approved: c.APPROVED,
    rejected: c.REJECTED,
    approvalRate: reviewed ? Math.round((c.APPROVED / reviewed) * 100) : 0,
    submittedLast7Days: last7,
  };
}

export async function exportProjects(q: ListQuery) {
  return prisma.project.findMany({
    where: buildWhere(q),
    select: projectSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 5000,
  });
}
