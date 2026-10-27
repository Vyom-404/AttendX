import { getDatabase } from "../config/database.js";

const TEMPLATE_DIMENSION = 512;

/**
 * Save or replace a precomputed InsightFace template for one student.
 * Keep this helper internal until student admin authentication is implemented.
 */
export async function saveStudentTemplate({
  studentId,
  name,
  roomNumber,
  embedding,
  acceptedImages,
  model = "buffalo_l",
}) {
  const cleanStudentId = requireText(studentId, "studentId", 100);
  const cleanName = requireText(name, "name", 200);
  const cleanRoomNumber = roomNumber == null || roomNumber === ""
    ? null
    : requireText(roomNumber, "roomNumber", 30);

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
  const studentFields = {
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
  };
  if (cleanRoomNumber) studentFields.roomNumber = cleanRoomNumber;

  await students.updateOne(
    { studentId: cleanStudentId },
    {
      $set: studentFields,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const userFields = { name: cleanName, status: "active", updatedAt: now };
  if (cleanRoomNumber) userFields.roomNumber = cleanRoomNumber;

  await getDatabase().collection("users").updateOne(
    { studentId: cleanStudentId },
    {
      $set: userFields,
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
