import { ObjectId } from "mongodb";
import { Router } from "express";
import { getDatabase } from "../config/database.js";
import { ApiError } from "../lib/api-error.js";
import { requireAuthentication, requireRole } from "../middleware/auth.js";
import { captureUpload } from "../middleware/upload.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { evaluateGeofence, parseLocationFix } from "../services/geofence.js";
import { verifyCaptures } from "../services/face-client.js";
import { writeAuditEvent } from "../services/audit.js";

const router = Router();
const attendanceLimit = rateLimit({
  windowMs: 60_000,
  maxRequests: 5,
  key: (request) => request.user?.studentId || request.ip,
});

function publicGeofenceError(code) {
  const messages = {
    LOCATION_INVALID: [400, "Provide a valid current location."],
    LOCATION_TIMESTAMP_INVALID: [400, "Refresh your location and try again."],
    HOSTEL_NOT_CONFIGURED: [503, "The hostel location is not configured yet."],
    LOCATION_STALE: [422, "Your location is out of date. Get a fresh location fix and retry."],
    LOCATION_ACCURACY_LOW: [422, "Your location is not accurate enough. Move to a clearer area and retry."],
    OUTSIDE_GEOFENCE: [422, "You appear to be outside the attendance area."],
    LOCATION_BOUNDARY_UNCERTAIN: [422, "Your location is near the attendance boundary. Get a more accurate fix and retry."],
  };
  const [status, message] = messages[code] || [422, "Your location could not be verified."];
  return new ApiError(status, code, message);
}

async function rejectAttempt(request, sessionId, error) {
  await writeAuditEvent({
    actorId: request.user.studentId,
    actorRole: "student",
    eventType: "attendance.rejected",
    targetId: sessionId || null,
    outcome: error.code,
    requestId: request.requestId,
  });
  throw error;
}

router.post(
  "/attendance",
  requireAuthentication,
  requireRole("student"),
  attendanceLimit,
  captureUpload.array("captures", 3),
  async (request, response) => {
    const { sessionId } = request.body || {};
    if (typeof sessionId !== "string" || !/^[a-f\d]{24}$/i.test(sessionId)) {
      return rejectAttempt(
        request,
        null,
        new ApiError(400, "VALIDATION_ERROR", "A valid sessionId is required."),
      );
    }
    if (!request.files || request.files.length !== 3) {
      return rejectAttempt(
        request,
        sessionId,
        new ApiError(400, "CAPTURE_SEQUENCE_REQUIRED", "Submit three short camera frames to verify attendance."),
      );
    }

    const database = getDatabase();
    const objectId = new ObjectId(sessionId);
    const session = await database.collection("attendanceSessions").findOne({ _id: objectId });
    if (!session || session.hostelId !== request.user.hostelId) {
      return rejectAttempt(
        request,
        sessionId,
        new ApiError(404, "SESSION_NOT_FOUND", "This attendance session is not available."),
      );
    }

    const records = database.collection("attendanceRecords");
    const existing = await records.findOne({ studentId: request.user.studentId, sessionId: objectId });
    if (existing) {
      return rejectAttempt(request, sessionId, new ApiError(409, "ALREADY_MARKED", "Attendance is already recorded for this session."));
    }

    const now = new Date();
    if (session.status === "closed") {
      return rejectAttempt(request, sessionId, new ApiError(409, "SESSION_CLOSED", "This attendance session is closed."));
    }
    if (now < session.startAt) {
      return rejectAttempt(request, sessionId, new ApiError(409, "SESSION_NOT_OPEN", "This attendance session has not started."));
    }
    if (now >= session.endAt) {
      return rejectAttempt(request, sessionId, new ApiError(409, "SESSION_EXPIRED", "This attendance session has ended."));
    }

    const profile = await database.collection("students").findOne(
      { studentId: request.user.studentId, status: "active", "faceTemplate.embedding": { $exists: true } },
      { projection: { faceTemplate: 1 } },
    );
    if (!profile?.faceTemplate?.embedding) {
      return rejectAttempt(request, sessionId, new ApiError(409, "FACE_PROFILE_MISSING", "A face profile is not available for this account."));
    }

    const hostel = await database.collection("hostels").findOne({ _id: request.user.hostelId, status: "active" });
    if (!hostel) {
      return rejectAttempt(request, sessionId, publicGeofenceError("HOSTEL_NOT_CONFIGURED"));
    }

    const location = parseLocationFix(request.body, now);
    if (location.error) {
      return rejectAttempt(request, sessionId, publicGeofenceError(location.error));
    }
    const geofence = evaluateGeofence(location, hostel.geofence);
    if (geofence.error) {
      return rejectAttempt(request, sessionId, publicGeofenceError(geofence.error));
    }

    let faceResult;
    try {
      faceResult = await verifyCaptures(request.files, profile.faceTemplate.embedding);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectAttempt(request, sessionId, error);
      }
      throw error;
    }

    const markedAt = new Date();
    const record = {
      studentId: request.user.studentId,
      sessionId: objectId,
      hostelId: session.hostelId,
      sessionTitle: session.title,
      markedAt,
      status: "present",
      verification: {
        liveness: "passed",
        faceMatch: "passed",
        faceModel: faceResult.model,
        facePolicyVersion: faceResult.thresholdVersion,
        framesChecked: faceResult.framesChecked,
      },
      locationAudit: {
        passed: true,
        distanceMeters: Math.round(geofence.distanceMeters * 10) / 10,
        accuracyMeters: Math.round(location.accuracyMeters * 10) / 10,
        fixAgeSeconds: Math.round(location.ageSeconds * 10) / 10,
      },
      createdAt: markedAt,
    };

    try {
      const insert = await records.insertOne(record);
      await writeAuditEvent({
        actorId: request.user.studentId,
        actorRole: "student",
        eventType: "attendance.accepted",
        targetId: sessionId,
        outcome: "present",
        requestId: request.requestId,
        metadata: { recordId: insert.insertedId.toHexString(), model: faceResult.model },
      });
      response.status(201).json({
        attendanceId: insert.insertedId.toHexString(),
        sessionId,
        status: "present",
        markedAt,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return rejectAttempt(request, sessionId, new ApiError(409, "ALREADY_MARKED", "Attendance is already recorded for this session."));
      }
      throw error;
    }
  },
);

export default router;
