import { Router } from "express";
import { getDatabase } from "../config/database.js";
import { ApiError } from "../lib/api-error.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { createAccessToken, equalSecret } from "../security/tokens.js";
import { writeAuditEvent } from "../services/audit.js";

const router = Router();
const loginLimit = rateLimit({ windowMs: 60_000, maxRequests: 10 });

router.post("/dev-session", loginLimit, async (request, response) => {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_LOGIN !== "true") {
    throw new ApiError(404, "NOT_FOUND", "This sign-in method is unavailable.");
  }

  const { studentId, secret } = request.body || {};
  const expectedSecret = process.env.DEV_LOGIN_SECRET;
  if (!expectedSecret || !equalSecret(secret, expectedSecret)) {
    throw new ApiError(401, "AUTH_REQUIRED", "The sign-in details were not accepted.");
  }

  if (typeof studentId !== "string" || !studentId.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", "studentId is required.");
  }

  const user = await getDatabase().collection("users").findOne(
    { studentId: studentId.trim(), status: "active" },
    { projection: { _id: 0, studentId: 1, name: 1, roles: 1 } },
  );
  if (!user) {
    throw new ApiError(401, "AUTH_REQUIRED", "The sign-in details were not accepted.");
  }

  await writeAuditEvent({
    actorId: user.studentId,
    actorRole: user.roles?.includes("admin") ? "admin" : "student",
    eventType: "auth.dev_session",
    outcome: "success",
    requestId: request.requestId,
  });

  response.json({
    accessToken: createAccessToken(user.studentId),
    tokenType: "Bearer",
    expiresInSeconds: 900,
    user,
  });
});

export default router;
