import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(scriptDirectory, "..");
const projectDirectory = path.resolve(apiDirectory, "..");
dotenv.config({ path: path.join(projectDirectory, ".env") });

const { closeDatabase, connectToDatabase, getDatabase } =
  await import("../src/config/database.js");
const manifestPath = path.resolve(
  process.argv[2] || path.join(apiDirectory, "students.json"),
);

function requiredText(value, field, index, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Manifest entry ${index + 1}: ${field} must be 1–${maxLength} characters`);
  }
  return value.trim();
}

function optionalRoom(value, index) {
  if (value == null || value === "") return null;
  return requiredText(value, "roomNumber", index, 30);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the root .env file");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("The student manifest must be a non-empty JSON array");
  }

  const entries = manifest.map((entry, index) => ({
    studentId: requiredText(entry.studentId, "studentId", index, 100),
    name: requiredText(entry.name, "name", index, 200),
    roomNumber: optionalRoom(entry.roomNumber, index),
  }));
  if (new Set(entries.map((entry) => entry.studentId)).size !== entries.length) {
    throw new Error("The manifest contains duplicate studentId values");
  }

  await connectToDatabase();
  const database = getDatabase();
  const studentIds = entries.map((entry) => entry.studentId);
  const [studentIdsInDatabase, userIdsInDatabase] = await Promise.all([
    database.collection("students").distinct("studentId", { studentId: { $in: studentIds } }),
    database.collection("users").distinct("studentId", { studentId: { $in: studentIds } }),
  ]);
  const missingStudents = studentIds.filter((id) => !studentIdsInDatabase.includes(id));
  const missingUsers = studentIds.filter((id) => !userIdsInDatabase.includes(id));
  if (missingStudents.length || missingUsers.length) {
    throw new Error(`Missing imported student/user records: ${[...new Set([...missingStudents, ...missingUsers])].join(", ")}`);
  }

  for (const entry of entries) {
    const now = new Date();
    const studentUpdate = { $set: { name: entry.name, updatedAt: now } };
    const userUpdate = { $set: { name: entry.name, updatedAt: now } };
    if (entry.roomNumber) {
      studentUpdate.$set.roomNumber = entry.roomNumber;
      userUpdate.$set.roomNumber = entry.roomNumber;
    } else {
      studentUpdate.$unset = { roomNumber: "" };
      userUpdate.$unset = { roomNumber: "" };
    }

    const studentResult = await database.collection("students").updateOne(
      { studentId: entry.studentId },
      studentUpdate,
    );
    if (studentResult.matchedCount !== 1) {
      throw new Error(`${entry.studentId}: no imported student record exists`);
    }
    const userResult = await database.collection("users").updateOne(
      { studentId: entry.studentId },
      userUpdate,
    );
    if (userResult.matchedCount !== 1) {
      throw new Error(`${entry.studentId}: no user account exists`);
    }
    console.log(`${entry.studentId}: roster details synced`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`Roster sync failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
