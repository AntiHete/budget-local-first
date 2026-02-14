import { sendJson, getBearerToken } from "./http";
import { verifyToken } from "./jwt";

/**
 * Returns { userId, email, profileId, payload } or null (and sends 401).
 */
export async function requireUser(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { ok: false, error: "No token" });
    return null;
  }

  try {
    const payload = await verifyToken(token);
    const userId = payload?.sub;
    if (!userId) throw new Error("Bad token payload");

    return {
      userId: String(userId),
      email: payload?.email ? String(payload.email) : null,
      profileId: payload?.profileId ? String(payload.profileId) : null,
      payload,
    };
  } catch {
    sendJson(res, 401, { ok: false, error: "Invalid token" });
    return null;
  }
}
