import bcrypt from "bcryptjs";
import { z } from "zod";
import { sql } from "../_lib/db";
import { readJson, sendJson } from "../_lib/http";
import { signToken } from "../_lib/jwt";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(60).optional(),
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });

  try {
    const body = Body.parse(await readJson(req));
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(body.password, 10);

    await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${id}, ${body.email.toLowerCase()}, ${passwordHash})
    `;

    const profileId = crypto.randomUUID();
    await sql`
      INSERT INTO profiles (id, user_id, name)
      VALUES (${profileId}, ${id}, ${body.name ?? "Default"})
    `;

    const token = await signToken({ sub: id, email: body.email.toLowerCase() });
    return sendJson(res, 200, { ok: true, token, user: { id, email: body.email.toLowerCase() }, defaultProfileId: profileId });
  } catch (e) {
    // дубль email
    const msg = String(e?.message ?? e);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      return sendJson(res, 409, { ok: false, error: "Email already exists" });
    }
    return sendJson(res, 400, { ok: false, error: msg });
  }
}
