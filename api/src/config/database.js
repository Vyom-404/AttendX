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
  const students = database.collection("students");
  await students.createIndex(
    { studentId: 1 },
    { unique: true, name: "unique_student_id" },
  );
  await students.createIndex({ status: 1 }, { name: "student_status" });
  console.log("Connected to the AttendX MongoDB database");
  return database;
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
