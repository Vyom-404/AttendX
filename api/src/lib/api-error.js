export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function sendError(response, error, requestId) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof ApiError
    ? error.message
    : "The request could not be completed. Try again later.";

  if (status >= 500) {
    console.error(`[${requestId}] ${code}: ${error.message}`);
  }

  response.status(status).json({
    error: { code, message, requestId },
  });
}
