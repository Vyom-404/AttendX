import express from "express";
import { connectToDatabase, getDatabase } from "./config/database.js";
import { ApiError, sendError } from "./lib/api-error.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import sessionRoutes from "./routes/sessions.js";
import attendanceRoutes from "./routes/attendance.js";
import adminRoutes from "./routes/admin.js";

const app = express();
const allowedWebOrigins = new Set(
  (process.env.WEB_ORIGINS || "http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.disable("x-powered-by");
app.use(requestIdMiddleware);
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use((request, response, next) => {
  const origin = request.get("origin");
  if (origin && allowedWebOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(async (request, response, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    if (request.path === "/health") {
      return response.status(503).json({ status: "unavailable", database: "disconnected" });
    }
    next(new ApiError(503, "DATABASE_UNAVAILABLE", "The database is temporarily unavailable."));
  }
});

app.get("/health", async (_request, response) => {
  try {
    await getDatabase().command({ ping: 1 });
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

app.use("/auth", authRoutes);
app.use(meRoutes);
app.use(sessionRoutes);
app.use(attendanceRoutes);
app.use(adminRoutes);

app.use((_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "The requested endpoint does not exist."));
});

app.use((error, request, response, _next) => {
  if (response.headersSent) return;

  if (error?.type === "entity.parse.failed") {
    return sendError(response, new ApiError(400, "INVALID_JSON", "The request body must be valid JSON."), request.requestId);
  }
  if (error?.code === "LIMIT_FILE_SIZE") {
    return sendError(response, new ApiError(413, "UPLOAD_TOO_LARGE", "The camera image must be 8 MB or smaller."), request.requestId);
  }
  if (error?.code?.startsWith("LIMIT_")) {
    return sendError(response, new ApiError(400, "UPLOAD_INVALID", "The upload contains too many fields or files."), request.requestId);
  }

  sendError(response, error, request.requestId);
});

export default app;
