import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_SECONDS = 15 * 60;

function secret() {
  const value = process.env.AUTH_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_TOKEN_SECRET must be at least 32 characters");
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(input) {
  return createHmac("sha256", secret()).update(input).digest("base64url");
}

export function createAccessToken(studentId) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const head = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: studentId, iat: issuedAt, exp: issuedAt + TOKEN_LIFETIME_SECONDS });
  const input = `${head}.${payload}`;
  return `${input}.${signature(input)}`;
}

export function verifyAccessToken(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const input = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(signature(input));
  const supplied = Buffer.from(parts[2]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== "HS256" ||
      typeof payload.sub !== "string" ||
      !Number.isFinite(payload.iat) ||
      !Number.isFinite(payload.exp) ||
      payload.iat > now + 30 ||
      payload.exp <= now
    ) return null;
    return { studentId: payload.sub };
  } catch {
    return null;
  }
}

export function equalSecret(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const providedDigest = createHmac("sha256", "attendx-dev-login").update(provided).digest();
  const expectedDigest = createHmac("sha256", "attendx-dev-login").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}
