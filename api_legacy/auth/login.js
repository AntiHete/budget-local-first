import bcrypt from "bcryptjs";
import { z } from "zod";
import { sql } from "../_lib/db";
import { readJson, sendJson } from "../_lib/http";
import { signToken } from "../_lib/jwt";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });

  try {
    const body = Body.parse(await readJson(req));
    const email = body.email.toLowerCase().trim();

    const { rows } = await sql`
      SELECT id, email, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    const u = rows[0];
    if (!u) return sendJson(res, 401, { ok: false, error: "Invalid credentials" });

    const ok = await bcrypt.compare(body.password, u.password_hash);
    if (!ok) return sendJson(res, 401, { ok: false, error: "Invalid credentials" });

    const p = await sql`
      SELECT id
      FROM profiles
      WHERE user_id = ${u.id}
      ORDER BY created_at ASC
      LIMIT 1
    `;

    const defaultProfileId = p.rows?.[0]?.id ?? null;

    const tokenPayload = {
      sub: u.id,
      email: u.email,
      ...(defaultProfileId ? { profileId: defaultProfileId } : {}),
    };

    const token = await signToken(tokenPayload);

    return sendJson(res, 200, {
      ok: true,
      token,
      user: { id: u.id, email: u.email },
      defaultProfileId,
    });
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
  }
}
