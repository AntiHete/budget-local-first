import { z } from "zod";

import { sql } from "./_lib/db.js";
import { readJson, sendJson } from "./_lib/http.js";
import { requireProfileAccess } from "./_lib/rbac.js";

const Kind = z.enum(["cash", "card", "bank", "savings", "other"]);

const CreateBody = z.object({
  name: z.string().trim().min(1).max(60),
  kind: Kind.default("cash"),
  currency: z.string().trim().min(3).max(8).optional(),
  openingBalanceCents: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
});

const PatchBody = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(60).optional(),
    kind: Kind.optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    openingBalanceCents: z.number().int().min(0).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "At least one field is required",
  });

const DeleteBody = z.object({
  id: z.string().uuid(),
});

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const auth = await requireProfileAccess(req, res, "viewer");
      if (!auth) return;
      return await handleList(res, auth.profileId);
    }

    if (req.method === "POST") {
      const auth = await requireProfileAccess(req, res, "editor");
      if (!auth) return;
      return await handleCreate(req, res, auth.profileId);
    }

    if (req.method === "PATCH") {
      const auth = await requireProfileAccess(req, res, "editor");
      if (!auth) return;
      return await handlePatch(req, res, auth.profileId);
    }

    if (req.method === "DELETE") {
      const auth = await requireProfileAccess(req, res, "editor");
      if (!auth) return;
      return await handleDelete(req, res, auth.profileId);
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleList(res, profileId) {
  const { rows } = await sql`
    SELECT
      id,
      profile_id,
      name,
      kind,
      currency,
      opening_balance_cents,
      is_default,
      created_at,
      updated_at
    FROM accounts
    WHERE profile_id = ${profileId}
    ORDER BY is_default DESC, created_at ASC
  `;

  return sendJson(res, 200, {
    ok: true,
    accounts: rows.map(mapAccount),
  });
}

async function handleCreate(req, res, profileId) {
  const body = CreateBody.parse(await readJson(req));

  const existing = await sql`
    SELECT count(*)::int AS count
    FROM accounts
    WHERE profile_id = ${profileId}
  `;

  const isFirst = Number(existing.rows[0]?.count ?? 0) === 0;
  const makeDefault = body.isDefault === true || isFirst;

  if (makeDefault) {
    await sql`
      UPDATE accounts
      SET is_default = false, updated_at = now()
      WHERE profile_id = ${profileId}
    `;
  }

  const { rows } = await sql`
    INSERT INTO accounts (
      profile_id,
      name,
      kind,
      currency,
      opening_balance_cents,
      is_default
    )
    VALUES (
      ${profileId},
      ${body.name.trim()},
      ${body.kind},
      ${normalizeCurrency(body.currency)},
      ${body.openingBalanceCents ?? 0},
      ${makeDefault}
    )
    RETURNING
      id,
      profile_id,
      name,
      kind,
      currency,
      opening_balance_cents,
      is_default,
      created_at,
      updated_at
  `;

  return sendJson(res, 201, {
    ok: true,
    account: mapAccount(rows[0]),
  });
}

async function handlePatch(req, res, profileId) {
  const body = PatchBody.parse(await readJson(req));

  const current = await findAccount(profileId, body.id);
  if (!current) {
    return sendJson(res, 404, {
      ok: false,
      error: "Account not found",
    });
  }

  if (current.is_default && body.isDefault === false) {
    return sendJson(res, 400, {
      ok: false,
      error: "Set another account as default first",
    });
  }

  const nextDefault = body.isDefault === true;

  if (nextDefault) {
    await sql`
      UPDATE accounts
      SET is_default = false, updated_at = now()
      WHERE profile_id = ${profileId}
    `;
  }

  const { rows } = await sql`
    UPDATE accounts
    SET
      name = ${body.name?.trim() ?? current.name},
      kind = ${body.kind ?? current.kind},
      currency = ${normalizeCurrency(body.currency ?? current.currency)},
      opening_balance_cents = ${body.openingBalanceCents ?? Number(current.opening_balance_cents)},
      is_default = ${body.isDefault ?? current.is_default},
      updated_at = now()
    WHERE id = ${body.id}
      AND profile_id = ${profileId}
    RETURNING
      id,
      profile_id,
      name,
      kind,
      currency,
      opening_balance_cents,
      is_default,
      created_at,
      updated_at
  `;

  return sendJson(res, 200, {
    ok: true,
    account: mapAccount(rows[0]),
  });
}

async function handleDelete(req, res, profileId) {
  const body = DeleteBody.parse(await readJson(req));

  const current = await findAccount(profileId, body.id);
  if (!current) {
    return sendJson(res, 404, {
      ok: false,
      error: "Account not found",
    });
  }

  const refs = await sql`
    SELECT count(*)::int AS count
    FROM transactions
    WHERE profile_id = ${profileId}
      AND account_id = ${body.id}
  `;

  if (Number(refs.rows[0]?.count ?? 0) > 0) {
    return sendJson(res, 400, {
      ok: false,
      error: "Cannot delete account that has linked transactions",
    });
  }

  await sql`
    DELETE FROM accounts
    WHERE id = ${body.id}
      AND profile_id = ${profileId}
  `;

  if (current.is_default) {
    const fallback = await sql`
      SELECT id
      FROM accounts
      WHERE profile_id = ${profileId}
      ORDER BY created_at ASC
      LIMIT 1
    `;

    if (fallback.rows[0]?.id) {
      await sql`
        UPDATE accounts
        SET is_default = true, updated_at = now()
        WHERE id = ${fallback.rows[0].id}
      `;
    }
  }

  return sendJson(res, 200, {
    ok: true,
    deletedId: body.id,
  });
}

async function findAccount(profileId, id) {
  const { rows } = await sql`
    SELECT
      id,
      profile_id,
      name,
      kind,
      currency,
      opening_balance_cents,
      is_default,
      created_at,
      updated_at
    FROM accounts
    WHERE id = ${id}
      AND profile_id = ${profileId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

function mapAccount(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    kind: row.kind,
    currency: row.currency,
    openingBalanceCents: Number(row.opening_balance_cents),
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCurrency(value) {
  return String(value ?? "UAH").trim().toUpperCase();
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

  console.error("accounts handler error:", error);

  return sendJson(res, 500, {
    ok: false,
    error: "Internal Server Error",
  });
}