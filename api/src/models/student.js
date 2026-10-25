import { getDatabase } from "../config/database.js";

const TEMPLATE_DIMENSION = 512;

/**
 * Save or replace a precomputed InsightFace template for one student.
 * Keep this helper internal until student admin authentication is implemented.
 */
export async function saveStudentTemplate({
  studentId,
  name,
  embedding,
  acceptedImages,
  model = "buffalo_l",
}) {
  const cleanStudentId = requireText(studentId, "studentId", 100);
  const cleanName = requireText(name, "name", 200);

  if (!Array.isArray(embedding) || embedding.length !== TEMPLATE_DIMENSION) {
    throw new TypeError(`embedding must contain ${TEMPLATE_DIMENSION} numbers`);
  }

  const vector = embedding.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("embedding values must be finite numbers");
    }
    return value;
  });

  const vectorNorm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  if (vectorNorm < 0.99 || vectorNorm > 1.01) {
    throw new TypeError("embedding must be normalized before it is stored");
  }

  if (!Number.isInteger(acceptedImages) || acceptedImages < 3) {
    throw new TypeError("acceptedImages must be an integer of at least 3");
  }

  const now = new Date();
  const students = getDatabase().collection("students");

  await students.updateOne(
    { studentId: cleanStudentId },
    {
      $set: {
        name: cleanName,
        status: "active",
        faceTemplate: {
          model,
          preprocessingVersion: "insightface-default-1",
          dimension: TEMPLATE_DIMENSION,
          embedding: vector,
          acceptedImages,
          updatedAt: now,
        },
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  await getDatabase().collection("users").updateOne(
    { studentId: cleanStudentId },
    {
      $set: { name: cleanName, status: "active", updatedAt: now },
      $setOnInsert: {
        roles: ["student"],
        hostelId: process.env.HOSTEL_ID || process.env.DEFAULT_HOSTEL_ID || "hostel_demo",
        hostelIds: [],
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/** Return a student's template only for internal identity verification. */
export async function findActiveStudentTemplate(studentId) {
  const cleanStudentId = requireText(studentId, "studentId", 100);
  return getDatabase().collection("students").findOne(
    { studentId: cleanStudentId, status: "active", "faceTemplate.embedding": { $exists: true } },
    {
      projection: {
        _id: 0,
        studentId: 1,
        name: 1,
        faceTemplate: 1,
      },
    },
  );
}

function requireText(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be text`);
  }

  const cleanValue = value.trim();
  if (!cleanValue || cleanValue.length > maxLength) {
    throw new TypeError(`${field} must be between 1 and ${maxLength} characters`);
  }

  return cleanValue;
}
