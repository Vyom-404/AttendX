import { ApiError } from "../lib/api-error.js";

const FACE_FRAME_TIMEOUT_MS = 60_000;
const FACE_SEQUENCE_TIMEOUT_MS = 210_000;

async function verifyFrame(file, template, deadline) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new ApiError(503, "INFERENCE_UNAVAILABLE", "Face verification took too long. Try again shortly.");
  }

  const baseUrl = (process.env.FACE_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), "capture");
  form.append("template_json", JSON.stringify(template));

  let response;
  const requestStartedAt = Date.now();
  try {
    response = await fetch(`${baseUrl}/v1/verify`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(Math.min(FACE_FRAME_TIMEOUT_MS, remainingMs)),
    });
  } catch (error) {
    console.error(
      `[face-service] request failed after ${Date.now() - requestStartedAt}ms: ${error.name || "Error"}: ${error.message || "unknown fetch error"}`,
    );
    throw new ApiError(503, "INFERENCE_UNAVAILABLE", "Face verification is temporarily unavailable. Try again shortly.");
  }

  if (!response.ok) {
    console.error(
      `[face-service] returned HTTP ${response.status} after ${Date.now() - requestStartedAt}ms` +
        (response.headers.get("x-vercel-id")
          ? ` (Vercel request ${response.headers.get("x-vercel-id")})`
          : ""),
    );
    throw new ApiError(503, "INFERENCE_UNAVAILABLE", "Face verification is temporarily unavailable. Try again shortly.");
  }

  const result = await response.json().catch(() => null);
  if (!result || typeof result.status !== "string") {
    throw new ApiError(503, "INFERENCE_UNAVAILABLE", "Face verification returned an invalid response.");
  }

  if (result.status !== "liveness_passed") {
    throw new ApiError(422, "LIVENESS_OR_CAPTURE_FAILED", "The capture did not pass the live-face check. Follow the camera guidance and try again.");
  }

  if (!Number.isFinite(result.similarity)) {
    throw new ApiError(503, "INFERENCE_UNAVAILABLE", "Face verification returned an invalid response.");
  }

  return { model: result.model || "unknown", similarity: result.similarity };
}

export async function verifyCaptures(files, template) {
  if (!Array.isArray(files) || files.length !== 3) {
    throw new ApiError(400, "CAPTURE_SEQUENCE_REQUIRED", "Capture three short camera frames and try again.");
  }

  const results = [];
  const deadline = Date.now() + FACE_SEQUENCE_TIMEOUT_MS;
  for (const file of files) {
    results.push(await verifyFrame(file, template, deadline));
  }

  const threshold = Number(process.env.FACE_MATCH_THRESHOLD || 0.7);
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    throw new ApiError(503, "FACE_POLICY_NOT_CONFIGURED", "Face verification is not configured correctly.");
  }

  const sortedSimilarities = results.map((result) => result.similarity).sort((a, b) => a - b);
  const medianSimilarity = sortedSimilarities[1];
  if (medianSimilarity < threshold) {
    throw new ApiError(422, "FACE_MISMATCH", "The face did not match this student. Check the lighting and try again.");
  }

  return {
    model: results[0].model,
    thresholdVersion: `cosine-median3-${threshold.toFixed(2)}`,
    framesChecked: results.length,
  };
}
