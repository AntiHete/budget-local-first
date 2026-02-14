import { z } from "zod";
import { randomUUID } from "node:crypto";
import { sql } from "../_lib/db";
import { readJson, sendJson } from "../_lib/http";
import { requireUser } from "../_lib/auth";

const CreateBody = z.object({
  name: z.string().min(1).max(60),
});

export default async function handler(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { rows } = await sql`
      SELECT id, name, created_at
      FROM profiles
      WHERE user_id = ${auth.userId}
      ORDER BY created_at ASC
    `;

    return sendJson(res, 200, {
      ok: true,
      profiles: rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
      })),
      activeProfileId: auth.profileId,
    });
  }

  if (req.method === "POST") {
    try {
      const body = CreateBody.parse(await readJson(req));
      const name = body.name.trim();

      const { rows } = await sql`
        INSERT INTO profiles (id, user_id, name)
        VALUES (${randomUUID()}, ${auth.userId}, ${name})
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
