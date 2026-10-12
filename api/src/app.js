import express from "express";
import { getDatabase } from "./config/database.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_request, response) => {
  try {
    await getDatabase().command({ ping: 1 });
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});

export default app;
