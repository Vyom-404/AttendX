import multer from "multer";
import { ApiError } from "../lib/api-error.js";

export const captureUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
    files: 3,
    fields: 8,
    parts: 11,
  },
  fileFilter(_request, file, callback) {
    if (!new Set(["image/jpeg", "image/png"]).has(file.mimetype)) {
      return callback(new ApiError(415, "UNSUPPORTED_IMAGE", "Upload a JPEG or PNG camera image."));
    }
    callback(null, true);
  },
});
