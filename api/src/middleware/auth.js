import { getDatabase } from "../config/database.js";
import { ApiError } from "../lib/api-error.js";
import { verifyAccessToken } from "../security/tokens.js";

export async function requireAuthentication(request, _response, next) {
  const authorization = request.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match ? verifyAccessToken(match[1]) : null;
  if (!token) {
    return next(new ApiError(401, "AUTH_REQUIRED", "Sign in to continue."));
  }

  try {
    const user = await getDatabase().collection("users").findOne(
      { studentId: token.studentId, status: "active" },
      { projection: { _id: 0, studentId: 1, name: 1, roles: 1, hostelId: 1, hostelIds: 1 } },
    );
    if (!user) {
      return next(new ApiError(401, "AUTH_REQUIRED", "This account is unavailable."));
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(role) {
  return (request, _response, next) => {
    if (!request.user?.roles?.includes(role)) {
      return next(new ApiError(403, "FORBIDDEN", "You do not have permission for this action."));
    }
    next();
  };
}
