import { Router } from "express";
import { getDatabase } from "../config/database.js";
import { requireAuthentication, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/sessions/active", requireAuthentication, requireRole("student"), async (request, response) => {
  const now = new Date();
  const session = await getDatabase().collection("attendanceSessions").findOne(
    {
      hostelId: request.user.hostelId,
      status: { $ne: "closed" },
      startAt: { $lte: now },
      endAt: { $gt: now },
    },
    {
      projection: { title: 1, hostelId: 1, startAt: 1, endAt: 1, status: 1 },
      sort: { startAt: -1 },
    },
  );

  response.json({
    session: session ? { ...session, status: "open" } : null,
    serverTime: now,
  });
});

export default router;
