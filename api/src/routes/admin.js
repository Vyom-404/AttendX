import { ObjectId } from "mongodb";
import { Router } from "express";
import { getDatabase } from "../config/database.js";
import { ApiError } from "../lib/api-error.js";
import { requireAuthentication, requireRole } from "../middleware/auth.js";
import { writeAuditEvent } from "../services/audit.js";

const router = Router();

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a valid date and time.`);
  }
  return date;
}

function sessionObjectId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "A valid session ID is required.");
  }
  return new ObjectId(value);
}

function requireAssignedHostel(user, hostelId) {
  if (!Array.isArray(user.hostelIds) || !user.hostelIds.includes(hostelId)) {
    throw new ApiError(403, "FORBIDDEN", "You do not administer this hostel.");
  }
}

function normalizeTitle(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new ApiError(400, "VALIDATION_ERROR", "Session title must be 1–100 characters.");
  }
  return value.trim();
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

async function getSessionForAdmin(request) {
  const id = sessionObjectId(request.params.id);
  const session = await getDatabase().collection("attendanceSessions").findOne({ _id: id });
  if (!session) throw new ApiError(404, "SESSION_NOT_FOUND", "Attendance session not found.");
  requireAssignedHostel(request.user, session.hostelId);
  return session;
}

router.post("/admin/sessions", requireAuthentication, requireRole("admin"), async (request, response) => {
  const body = request.body || {};
  const { hostelId: requestedHostelId } = body;
  const assignedHostels = request.user.hostelIds || [];
  const hostelId = requestedHostelId || (assignedHostels.length === 1 ? assignedHostels[0] : null);
  if (!hostelId) {
    throw new ApiError(400, "VALIDATION_ERROR", "hostelId is required when you administer more than one hostel.");
  }
  requireAssignedHostel(request.user, hostelId);

  const title = normalizeTitle(body.title);
  const startAt = parseDate(body.startAt, "startAt");
  const endAt = parseDate(body.endAt, "endAt");
  if (startAt >= endAt) {
    throw new ApiError(400, "VALIDATION_ERROR", "Session end time must be after its start time.");
  }

  const database = getDatabase();
  const hostel = await database.collection("hostels").findOne({ _id: hostelId, status: "active" });
  if (!hostel) throw new ApiError(404, "HOSTEL_NOT_FOUND", "The assigned hostel is not configured.");

  const now = new Date();
  const session = {
    hostelId,
    title,
    startAt,
    endAt,
    status: "scheduled",
    createdBy: request.user.studentId,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection("attendanceSessions").insertOne(session);
  await writeAuditEvent({
    actorId: request.user.studentId,
    actorRole: "admin",
    eventType: "session.created",
    targetId: result.insertedId.toHexString(),
    outcome: "scheduled",
    requestId: request.requestId,
    metadata: { hostelId },
  });

  response.status(201).json({ session: { ...session, _id: result.insertedId } });
});

router.get("/admin/sessions", requireAuthentication, requireRole("admin"), async (request, response) => {
  const assignedHostels = request.user.hostelIds || [];
  const requestedHostel = request.query.hostelId;
  if (requestedHostel) requireAssignedHostel(request.user, requestedHostel);
  const hostelIds = requestedHostel ? [requestedHostel] : assignedHostels;
  const sessions = await getDatabase().collection("attendanceSessions")
    .find({ hostelId: { $in: hostelIds } })
    .sort({ startAt: -1 })
    .limit(100)
    .toArray();
  response.json({ sessions });
});

router.patch("/admin/sessions/:id", requireAuthentication, requireRole("admin"), async (request, response) => {
  const session = await getSessionForAdmin(request);
  const update = {};
  const body = request.body || {};

  if (Object.hasOwn(body, "title")) update.title = normalizeTitle(body.title);
  if (Object.hasOwn(body, "startAt")) update.startAt = parseDate(body.startAt, "startAt");
  if (Object.hasOwn(body, "endAt")) update.endAt = parseDate(body.endAt, "endAt");
  if (Object.hasOwn(body, "status")) {
    if (body.status !== "closed") {
      throw new ApiError(400, "VALIDATION_ERROR", "A session may only be closed manually; its open state follows server time.");
    }
    update.status = "closed";
  }
  const startAt = update.startAt || session.startAt;
  const endAt = update.endAt || session.endAt;
  if (startAt >= endAt) {
    throw new ApiError(400, "VALIDATION_ERROR", "Session end time must be after its start time.");
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Provide a session field to update.");
  }

  update.updatedAt = new Date();
  await getDatabase().collection("attendanceSessions").updateOne(
    { _id: session._id },
    { $set: update },
  );
  await writeAuditEvent({
    actorId: request.user.studentId,
    actorRole: "admin",
    eventType: "session.updated",
    targetId: session._id.toHexString(),
    outcome: update.status || "updated",
    requestId: request.requestId,
  });
  response.json({ session: { ...session, ...update } });
});

async function sessionRoster(session) {
  const database = getDatabase();
  const [users, records] = await Promise.all([
    database.collection("users")
      .find({ hostelId: session.hostelId, roles: "student", status: "active" }, {
        projection: { _id: 0, studentId: 1, name: 1 },
      })
      .sort({ name: 1 })
      .toArray(),
    database.collection("attendanceRecords")
      .find({ sessionId: session._id })
      .toArray(),
  ]);
  const byStudent = new Map(records.map((record) => [record.studentId, record]));
  return users.map((user) => {
    const record = byStudent.get(user.studentId);
    return {
      attendanceId: record?._id || null,
      studentId: user.studentId,
      name: user.name,
      markedAt: record?.markedAt || null,
      status: record?.status || "absent",
    };
  });
}

router.get("/admin/sessions/:id/attendance", requireAuthentication, requireRole("admin"), async (request, response) => {
  const session = await getSessionForAdmin(request);
  response.json({ session: { _id: session._id, title: session.title, startAt: session.startAt, endAt: session.endAt }, records: await sessionRoster(session) });
});

router.patch("/admin/sessions/:id/attendance/:attendanceId/review", requireAuthentication, requireRole("admin"), async (request, response) => {
  const session = await getSessionForAdmin(request);
  const attendanceId = sessionObjectId(request.params.attendanceId);
  const note = request.body?.note;
  if (typeof note !== "string" || !note.trim() || note.trim().length > 500) {
    throw new ApiError(400, "VALIDATION_ERROR", "A review note of 1–500 characters is required.");
  }

  const result = await getDatabase().collection("attendanceRecords").updateOne(
    { _id: attendanceId, sessionId: session._id },
    {
      $set: {
        manualReview: {
          status: "requested",
          note: note.trim(),
          requestedBy: request.user.studentId,
          requestedAt: new Date(),
        },
      },
    },
  );
  if (result.matchedCount === 0) {
    throw new ApiError(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found for this session.");
  }
  await writeAuditEvent({
    actorId: request.user.studentId,
    actorRole: "admin",
    eventType: "attendance.manual_review_requested",
    targetId: attendanceId.toHexString(),
    outcome: "requested",
    requestId: request.requestId,
    metadata: { sessionId: session._id.toHexString() },
  });
  response.json({ attendanceId: attendanceId.toHexString(), reviewStatus: "requested" });
});

router.get("/admin/sessions/:id/attempts", requireAuthentication, requireRole("admin"), async (request, response) => {
  const session = await getSessionForAdmin(request);
  const events = await getDatabase().collection("auditEvents")
    .find(
      { targetId: session._id.toHexString(), eventType: "attendance.rejected" },
      { projection: { _id: 0, actorId: 1, outcome: 1, createdAt: 1, requestId: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  response.json({ attempts: events });
});

router.get("/admin/sessions/:id/export", requireAuthentication, requireRole("admin"), async (request, response) => {
  const session = await getSessionForAdmin(request);
  const roster = await sessionRoster(session);
  const lines = [
    ["studentId", "name", "session", "markedAt", "status"].map(csvCell).join(","),
    ...roster.map((record) => [record.studentId, record.name, session.title, record.markedAt?.toISOString() || "", record.status].map(csvCell).join(",")),
  ];
  await writeAuditEvent({
    actorId: request.user.studentId,
    actorRole: "admin",
    eventType: "session.exported",
    targetId: session._id.toHexString(),
    outcome: "csv",
    requestId: request.requestId,
    metadata: { rowCount: roster.length },
  });
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="attendx-session-${session._id.toHexString()}.csv"`);
  response.send(lines.join("\r\n"));
});

export default router;
