import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../../.env") });

const { closeDatabase, connectToDatabase } = await import("../src/config/database.js");
const studentId = process.argv[2]?.trim();

try {
  if (!studentId) throw new Error("Usage: npm run grant-admin -- <studentId>");
  await connectToDatabase();

  const users = (await import("../src/config/database.js")).getDatabase().collection("users");
  const user = await users.findOne({ studentId, status: "active" });
  if (!user) throw new Error(`No active account found for ${studentId}`);
  if (!user.hostelId) throw new Error(`No hostel assignment is configured for ${studentId}`);

  await users.updateOne(
    { studentId },
    {
      $addToSet: { roles: "admin", hostelIds: user.hostelId },
      $set: { updatedAt: new Date() },
    },
  );
  await (await import("../src/config/database.js")).getDatabase()
    .collection("auditEvents")
    .insertOne({
      actorId: "local-operator",
      actorRole: "system_operator",
      eventType: "user.admin_granted",
      targetId: studentId,
      outcome: "granted",
      requestId: randomUUID(),
      createdAt: new Date(),
    });
  console.log(`${studentId} can now administer ${user.hostelId}`);
} catch (error) {
  console.error(`Could not grant admin access: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
