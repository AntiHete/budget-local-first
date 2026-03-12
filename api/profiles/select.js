import { z } from "zod";

import { sql } from "../_lib/db.js";
import { requireUser } from "../_lib/auth.js";
import { sendJson, readJson } from "../_lib/http.js";
import { signToken } from "../_lib/jwt.js";

const Body = z.object({
  profileId: z.string().uuid(),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed",
    });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = Body.parse(await readJson(req));

    const { rows } = await sql`
      SELECT
        p.id,
        p.name,
        pm.role
      FROM profile_members pm
      JOIN profiles p ON p.id = pm.profile_id
      WHERE pm.profile_id = ${body.profileId}
        AND pm.user_id = ${auth.userId}
      LIMIT 1
    `;

    const profile = rows[0];
    if (!profile) {
      return sendJson(res, 404, {
        ok: false,
        error: "Profile not found",
      });
    }

    const newToken = await signToken({
      sub: auth.userId,
      email: auth.email ?? null,
      profileId: profile.id,
    });

    return sendJson(res, 200, {
      ok: true,
      token: newToken,
      selectedProfileId: profile.id,
      profile: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(res, 400, {
        ok: false,
        error: "Validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof SyntaxError) {
      return sendJson(res, 400, {
        ok: false,
        error: "Invalid JSON body",
      });
    }

    console.error("profiles/select error:", error);

    return sendJson(res, 500, {
      ok: false,
      error: "Internal Server Error",
    });
  }
}