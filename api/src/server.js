import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The API runs from api/, while the shared secrets live in the repository root.
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, "../../.env") });

const [{ default: app }, { closeDatabase, connectToDatabase }] = await Promise.all([
  import("./app.js"),
  import("./config/database.js"),
]);

const port = Number(process.env.PORT || 3000);
const host = process.env.API_HOST || "127.0.0.1";

try {
  await connectToDatabase();
  const server = app.listen(port, host, () => {
    console.log(`AttendX API listening at http://${host}:${port}`);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 25_000;

  async function shutDown(signal) {
    console.log(`${signal} received; shutting down AttendX API`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => void shutDown("SIGINT"));
  process.on("SIGTERM", () => void shutDown("SIGTERM"));
} catch (error) {
  console.error("Could not start AttendX API:", error.message);
  await closeDatabase();
  process.exit(1);
}
