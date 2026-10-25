import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../../.env") });

const { closeDatabase, connectToDatabase, getDatabase } =
  await import("../src/config/database.js");
const adminId = process.argv[2]?.trim();
const name = process.argv[3]?.trim();
const googleEmail = process.argv[4]?.trim().toLowerCase();
const transferFromStudentId = process.argv[5]?.trim();

try {
  if (!adminId || !name || !googleEmail || !transferFromStudentId) {
    throw new Error(
      "Usage: npm run create-admin -- <adminId> <name> <googleEmail> <studentIdToUnlink>",
    );
  }
  if (!/^admin_[a-z0-9_-]{2,50}$/i.test(adminId)) {
    throw new Error("adminId must start with 'admin_' and use letters, numbers, underscores, or hyphens");
  }
  if (!name || name.length > 200) throw new Error("name must be 1–200 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleEmail)) {
    throw new Error("googleEmail must be a valid email address");
  }

  await connectToDatabase();
  const database = getDatabase();
  const users = database.collection("users");
  const hostelId = process.env.HOSTEL_ID || process.env.DEFAULT_HOSTEL_ID || "hostel_demo";
  const hostel = await database.collection("hostels").findOne({ _id: hostelId, status: "active" });
  if (!hostel) throw new Error(`Hostel ${hostelId} is not configured and active`);
  if (await database.collection("students").findOne({ studentId: adminId })) {
    throw new Error(`${adminId} is already a student ID; choose a separate admin ID`);
  }

  if (transferFromStudentId === adminId) {
    throw new Error("The source student and separate admin account must have different IDs");
  }
  const sourceAccount = await users.findOne({ studentId: transferFromStudentId });
  if (!sourceAccount) throw new Error(`No account found for ${transferFromStudentId}`);
  const targetAccount = await users.findOne({ studentId: adminId });
  if (targetAccount && !targetAccount.roles?.includes("admin")) {
    throw new Error(`${adminId} already belongs to a non-admin account`);
  }
  if (targetAccount?.googleEmail && targetAccount.googleEmail !== googleEmail) {
    throw new Error(`${adminId} is already linked to a different Google email`);
  }

  const emailOwner = await users.findOne({ googleEmail });
  if (emailOwner && emailOwner.studentId !== transferFromStudentId && emailOwner.studentId !== adminId) {
    throw new Error("That Google email is already linked to a different account");
  }

  const now = new Date();
  await users.updateOne(
    { studentId: adminId },
    {
      $set: {
        name,
        status: "active",
        roles: ["admin"],
        hostelId,
        hostelIds: [hostelId],
        googleEmail,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  if (sourceAccount.roles?.includes("admin") || sourceAccount.googleEmail === googleEmail) {
    const remainingHostels = (sourceAccount.hostelIds || []).filter((id) => id !== hostelId);
    const remainingRoles = (sourceAccount.roles || []).filter((role) =>
      role !== "admin" || remainingHostels.length > 0,
    );
    const unset = sourceAccount.googleEmail === googleEmail ? { googleEmail: "" } : undefined;
    const update = { $set: { roles: remainingRoles, hostelIds: remainingHostels, updatedAt: now } };
    if (unset) update.$unset = unset;
    await users.updateOne(
      { studentId: transferFromStudentId },
      update,
    );
    await database.collection("auditEvents").insertOne({
      actorId: "local-operator",
      actorRole: "system_operator",
      eventType: "user.admin_revoked",
      targetId: transferFromStudentId,
      outcome: "separate_admin_account_created",
      requestId: randomUUID(),
      createdAt: now,
    });
  }

  await database.collection("auditEvents").insertOne({
    actorId: "local-operator",
    actorRole: "system_operator",
    eventType: "user.admin_granted",
    targetId: adminId,
    outcome: "separate_admin_account_created",
    requestId: randomUUID(),
    createdAt: now,
  });
  console.log(`${adminId} can administer ${hostelId}; student account ${transferFromStudentId} remains separate`);
} catch (error) {
  console.error(`Could not create admin access: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
