import { getDatabase } from "../config/database.js";

export async function writeAuditEvent({
  actorId,
  actorRole,
  eventType,
  targetId = null,
  outcome = null,
  requestId,
  metadata = {},
}) {
  await getDatabase().collection("auditEvents").insertOne({
    actorId,
    actorRole,
    eventType,
    targetId,
    outcome,
    requestId,
    metadata,
    createdAt: new Date(),
  });
}
