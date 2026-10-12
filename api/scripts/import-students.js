import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiDirectory = path.resolve(scriptDirectory, "..");
const projectDirectory = path.resolve(apiDirectory, "..");
dotenv.config({ path: path.join(projectDirectory, ".env") });

const [{ closeDatabase, connectToDatabase }, { saveStudentTemplate }] =
  await Promise.all([
    import("../src/config/database.js"),
    import("../src/models/student.js"),
  ]);

const manifestPath = path.resolve(
  process.argv[2] || path.join(apiDirectory, "students.json"),
);
const enrollmentDirectory = path.join(
  projectDirectory,
  "face-service",
  "samples",
  "enrollment",
);
const faceServiceUrl = (process.env.FACE_SERVICE_URL || "http://127.0.0.1:8000")
  .replace(/\/$/, "");
const allowedExtensions = new Set([".jpg", ".jpeg", ".png"]);

function requireText(value, field, entryIndex) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Manifest entry ${entryIndex + 1}: ${field} is required`);
  }
  return value.trim();
}

async function createTemplate(entry) {
  const folderPath = path.resolve(enrollmentDirectory, entry.folder);
  if (!folderPath.startsWith(`${enrollmentDirectory}${path.sep}`)) {
    throw new Error(`Invalid enrollment folder: ${entry.folder}`);
  }

  const filenames = (await readdir(folderPath))
    .filter((filename) => allowedExtensions.has(path.extname(filename).toLowerCase()))
    .sort();

  if (filenames.length < 3 || filenames.length > 10) {
    throw new Error(
      `${entry.studentId}: expected 3–10 JPEG/PNG photos in ${entry.folder}; found ${filenames.length}`,
    );
  }

  const form = new FormData();
  for (const filename of filenames) {
    const contents = await readFile(path.join(folderPath, filename));
    const mimeType = path.extname(filename).toLowerCase() === ".png"
      ? "image/png"
      : "image/jpeg";
    form.append("files", new Blob([contents], { type: mimeType }), filename);
  }

  const response = await fetch(`${faceServiceUrl}/v1/enrollment-template`, {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = typeof result.detail === "string"
      ? result.detail
      : JSON.stringify(result.detail || result);
    throw new Error(`${entry.studentId}: face service rejected enrollment (${response.status}): ${details}`);
  }

  return result;
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
    folder: requireText(entry.folder, "folder", index),
    studentId: requireText(entry.studentId, "studentId", index),
    name: requireText(entry.name, "name", index),
  }));
  const studentIds = entries.map((entry) => entry.studentId);
  if (new Set(studentIds).size !== studentIds.length) {
    throw new Error("The manifest contains duplicate studentId values");
  }

  await connectToDatabase();
  for (const entry of entries) {
    const result = await createTemplate(entry);
    await saveStudentTemplate({
      studentId: entry.studentId,
      name: entry.name,
      embedding: result.template,
      acceptedImages: result.accepted_images,
      model: result.model,
    });
    console.log(
      `${entry.studentId}: template saved (${result.accepted_images} accepted photos; model ${result.model})`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(`Student import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
