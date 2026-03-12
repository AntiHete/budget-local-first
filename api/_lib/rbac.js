import { sql } from "./db.js";
import { sendJson } from "./http.js";
import { requireUser } from "./auth.js";

const ROLE_RANK = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function hasRequiredRole(actualRole, minRole = "viewer") {
  return (ROLE_RANK[actualRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
}

export async function requireProfileAccess(req, res, minRole = "viewer") {
  const auth = await requireUser(req, res);
  if (!auth) return null;

  if (!auth.profileId) {
    sendJson(res, 400, {
      ok: false,
      error: "Active profile is required",
    });
    return null;
  }

  const { rows } = await sql`
    SELECT
      pm.id,
      pm.profile_id,
      pm.user_id,
      pm.role,
      pm.created_at,
      p.name AS profile_name
    FROM profile_members pm
    JOIN profiles p ON p.id = pm.profile_id
    WHERE pm.profile_id = ${auth.profileId}
      AND pm.user_id = ${auth.userId}
    LIMIT 1
  `;

  const membership = rows[0];
  if (!membership) {
    sendJson(res, 403, {
      ok: false,
      error: "You do not have access to this profile",
    });
    return null;
  }

  if (!hasRequiredRole(membership.role, minRole)) {
    sendJson(res, 403, {
      ok: false,
      error: `Role '${membership.role}' is not enough for this action`,
    });
    return null;
  }

  return {
    ...auth,
    membershipId: membership.id,
    role: membership.role,
    profileName: membership.profile_name,
  };
}