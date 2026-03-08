import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sql } from "../_lib/db";
import { sendJson, readJson, getBearerToken } from "../_lib/http";
import { verifyToken } from "../_lib/jwt";

const CreateBody = z.object({
  name: z.string().min(1).max(60),
});

export default async function handler(req, res) {
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

  if (req.method === "GET") {
    const { rows } = await sql`
      SELECT id, name, created_at
      FROM profiles
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;

    return sendJson(res, 200, {
      ok: true,
      profiles: rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
      })),
      activeProfileId: payload.profileId ?? null,
    });
  }

  if (req.method === "POST") {
    try {
      const body = CreateBody.parse(await readJson(req));
      const name = body.name.trim();

      const { rows } = await sql`
        INSERT INTO profiles (id, user_id, name)
        VALUES (${randomUUID()}, ${userId}, ${name})
        RETURNING id, name, created_at
      `;

      const p = rows[0];
      return sendJson(res, 200, {
        ok: true,
        profile: { id: p.id, name: p.name, createdAt: p.created_at },
      });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
    }
  }

  return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
}