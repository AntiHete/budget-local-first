// api/profiles/select.js
import { z } from "zod";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken, signToken } from "../_lib/jwt";

const Body = z.object({
  profileId: z.string().min(1),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });

  const token = getBearerToken(req);
  if (!token) return sendJson(res, 401, { ok: false, error: "No token" });

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return sendJson(res, 401, { ok: false, error: "Invalid token" });
  }

  const userId = payload?.sub;
  if (!userId) return sendJson(res, 401, { ok: false, error: "Bad token payload" });

  try {
    const body = Body.parse(await readJson(req));
    const profileId = body.profileId.trim();

    const { rows } = await sql`
      SELECT id, name
      FROM profiles
      WHERE id = ${profileId} AND user_id = ${userId}
      LIMIT 1
    `;

    const p = rows[0];
    if (!p) return sendJson(res, 404, { ok: false, error: "Profile not found" });

    const newToken = await signToken({
      sub: userId,
      email: payload.email ?? null,
      profileId: p.id,
    });

    return sendJson(res, 200, {
      ok: true,
      token: newToken,
      selectedProfileId: p.id,
      profile: { id: p.id, name: p.name },
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
  }
}