import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../../.env") });

const { closeDatabase, connectToDatabase, getDatabase } =
  await import("../src/config/database.js");
const studentId = process.argv[2]?.trim();
const googleEmail = process.argv[3]?.trim().toLowerCase();

try {
  if (!studentId || !googleEmail) {
    throw new Error("Usage: npm run link-google-email -- <studentId> <googleEmail>");
  }
  if (!/^[a-z0-9_-]{2,100}$/i.test(studentId)) {
    throw new Error("studentId must use letters, numbers, underscores, or hyphens");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail)) {
    throw new Error("googleEmail must be a valid email address");
  }

  await connectToDatabase();
  const database = getDatabase();
  const users = database.collection("users");
  const user = await users.findOne({ studentId, status: "active" });
  if (!user) throw new Error(`No active account found for ${studentId}`);
  if (user.googleEmail && user.googleEmail !== googleEmail) {
    throw new Error(`${studentId} is already linked to another Google account`);
  }

  const emailOwner = await users.findOne({ googleEmail, studentId: { $ne: studentId } });
  if (emailOwner) throw new Error("That Google account is already linked to another AttendX account");

  const now = new Date();
  await users.updateOne(
    { studentId, status: "active" },
    { $set: { googleEmail, updatedAt: now } },
  );
  await database.collection("auditEvents").insertOne({
    actorId: "local-operator",
    actorRole: "system_operator",
    eventType: "user.google_email_linked",
    targetId: studentId,
    outcome: "success",
    requestId: randomUUID(),
    createdAt: now,
  });
  console.log(`${studentId}: Google account linked`);
} catch (error) {
  console.error(`Could not link Google account: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
