import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireProfileAccess } from "./_lib/rbac.js";
import { sql } from "./_lib/db.js";
import { readJson, sendJson } from "./_lib/http.js";

const Direction = z.enum(["income", "expense"]);

const CreateBody = z.object({
  id: z.string().uuid().optional(),
  direction: Direction,
  amountCents: z.number().int().nonnegative(),
  currency: z.string().trim().min(3).max(8).optional(),
  category: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  occurredAt: z.string().min(1),
});

const PatchBody = z
  .object({
    direction: Direction.optional(),
    amountCents: z.number().int().nonnegative().optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    category: z.string().trim().max(120).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    occurredAt: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export default async function handler(req, res) {
  const minRole = req.method === "GET" ? "viewer" : "editor";
  const auth = await requireProfileAccess(req, res, minRole);
  if (!auth) return;

  const profileId = auth.profileId;
  const id = pickSingle(req.query?.id);

  try {
    if (req.method === "GET") {
      if (id) return await handleGetOne(res, profileId, id);
      return await handleList(req, res, profileId);
    }

    if (req.method === "POST") {
      return await handleCreate(req, res, profileId);
    }

    if (req.method === "PATCH") {
      if (!id) {
        return sendJson(res, 400, {
          ok: false,
          error: "Transaction id is required",
        });
      }
      return await handlePatch(req, res, profileId, id);
    }

    if (req.method === "DELETE") {
      if (!id) {
        return sendJson(res, 400, {
          ok: false,
          error: "Transaction id is required",
        });
      }
      return await handleDelete(res, profileId, id);
    }

    return sendJson(res, 405, {
      ok: false,
      error: "Method Not Allowed",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleList(req, res, profileId) {
  const limit = parseLimit(pickSingle(req.query?.limit));
  const before = parseOptionalDate(pickSingle(req.query?.before), "before");
  const after = parseOptionalDate(pickSingle(req.query?.after), "after");

  let result;

  if (before && after) {
    result = await sql`
      SELECT
        id,
        direction,
        amount_cents,
        currency,
        category,
        note,
        occurred_at,
        created_at,
        updated_at
      FROM transactions
      WHERE profile_id = ${profileId}
        AND occurred_at < ${before}
        AND occurred_at > ${after}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `;
  } else if (before) {
    result = await sql`
      SELECT
        id,
        direction,
        amount_cents,
        currency,
        category,
        note,
        occurred_at,
        created_at,
        updated_at
      FROM transactions
      WHERE profile_id = ${profileId}
        AND occurred_at < ${before}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `;
  } else if (after) {
    result = await sql`
      SELECT
        id,
        direction,
        amount_cents,
        currency,
        category,
        note,
        occurred_at,
        created_at,
        updated_at
      FROM transactions
      WHERE profile_id = ${profileId}
        AND occurred_at > ${after}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT
        id,
        direction,
        amount_cents,
        currency,
        category,
        note,
        occurred_at,
        created_at,
        updated_at
      FROM transactions
      WHERE profile_id = ${profileId}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${limit}
    `;
  }

  return sendJson(res, 200, {
    ok: true,
    transactions: result.rows.map(mapTransaction),
  });
}

async function handleGetOne(res, profileId, rawId) {
  const id = ensureUuid(rawId, "id");

  const { rows } = await sql`
    SELECT
      id,
      direction,
      amount_cents,
      currency,
      category,
      note,
      occurred_at,
      created_at,
      updated_at
    FROM transactions
    WHERE id = ${id}
      AND profile_id = ${profileId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return sendJson(res, 404, {
      ok: false,
      error: "Transaction not found",
    });
  }

  return sendJson(res, 200, {
    ok: true,
    transaction: mapTransaction(row),
  });
}

async function handleCreate(req, res, profileId) {
  const body = CreateBody.parse(await readJson(req));

  const id = body.id ?? randomUUID();
  const direction = body.direction;
  const amountCents = body.amountCents;
  const currency = normalizeCurrency(body.currency);
  const category = normalizeNullableText(body.category);
  const note = normalizeNullableText(body.note);
  const occurredAt = parseRequiredDate(body.occurredAt, "occurredAt");

  try {
    const { rows } = await sql`
      INSERT INTO transactions (
        id,
        profile_id,
        direction,
        amount_cents,
        currency,
        category,
        note,
        occurred_at
      )
      VALUES (
        ${id},
        ${profileId},
        ${direction},
        ${amountCents},
        ${currency},
        ${category},
        ${note},
        ${occurredAt}
      )
      RETURNING
        id,
        direction,
        amount_cents,
        currency,
        category,
        note,
        occurred_at,
        created_at,
        updated_at
    `;

    return sendJson(res, 201, {
      ok: true,
      transaction: mapTransaction(rows[0]),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return sendJson(res, 409, {
        ok: false,
        error: "Transaction already exists",
      });
    }
    throw error;
  }
}

async function handlePatch(req, res, profileId, rawId) {
  const id = ensureUuid(rawId, "id");
  const patch = PatchBody.parse(await readJson(req));

  const current = await findTransaction(profileId, id);
  if (!current) {
    return sendJson(res, 404, {
      ok: false,
      error: "Transaction not found",
    });
  }

  const nextDirection = patch.direction ?? current.direction;
  const nextAmountCents = patch.amountCents ?? Number(current.amount_cents);
  const nextCurrency = normalizeCurrency(patch.currency ?? current.currency);
  const nextCategory =
    patch.category !== undefined
      ? normalizeNullableText(patch.category)
      : normalizeNullableText(current.category);
  const nextNote =
    patch.note !== undefined
      ? normalizeNullableText(patch.note)
      : normalizeNullableText(current.note);
  const nextOccurredAt =
    patch.occurredAt !== undefined
      ? parseRequiredDate(patch.occurredAt, "occurredAt")
      : asDate(current.occurred_at, "occurred_at");

  const { rows } = await sql`
    UPDATE transactions
    SET
      direction = ${nextDirection},
      amount_cents = ${nextAmountCents},
      currency = ${nextCurrency},
      category = ${nextCategory},
      note = ${nextNote},
      occurred_at = ${nextOccurredAt},
      updated_at = now()
    WHERE id = ${id}
      AND profile_id = ${profileId}
    RETURNING
      id,
      direction,
      amount_cents,
      currency,
      category,
      note,
      occurred_at,
      created_at,
      updated_at
  `;

  return sendJson(res, 200, {
    ok: true,
    transaction: mapTransaction(rows[0]),
  });
}

async function handleDelete(res, profileId, rawId) {
  const id = ensureUuid(rawId, "id");

  const { rows } = await sql`
    DELETE FROM transactions
    WHERE id = ${id}
      AND profile_id = ${profileId}
    RETURNING id
  `;

  if (!rows[0]) {
    return sendJson(res, 404, {
      ok: false,
      error: "Transaction not found",
    });
  }

  return sendJson(res, 200, {
    ok: true,
    deletedId: rows[0].id,
  });
}

async function findTransaction(profileId, id) {
  const { rows } = await sql`
    SELECT
      id,
      direction,
      amount_cents,
      currency,
      category,
      note,
      occurred_at,
      created_at,
      updated_at
    FROM transactions
    WHERE id = ${id}
      AND profile_id = ${profileId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

function mapTransaction(row) {
  return {
    id: row.id,
    direction: row.direction,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    category: row.category ?? null,
    note: row.note ?? null,
    occurredAt: toIsoString(row.occurred_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function parseLimit(value) {
  if (value == null || value === "") return 200;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1 || n > 500) {
    throw new Error("limit must be an integer between 1 and 500");
  }
  return n;
}

function pickSingle(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function ensureUuid(value, label) {
  return z.string().uuid(`${label} must be a valid UUID`).parse(String(value));
}

function normalizeCurrency(value) {
  const raw = value == null ? "UAH" : String(value).trim();
  return raw.toUpperCase();
}

function normalizeNullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseOptionalDate(value, label) {
  if (value == null || value === "") return null;
  return parseRequiredDate(value, label);
}

function parseRequiredDate(value, label) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO date`);
  }
  return date;
}

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid in database`);
  }
  return date;
}

function toIsoString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString();
}

function isUniqueViolation(error) {
  return (
    error?.code === "23505" ||
    String(error?.message ?? error).toLowerCase().includes("duplicate") ||
    String(error?.message ?? error).toLowerCase().includes("unique")
  );
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

  console.error("transactions handler error:", error);

  const message = String(error?.message ?? error);
  if (
    message.includes("limit must be an integer") ||
    message.includes("must be a valid UUID") ||
    message.includes("must be a valid ISO date")
  ) {
    return sendJson(res, 400, {
      ok: false,
      error: message,
    });
  }

  return sendJson(res, 500, {
    ok: false,
    error: "Internal Server Error",
  });
}