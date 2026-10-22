import { asyncHandler, ok } from "../../lib/http";
import * as service from "./project.service";

export const create = asyncHandler(async (req, res) => {
  ok(res, await service.createProject(req.user!.id, req.body), 201);
});

export const listMine = asyncHandler(async (req, res) => {
  ok(res, await service.listMine(req.user!.id, req.query as any));
});

export const update = asyncHandler(async (req, res) => {
  ok(
    res,
    await service.updateOwnProject(
      req.user!.id,
      String(req.params.id),
      req.body,
    ),
  );
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteOwnProject(req.user!.id, String(req.params.id));
  res.status(204).end();
});

export const listAll = asyncHandler(async (req, res) => {
  try {
    // Your call to project service
    const result = await service.listAll(req.query as any);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    // 🔥 Print the exact stack trace and error message to your backend terminal
    console.error("🔴 CRASH DETAILS FOR GET /api/projects:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
});

export const stats = asyncHandler(async (_req, res) => {
  ok(res, await service.getStats());
});

export const review = asyncHandler(async (req, res) => {
  ok(
    res,
    await service.reviewProject(req.user!.id, String(req.params.id), req.body),
  );
});

// Neutralise spreadsheet formula injection (=, +, -, @) and escape quotes.
const csvCell = (value: unknown) => {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const exportCsv = asyncHandler(async (req, res) => {
  const rows = await service.exportProjects(req.query as any);
  const header = [
    "Name",
    "Repo URL",
    "Live URL",
    "Status",
    "Submitted by",
    "Email",
    "Submitted at",
    "Reviewed at",
    "Feedback",
  ];
  const lines = rows.map((p) =>
    [
      p.name,
      p.repoUrl,
      p.liveUrl,
      p.status,
      p.submittedBy.name,
      p.submittedBy.email,
      p.createdAt.toISOString(),
      p.reviewedAt?.toISOString() ?? "",
      p.feedback ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="projects.csv"');
  res.send([header.map(csvCell).join(","), ...lines].join("\r\n"));
});
