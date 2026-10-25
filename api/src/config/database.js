import { MongoClient } from "mongodb";

const connectionString = process.env.MONGODB_URI;

if (!connectionString) {
  throw new Error("MONGODB_URI is missing from the project root .env file");
}

const client = new MongoClient(connectionString);

let database;

export async function connectToDatabase() {
  await client.connect();
  await client.db("attendx").command({ ping: 1 });
  database = client.db("attendx");
  await database.collection("students").createIndex(
    { studentId: 1 },
    { unique: true, name: "unique_student_id" },
  );
  await database.collection("students").createIndex(
    { status: 1 },
    { name: "student_status" },
  );
  await database.collection("users").createIndex(
    { studentId: 1 },
    { unique: true, name: "unique_user_student_id" },
  );
  await database.collection("attendanceSessions").createIndex(
    { hostelId: 1, startAt: 1, endAt: 1 },
    { name: "hostel_session_window" },
  );
  await database.collection("attendanceRecords").createIndex(
    { studentId: 1, sessionId: 1 },
    { unique: true, name: "unique_student_session_attendance" },
  );
  await database.collection("attendanceRecords").createIndex(
    { sessionId: 1, markedAt: -1 },
    { name: "session_attendance_time" },
  );
  await database.collection("auditEvents").createIndex(
    { createdAt: -1 },
    { name: "audit_recent_events" },
  );

  await database.collection("students").updateMany(
    {
      "faceTemplate.model": "buffalo_l",
      "faceTemplate.preprocessingVersion": { $exists: false },
    },
    { $set: { "faceTemplate.preprocessingVersion": "insightface-default-1" } },
  );
  await syncImportedStudents();
  await seedConfiguredHostel();
  console.log("Connected to the AttendX MongoDB database");
  return database;
}

async function syncImportedStudents() {
  const hostelId = process.env.HOSTEL_ID || process.env.DEFAULT_HOSTEL_ID || "hostel_demo";
  const importedStudents = await database.collection("students")
    .find({}, { projection: { studentId: 1, name: 1, status: 1 } })
    .toArray();
  const users = database.collection("users");

  for (const student of importedStudents) {
    const now = new Date();
    await users.updateOne(
      { studentId: student.studentId },
      {
        $set: { name: student.name, status: student.status || "active", updatedAt: now },
        $setOnInsert: {
          roles: ["student"],
          hostelId,
          hostelIds: [],
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
}

async function seedConfiguredHostel() {
  const id = process.env.HOSTEL_ID || process.env.DEFAULT_HOSTEL_ID || "hostel_demo";
  const name = process.env.HOSTEL_NAME;
  const latitude = Number(process.env.HOSTEL_CENTER_LAT);
  const longitude = Number(process.env.HOSTEL_CENTER_LON);
  const radiusMeters = Number(process.env.HOSTEL_RADIUS_METERS);
  const maxAccuracyMeters = Number(process.env.HOSTEL_MAX_ACCURACY_METERS);
  const maxFixAgeSeconds = Number(process.env.HOSTEL_MAX_FIX_AGE_SECONDS);

  if (
    !name ||
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(radiusMeters) || radiusMeters <= 0 ||
    !Number.isFinite(maxAccuracyMeters) || maxAccuracyMeters <= 0 ||
    !Number.isFinite(maxFixAgeSeconds) || maxFixAgeSeconds <= 0
  ) {
    return;
  }

  const now = new Date();
  await database.collection("hostels").updateOne(
    { _id: id },
    {
      $set: {
        name,
        status: "active",
        geofence: {
          center: { latitude, longitude },
          radiusMeters,
          maxAccuracyMeters,
          maxFixAgeSeconds,
        },
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

export function getDatabase() {
  if (!database) {
    throw new Error("MongoDB has not connected yet");
  }

  return database;
}

export async function closeDatabase() {
  await client.close();
}
