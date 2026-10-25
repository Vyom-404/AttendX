import { Router } from "express";
import { getDatabase } from "../config/database.js";
import { requireAuthentication } from "../middleware/auth.js";

const router = Router();

router.get("/me", requireAuthentication, async (request, response) => {
  const profile = await getDatabase().collection("students").findOne(
    { studentId: request.user.studentId, status: "active", "faceTemplate.embedding": { $exists: true } },
    { projection: {
      _id: 0,
      "faceTemplate.model": 1,
      "faceTemplate.dimension": 1,
      "faceTemplate.updatedAt": 1,
    } },
  );

  response.json({
    user: request.user,
    faceEnrolled: Boolean(profile),
    faceModel: profile?.faceTemplate?.model || null,
  });
});

router.get("/attendance/me", requireAuthentication, async (request, response) => {
  const page = Math.max(1, Number.parseInt(request.query.page || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(request.query.limit || "20", 10) || 20));
  const collection = getDatabase().collection("attendanceRecords");
  const query = { studentId: request.user.studentId };
  const [records, total, recentAttempts] = await Promise.all([
    collection.find(query, {
      projection: { _id: 1, sessionId: 1, sessionTitle: 1, markedAt: 1, status: 1 },
    }).sort({ markedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collection.countDocuments(query),
    getDatabase().collection("auditEvents").find(
      { actorId: request.user.studentId, eventType: "attendance.rejected" },
      { projection: { _id: 0, targetId: 1, outcome: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).limit(10).toArray(),
  ]);

  response.json({ records, recentAttempts, page, limit, total });
});

export default router;
