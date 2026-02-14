import { z } from "zod";
import { sql } from "../_lib/db";
import { readJson, sendJson } from "../_lib/http";
import { requireUser } from "../_lib/auth";
import { signToken } from "../_lib/jwt";

const Body = z.object({
  profileId: z.string().min(1),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = Body.parse(await readJson(req));
    const profileId = body.profileId.trim();

    const { rows } = await sql`
      SELECT id, name
      FROM profiles
      WHERE id = ${profileId} AND user_id = ${auth.userId}
      LIMIT 1
    `;

    const p = rows[0];
    if (!p) return sendJson(res, 404, { ok: false, error: "Profile not found" });

    const token = await signToken({
      sub: auth.userId,
      email: auth.email,
      profileId: p.id,
    });

    return sendJson(res, 200, {
      ok: true,
      token,
      selectedProfileId: p.id,
      profile: { id: p.id, name: p.name },
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
  }
}
