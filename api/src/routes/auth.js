import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { getDatabase } from "../config/database.js";
import { ApiError } from "../lib/api-error.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { createAccessToken, equalSecret } from "../security/tokens.js";
import { writeAuditEvent } from "../services/audit.js";

const router = Router();
const loginLimit = rateLimit({ windowMs: 60_000, maxRequests: 10 });
const googleClient = new OAuth2Client();

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

router.post("/google-session", loginLimit, async (request, response) => {
  const idToken = request.body?.idToken;
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 10_000) {
    throw new ApiError(400, "VALIDATION_ERROR", "A Google ID token is required.");
  }

  const audiences = (process.env.GOOGLE_OAUTH_CLIENT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (audiences.length === 0) {
    throw new ApiError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "Google sign-in is not configured yet.");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: audiences });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, "AUTH_REQUIRED", "Google sign-in was not accepted.");
  }

  const googleEmail = payload?.email?.trim().toLowerCase();
  if (!googleEmail || payload.email_verified !== true) {
    throw new ApiError(401, "AUTH_REQUIRED", "Google sign-in was not accepted.");
  }

  const user = await getDatabase().collection("users").findOne(
    { googleEmail, status: "active" },
    { projection: { _id: 0, studentId: 1, name: 1, roles: 1 } },
  );
  if (!user) {
    throw new ApiError(403, "ACCOUNT_NOT_LINKED", "This Google account is not linked to an active AttendX account.");
  }

  await writeAuditEvent({
    actorId: user.studentId,
    actorRole: user.roles?.includes("admin") ? "admin" : "student",
    eventType: "auth.google_session",
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
