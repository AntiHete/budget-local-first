import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireUser } from "../_lib/auth.js";
import { sql } from "../_lib/db.js";
import { readJson, sendJson } from "../_lib/http.js";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(60),
});

const RenameBody = z.object({
  profileId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
});

const DeleteBody = z.object({
  profileId: z.string().uuid(),
});

export default async function handler(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    if (req.method === "GET") {
      return await handleList(res, auth);
    }

    if (req.method === "POST") {
      return await handleCreate(req, res, auth);
    }

    if (req.method === "PATCH") {
      return await handleRename(req, res, auth);
    }

    if (req.method === "DELETE") {
      return await handleDelete(req, res, auth);
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleList(res, auth) {
  const { rows } = await sql`
    SELECT
      p.id,
      p.name,
      p.created_at,
      pm.role
    FROM profile_members pm
    JOIN profiles p ON p.id = pm.profile_id
    WHERE pm.user_id = ${auth.userId}
    ORDER BY p.created_at ASC
  `;

  return sendJson(res, 200, {
    ok: true,
    profiles: rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
    })),
    activeProfileId: auth.profileId ?? null,
  });
}

async function handleCreate(req, res, auth) {
  const body = CreateBody.parse(await readJson(req));
  const id = randomUUID();
  const name = body.name.trim();

  await sql`
    INSERT INTO profiles (id, user_id, name)
    VALUES (${id}, ${auth.userId}, ${name})
  `;

  await sql`
    INSERT INTO profile_members (id, profile_id, user_id, role)
    VALUES (${randomUUID()}, ${id}, ${auth.userId}, 'owner')
    ON CONFLICT (profile_id, user_id) DO NOTHING
  `;

  const { rows } = await sql`
    SELECT id, name, created_at
    FROM profiles
    WHERE id = ${id}
    LIMIT 1
  `;

  const profile = rows[0];

  return sendJson(res, 200, {
    ok: true,
    profile: {
      id: profile.id,
      name: profile.name,
      role: "owner",
      createdAt: profile.created_at,
    },
  });
}

async function handleRename(req, res, auth) {
  const body = RenameBody.parse(await readJson(req));

  const membership = await getMembership(body.profileId, auth.userId);
  if (!membership) {
    return sendJson(res, 404, {
      ok: false,
      error: "Profile not found",
    });
  }

  if (membership.role !== "owner") {
    return sendJson(res, 403, {
      ok: false,
      error: "Only owner can rename profile",
    });
  }

  const { rows } = await sql`
    UPDATE profiles
    SET name = ${body.name.trim()}
    WHERE id = ${body.profileId}
    RETURNING id, name, created_at
  `;

  const profile = rows[0];

  return sendJson(res, 200, {
    ok: true,
    profile: {
      id: profile.id,
      name: profile.name,
      role: membership.role,
      createdAt: profile.created_at,
    },
  });
}

async function handleDelete(req, res, auth) {
  const body = DeleteBody.parse(await readJson(req));

  const membership = await getMembership(body.profileId, auth.userId);
  if (!membership) {
    return sendJson(res, 404, {
      ok: false,
      error: "Profile not found",
    });
  }

  if (membership.role !== "owner") {
    return sendJson(res, 403, {
      ok: false,
      error: "Only owner can delete profile",
    });
  }

  await sql`
    DELETE FROM profiles
    WHERE id = ${body.profileId}
  `;

  return sendJson(res, 200, {
    ok: true,
    deletedProfileId: body.profileId,
  });
}

async function getMembership(profileId, userId) {
  const { rows } = await sql`
    SELECT id, profile_id, user_id, role, created_at
    FROM profile_members
    WHERE profile_id = ${profileId}
      AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

function handleError(res, error) {
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

  console.error("profiles/index error:", error);

  return sendJson(res, 500, {
    ok: false,
    error: "Internal Server Error",
  });
}
