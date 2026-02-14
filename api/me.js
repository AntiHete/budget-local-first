import { sendJson, getBearerToken } from "./_lib/http";
import { verifyToken } from "./_lib/jwt";

export default async function handler(req, res) {
  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { ok: false, error: "No token" });

  try {
    const payload = await verifyToken(token);
    return sendJson(res, 200, { ok: true, user: { id: payload.sub, email: payload.email } });
  } catch {
    return sendJson(res, 401, { ok: false, error: "Invalid token" });
  }
}
