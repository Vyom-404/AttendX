import { randomUUID } from "node:crypto";

export function requestIdMiddleware(request, response, next) {
  request.requestId = randomUUID();
  response.setHeader("X-Request-ID", request.requestId);
  next();
}
