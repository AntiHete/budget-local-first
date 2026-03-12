import { randomUUID } from "node:crypto";
import { z } from "zod";

import { sql } from "../_lib/db.js";
import { sendJson, readJson } from "../_lib/http.js";
import { requireProfileAccess } from "../_lib/rbac.js";

const Role = z.enum(["owner", "editor", "viewer"]);

const AddBody = z.object({
  email: z.string().trim().email(),
  role: Role.default("viewer"),
});

const UpdateRoleBody = z.object({
  memberId: z.string().uuid(),
  role: Role,
});

const RemoveBody = z.object({
  memberId: z.string().uuid(),
});

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const auth = await requireProfileAccess(req, res, "viewer");
      if (!auth) return;
      return await handleList(res, auth.profileId, auth.userId);
    }

    if (req.method === "POST") {
      const auth = await requireProfileAccess(req, res, "owner");
      if (!auth) return;
      return await handleAdd(req, res, auth.profileId);
    }

    if (req.method === "PATCH") {
      const auth = await requireProfileAccess(req, res, "owner");
      if (!auth) return;
      return await handleUpdateRole(req, res, auth.profileId);
    }

    if (req.method === "DELETE") {
      const auth = await requireProfileAccess(req, res, "owner");
      if (!auth) return;
      return await handleRemove(req, res, auth.profileId, auth.userId);
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleList(res, profileId, currentUserId) {
  const { rows } = await sql`
    SELECT
      pm.id,
      pm.user_id,
      pm.role,
      pm.created_at,
      u.email,
      u.name
    FROM profile_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.profile_id = ${profileId}
    ORDER BY
      CASE pm.role
        WHEN 'owner' THEN 1
        WHEN 'editor' THEN 2
        ELSE 3
      END,
      pm.created_at ASC
  `;

  return sendJson(res, 200, {
    ok: true,
    members: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.name ?? null,
      role: row.role,
      createdAt: row.created_at,
      isCurrentUser: row.user_id === currentUserId,
    })),
  });
}

async function handleAdd(req, res, profileId) {
  const body = AddBody.parse(await readJson(req));
  const email = body.email.trim().toLowerCase();

  const userResult = await sql`
    SELECT id, email, name
    FROM users
    WHERE lower(email) = ${email}
    LIMIT 1
  `;

  const user = userResult.rows[0];
  if (!user) {
    return sendJson(res, 404, {
      ok: false,
      error: "User with this email was not found. Ask them to register first.",
    });
  }

  const existingResult = await sql`
    SELECT id
    FROM profile_members
    WHERE profile_id = ${profileId}
      AND user_id = ${user.id}
    LIMIT 1
  `;

  if (existingResult.rows[0]) {
    return sendJson(res, 409, {
      ok: false,
      error: "User is already a member of this profile",
    });
  }

  const { rows } = await sql`
    INSERT INTO profile_members (id, profile_id, user_id, role)
    VALUES (${randomUUID()}, ${profileId}, ${user.id}, ${body.role})
    RETURNING id, user_id, role, created_at
  `;

  const member = rows[0];

  return sendJson(res, 200, {
    ok: true,
    member: {
      id: member.id,
      userId: member.user_id,
      email: user.email,
      name: user.name ?? null,
      role: member.role,
      createdAt: member.created_at,
      isCurrentUser: false,
    },
  });
}

async function handleUpdateRole(req, res, profileId) {
  const body = UpdateRoleBody.parse(await readJson(req));

  const current = await findMember(profileId, body.memberId);
  if (!current) {
    return sendJson(res, 404, {
      ok: false,
      error: "Member not found",
    });
  }

  if (current.role === "owner" && body.role !== "owner") {
    const ownerCount = await countOwners(profileId);
    if (ownerCount <= 1) {
      return sendJson(res, 400, {
        ok: false,
        error: "Profile must have at least one owner",
      });
    }
  }

  const { rows } = await sql`
    UPDATE profile_members
    SET role = ${body.role}
    WHERE id = ${body.memberId}
      AND profile_id = ${profileId}
    RETURNING id, user_id, role, created_at
  `;

  const member = rows[0];

  const userResult = await sql`
    SELECT email, name
    FROM users
    WHERE id = ${member.user_id}
    LIMIT 1
  `;

  const user = userResult.rows[0];

  return sendJson(res, 200, {
    ok: true,
    member: {
      id: member.id,
      userId: member.user_id,
      email: user?.email ?? null,
      name: user?.name ?? null,
      role: member.role,
      createdAt: member.created_at,
      isCurrentUser: false,
    },
  });
}

async function handleRemove(req, res, profileId, currentUserId) {
  const body = RemoveBody.parse(await readJson(req));

  const current = await findMember(profileId, body.memberId);
  if (!current) {
    return sendJson(res, 404, {
      ok: false,
      error: "Member not found",
    });
  }

  if (current.role === "owner") {
    const ownerCount = await countOwners(profileId);
    if (ownerCount <= 1) {
      return sendJson(res, 400, {
        ok: false,
        error: "You cannot remove the last owner",
      });
    }
  }

  await sql`
    DELETE FROM profile_members
    WHERE id = ${body.memberId}
      AND profile_id = ${profileId}
  `;

  return sendJson(res, 200, {
    ok: true,
    removedMemberId: body.memberId,
    removedCurrentUser: current.user_id === currentUserId,
  });
}

async function findMember(profileId, memberId) {
  const { rows } = await sql`
    SELECT id, user_id, role, created_at
    FROM profile_members
    WHERE id = ${memberId}
      AND profile_id = ${profileId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function countOwners(profileId) {
  const { rows } = await sql`
    SELECT count(*)::int AS count
    FROM profile_members
    WHERE profile_id = ${profileId}
      AND role = 'owner'
  `;

  return Number(rows[0]?.count ?? 0);
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

  console.error("profiles/members error:", error);

  return sendJson(res, 500, {
    ok: false,
    error: "Internal Server Error",
  });
}