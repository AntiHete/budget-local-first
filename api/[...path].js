if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL =
    process.env.BUDGET_DB_POSTGRES_URL ||
    process.env.BUDGET_DB_POSTGRES_URL_NON_POOLING ||
    process.env.BUDGET_DB_DATABASE_URL ||
    process.env.BUDGET_DB_DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    "";
}

import { sql } from "@vercel/postgres";
import { z } from "zod";
import crypto from "node:crypto";

let _bcrypt = null;
async function bcrypt() {
  if (_bcrypt) return _bcrypt;
  try {
    _bcrypt = await import("bcryptjs");
  } catch {
    _bcrypt = await import("bcrypt");
  }
  return _bcrypt;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, "base64");
}

function jwtSign(payload, { expiresInSec = 60 * 60 * 24 * 7 } = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
  };

  const p1 = b64urlEncode(JSON.stringify(header));
  const p2 = b64urlEncode(JSON.stringify(fullPayload));
  const data = `${p1}.${p2}`;

  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  const p3 = b64urlEncode(sig);

  return `${data}.${p3}`;
}

function jwtVerify(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Bad token");

  const [p1, p2, p3] = parts;
  const data = `${p1}.${p2}`;

  const expected = crypto.createHmac("sha256", secret).update(data).digest();
  const got = b64urlDecode(p3);

  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    throw new Error("Bad signature");
  }

  const payload = JSON.parse(b64urlDecode(p2).toString("utf8"));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now > payload.exp) throw new Error("Token expired");
  return payload;
}

function requireAuth(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { ok: false, error: "No token" });
    return null;
  }
  try {
    return jwtVerify(token);
  } catch {
    sendJson(res, 401, { ok: false, error: "Invalid token" });
    return null;
  }
}

function requireProfile(payload, res) {
  const profileId = payload?.profileId ?? null;
  if (!profileId) {
    sendJson(res, 400, { ok: false, error: "No active profile in token" });
    return null;
  }
  return profileId;
}

function parsePath(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sub = url.pathname.replace(/^\/api\/?/, "");
  const segments = sub.split("/").filter(Boolean);
  return { url, segments };
}

function isPgUniqueViolation(e) {
  return e?.code === "23505";
}

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(4).max(200),
  name: z.string().max(120).optional().nullable(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const CreateProfileBody = z.object({
  name: z.string().min(1).max(120),
});

const SelectProfileBody = z.object({
  profileId: z.string().uuid(),
});

const TxCreateBody = z.object({
  id: z.string().uuid().optional(),
  direction: z.enum(["income", "expense"]),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1).max(10).optional().default("UAH"),
  category: z.string().max(120).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
  occurredAt: z.string().min(1),
});

const TxPatchBody = z.object({
  direction: z.enum(["income", "expense"]).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(10).optional(),
  category: z.string().max(120).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
  occurredAt: z.string().min(1).optional(),
});

const BudgetUpsertBody = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().min(1).max(120),
  limitCents: z.number().int().nonnegative(),
  currency: z.string().min(1).max(10).optional().default("UAH"),
});

const DebtCreateBody = z.object({
  id: z.string().uuid().optional(),
  direction: z.enum(["i_owe", "owed_to_me"]),
  counterparty: z.string().min(1).max(120),
  title: z.string().max(120).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
  principalCents: z.number().int().nonnegative(),
  currency: z.string().min(1).max(10).optional().default("UAH"),
  startedAt: z.string().optional(),
  dueAt: z.string().optional().nullable(),
});

const DebtPatchBody = z.object({
  direction: z.enum(["i_owe", "owed_to_me"]).optional(),
  counterparty: z.string().min(1).max(120).optional(),
  title: z.string().max(120).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
  principalCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(10).optional(),
  startedAt: z.string().optional(),
  dueAt: z.string().optional().nullable(),
  status: z.enum(["open", "closed"]).optional(),
});

const PaymentCreateBody = z.object({
  id: z.string().uuid().optional(),
  amountCents: z.number().int().nonnegative(),
  occurredAt: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

const PaymentPatchBody = z.object({
  amountCents: z.number().int().nonnegative().optional(),
  occurredAt: z.string().min(1).optional(),
  note: z.string().max(500).optional().nullable(),
});

export default async function handler(req, res) {
  const { url, segments } = parsePath(req);

  if (segments.length === 0) {
    return sendJson(res, 404, { ok: false, error: "Not Found" });
  }

  // GET /api/health
  if (segments[0] === "health") {
    return sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
  }

  // GET /api/me
  if (segments[0] === "me") {
    const payload = requireAuth(req, res);
    if (!payload) return;
    return sendJson(res, 200, { ok: true, user: { id: payload.sub, email: payload.email } });
  }

  // /api/auth/*
  if (segments[0] === "auth") {
    if (segments[1] === "register" && req.method === "POST") {
      try {
        const body = RegisterBody.parse(await readJson(req));
        const bc = await bcrypt();
        const hash = await bc.hash(body.password, 10);

        const { rows } = await sql`
          INSERT INTO users (email, password_hash, name)
          VALUES (${body.email.toLowerCase()}, ${hash}, ${body.name ?? null})
          RETURNING id, email
        `;

        const u = rows[0];
        const token = jwtSign({ sub: u.id, email: u.email });

        return sendJson(res, 200, { ok: true, token });
      } catch (e) {
        console.error("[auth/register] error:", e);

    if (e?.code === "23505") {
      return sendJson(res, 409, { ok: false, error: "Email already exists" });
    }

    return sendJson(res, 500, {
      ok: false,
      error: String(e?.message ?? e),
      code: e?.code ?? null,
    });
    }}

    if (segments[1] === "login" && req.method === "POST") {
      try {
        const body = LoginBody.parse(await readJson(req));
        const { rows } = await sql`
          SELECT id, email, password_hash
          FROM users
          WHERE email = ${body.email.toLowerCase()}
          LIMIT 1
        `;
        const u = rows[0];
        if (!u) return sendJson(res, 401, { ok: false, error: "Invalid credentials" });

        const bc = await bcrypt();
        const ok = await bc.compare(body.password, u.password_hash);
        if (!ok) return sendJson(res, 401, { ok: false, error: "Invalid credentials" });

        const token = jwtSign({ sub: u.id, email: u.email });
        return sendJson(res, 200, { ok: true, token });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
      }
    }

    return sendJson(res, 404, { ok: false, error: "Not Found" });
  }

  // /api/profiles
  if (segments[0] === "profiles") {
    const payload = requireAuth(req, res);
    if (!payload) return;

    if (segments.length === 1 && req.method === "GET") {
      const { rows } = await sql`
        SELECT id, name, created_at
        FROM profiles
        WHERE user_id = ${payload.sub}
        ORDER BY created_at DESC
      `;
      return sendJson(res, 200, { ok: true, profiles: rows.map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at })) });
    }

    if (segments.length === 1 && req.method === "POST") {
      try {
        const body = CreateProfileBody.parse(await readJson(req));
        const { rows } = await sql`
          INSERT INTO profiles (user_id, name)
          VALUES (${payload.sub}, ${body.name.trim()})
          RETURNING id, name, created_at
        `;
        const p = rows[0];
        return sendJson(res, 200, { ok: true, profile: { id: p.id, name: p.name, createdAt: p.created_at } });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
      }
    }

    if (segments[1] === "select" && req.method === "POST") {
      try {
        const body = SelectProfileBody.parse(await readJson(req));
        const { rows } = await sql`
          SELECT id
          FROM profiles
          WHERE id = ${body.profileId} AND user_id = ${payload.sub}
          LIMIT 1
        `;
        if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Profile not found" });

        const token = jwtSign({ sub: payload.sub, email: payload.email, profileId: body.profileId });
        return sendJson(res, 200, { ok: true, token });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
      }
    }

    return sendJson(res, 404, { ok: false, error: "Not Found" });
  }

  // /api/transactions
  if (segments[0] === "transactions") {
    const payload = requireAuth(req, res);
    if (!payload) return;
    const profileId = requireProfile(payload, res);
    if (!profileId) return;

    if (segments.length === 1 && req.method === "GET") {
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50) || 50));

      const { rows } = await sql`
        SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
        FROM transactions
        WHERE profile_id = ${profileId}
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT ${limit}
      `;

      return sendJson(res, 200, { ok: true, transactions: rows.map(mapTxRow) });
    }

    if (segments.length === 1 && req.method === "POST") {
      try {
        const body = TxCreateBody.parse(await readJson(req));
        const occurredAt = new Date(body.occurredAt);
        if (Number.isNaN(occurredAt.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });

        const id = body.id ?? crypto.randomUUID();

        const { rows } = await sql`
          INSERT INTO transactions (id, profile_id, direction, amount_cents, currency, category, note, occurred_at)
          VALUES (${id}, ${profileId}, ${body.direction}, ${body.amountCents}, ${body.currency}, ${body.category ?? null}, ${body.note ?? null}, ${occurredAt.toISOString()})
          RETURNING id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
        `;

        return sendJson(res, 200, { ok: true, transaction: mapTxRow(rows[0]) });
      } catch (e) {
        if (isPgUniqueViolation(e)) return sendJson(res, 409, { ok: false, error: "Transaction id already exists" });
        return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
      }
    }

    if (segments.length === 2) {
      const id = segments[1];

      if (req.method === "GET") {
        const { rows } = await sql`
          SELECT id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
          FROM transactions
          WHERE id = ${id} AND profile_id = ${profileId}
          LIMIT 1
        `;
        if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
        return sendJson(res, 200, { ok: true, transaction: mapTxRow(rows[0]) });
      }

      if (req.method === "PATCH") {
        try {
          const patch = TxPatchBody.parse(await readJson(req));

          const curQ = await sql`
            SELECT id
            FROM transactions
            WHERE id = ${id} AND profile_id = ${profileId}
            LIMIT 1
          `;
          if (!curQ.rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

          let occurredIso = null;
          if (patch.occurredAt !== undefined) {
            const d = new Date(patch.occurredAt);
            if (Number.isNaN(d.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });
            occurredIso = d.toISOString();
          }

          const { rows } = await sql`
            UPDATE transactions
            SET
              direction   = COALESCE(${patch.direction ?? null}, direction),
              amount_cents= COALESCE(${patch.amountCents ?? null}, amount_cents),
              currency    = COALESCE(${patch.currency ?? null}, currency),
              category    = ${patch.category === undefined ? sql`category` : patch.category},
              note        = ${patch.note === undefined ? sql`note` : patch.note},
              occurred_at = COALESCE(${occurredIso ?? null}, occurred_at),
              updated_at  = NOW()
            WHERE id = ${id} AND profile_id = ${profileId}
            RETURNING id, direction, amount_cents, currency, category, note, occurred_at, created_at, updated_at
          `;

          return sendJson(res, 200, { ok: true, transaction: mapTxRow(rows[0]) });
        } catch (e) {
          return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
        }
      }

      if (req.method === "DELETE") {
        await sql`DELETE FROM transactions WHERE id = ${id} AND profile_id = ${profileId}`;
        return sendJson(res, 200, { ok: true });
      }
    }

    return sendJson(res, 404, { ok: false, error: "Not Found" });
  }

  // /api/budgets
  if (segments[0] === "budgets") {
    const payload = requireAuth(req, res);
    if (!payload) return;
    const profileId = requireProfile(payload, res);
    if (!profileId) return;

    if (segments.length === 1 && req.method === "GET") {
      const month = url.searchParams.get("month");
      const monthFilter = month && /^\d{4}-\d{2}$/.test(month) ? month : null;

      const { rows } = monthFilter
        ? await sql`
            SELECT
              b.id, b.month, b.category, b.limit_cents, b.currency, b.created_at, b.updated_at,
              COALESCE((
                SELECT SUM(t.amount_cents)
                FROM transactions t
                WHERE t.profile_id = b.profile_id
                  AND t.direction = 'expense'
                  AND t.category = b.category
                  AND t.occurred_at >= to_date(b.month || '-01','YYYY-MM-DD')
                  AND t.occurred_at < (to_date(b.month || '-01','YYYY-MM-DD') + interval '1 month')
              ), 0) AS spent_cents
            FROM budgets b
            WHERE b.profile_id = ${profileId} AND b.month = ${monthFilter}
            ORDER BY b.category ASC
          `
        : await sql`
            SELECT
              b.id, b.month, b.category, b.limit_cents, b.currency, b.created_at, b.updated_at,
              COALESCE((
                SELECT SUM(t.amount_cents)
                FROM transactions t
                WHERE t.profile_id = b.profile_id
                  AND t.direction = 'expense'
                  AND t.category = b.category
                  AND t.occurred_at >= to_date(b.month || '-01','YYYY-MM-DD')
                  AND t.occurred_at < (to_date(b.month || '-01','YYYY-MM-DD') + interval '1 month')
              ), 0) AS spent_cents
            FROM budgets b
            WHERE b.profile_id = ${profileId}
            ORDER BY b.month DESC, b.category ASC
          `;

      return sendJson(res, 200, { ok: true, budgets: rows.map(mapBudgetRow) });
    }

    if (segments.length === 1 && req.method === "POST") {
      try {
        const body = BudgetUpsertBody.parse(await readJson(req));

        const { rows } = await sql`
          INSERT INTO budgets (profile_id, month, category, limit_cents, currency)
          VALUES (${profileId}, ${body.month}, ${body.category}, ${body.limitCents}, ${body.currency})
          ON CONFLICT (profile_id, month, category)
          DO UPDATE SET limit_cents = EXCLUDED.limit_cents, currency = EXCLUDED.currency, updated_at = NOW()
          RETURNING id, month, category, limit_cents, currency, created_at, updated_at
        `;

        const b = rows[0];
        const spentQ = await sql`
          SELECT COALESCE(SUM(amount_cents), 0) AS spent_cents
          FROM transactions
          WHERE profile_id = ${profileId}
            AND direction = 'expense'
            AND category = ${b.category}
            AND occurred_at >= to_date(${b.month} || '-01','YYYY-MM-DD')
            AND occurred_at < (to_date(${b.month} || '-01','YYYY-MM-DD') + interval '1 month')
        `;

        return sendJson(res, 200, {
          ok: true,
          budget: mapBudgetRow({ ...b, spent_cents: spentQ.rows[0].spent_cents }),
        });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
      }
    }

    if (segments.length === 2 && req.method === "DELETE") {
      const id = segments[1];
      await sql`DELETE FROM budgets WHERE id = ${id} AND profile_id = ${profileId}`;
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { ok: false, error: "Not Found" });
  }

  // /api/debts + /api/debts/:id/payments
  if (segments[0] === "debts") {
    const payload = requireAuth(req, res);
    if (!payload) return;
    const profileId = requireProfile(payload, res);
    if (!profileId) return;

    // /api/debts
    if (segments.length === 1) {
      if (req.method === "GET") {
        const status = url.searchParams.get("status");
        const statusFilter = status === "open" || status === "closed" ? status : null;
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50) || 50));

        const { rows } = statusFilter
          ? await sql`
              SELECT
                d.id, d.direction, d.counterparty, d.title, d.note,
                d.principal_cents, d.currency, d.started_at, d.due_at, d.status,
                d.created_at, d.updated_at,
                COALESCE(SUM(p.amount_cents), 0) AS paid_cents
              FROM debts d
              LEFT JOIN debt_payments p
                ON p.debt_id = d.id AND p.profile_id = d.profile_id
              WHERE d.profile_id = ${profileId} AND d.status = ${statusFilter}
              GROUP BY d.id
              ORDER BY d.started_at DESC, d.created_at DESC
              LIMIT ${limit}
            `
          : await sql`
              SELECT
                d.id, d.direction, d.counterparty, d.title, d.note,
                d.principal_cents, d.currency, d.started_at, d.due_at, d.status,
                d.created_at, d.updated_at,
                COALESCE(SUM(p.amount_cents), 0) AS paid_cents
              FROM debts d
              LEFT JOIN debt_payments p
                ON p.debt_id = d.id AND p.profile_id = d.profile_id
              WHERE d.profile_id = ${profileId}
              GROUP BY d.id
              ORDER BY d.started_at DESC, d.created_at DESC
              LIMIT ${limit}
            `;

        return sendJson(res, 200, { ok: true, debts: rows.map(mapDebtRow) });
      }

      if (req.method === "POST") {
        try {
          const body = DebtCreateBody.parse(await readJson(req));

          const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
          if (Number.isNaN(startedAt.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid startedAt" });

          let dueIso = null;
          if (body.dueAt !== undefined) {
            if (body.dueAt === null) dueIso = null;
            else {
              const d = new Date(body.dueAt);
              if (Number.isNaN(d.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid dueAt" });
              dueIso = d.toISOString();
            }
          }

          const id = body.id ?? crypto.randomUUID();

          const { rows } = await sql`
            INSERT INTO debts (
              id, profile_id, direction, counterparty, title, note,
              principal_cents, currency, started_at, due_at, status
            )
            VALUES (
              ${id}, ${profileId}, ${body.direction}, ${body.counterparty.trim()},
              ${body.title ?? null}, ${body.note ?? null},
              ${body.principalCents}, ${body.currency},
              ${startedAt.toISOString()}, ${dueIso}, 'open'
            )
            RETURNING
              id, direction, counterparty, title, note,
              principal_cents, currency, started_at, due_at, status,
              created_at, updated_at
          `;

          return sendJson(res, 200, { ok: true, debt: mapDebtRow({ ...rows[0], paid_cents: 0 }) });
        } catch (e) {
          if (isPgUniqueViolation(e)) return sendJson(res, 409, { ok: false, error: "Debt id already exists" });
          return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
        }
      }

      return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    // /api/debts/:id
    const debtId = segments[1];

    if (segments.length === 2) {
      if (req.method === "GET") {
        const { rows } = await sql`
          SELECT
            d.id, d.direction, d.counterparty, d.title, d.note,
            d.principal_cents, d.currency, d.started_at, d.due_at, d.status,
            d.created_at, d.updated_at,
            COALESCE((
              SELECT SUM(amount_cents)
              FROM debt_payments p
              WHERE p.debt_id = d.id AND p.profile_id = d.profile_id
            ), 0) AS paid_cents
          FROM debts d
          WHERE d.id = ${debtId} AND d.profile_id = ${profileId}
          LIMIT 1
        `;
        if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });
        return sendJson(res, 200, { ok: true, debt: mapDebtRow(rows[0]) });
      }

      if (req.method === "PATCH") {
        try {
          const patch = DebtPatchBody.parse(await readJson(req));

          const { rows } = await sql`
            UPDATE debts
            SET
              direction        = COALESCE(${patch.direction ?? null}, direction),
              counterparty     = COALESCE(${patch.counterparty ?? null}, counterparty),
              title            = ${patch.title === undefined ? sql`title` : patch.title},
              note             = ${patch.note === undefined ? sql`note` : patch.note},
              principal_cents  = COALESCE(${patch.principalCents ?? null}, principal_cents),
              currency         = COALESCE(${patch.currency ?? null}, currency),
              started_at       = COALESCE(${patch.startedAt ? new Date(patch.startedAt).toISOString() : null}, started_at),
              due_at           = ${patch.dueAt === undefined ? sql`due_at` : (patch.dueAt === null ? null : new Date(patch.dueAt).toISOString())},
              status           = COALESCE(${patch.status ?? null}, status),
              updated_at       = NOW()
            WHERE id = ${debtId} AND profile_id = ${profileId}
            RETURNING
              id, direction, counterparty, title, note,
              principal_cents, currency, started_at, due_at, status,
              created_at, updated_at
          `;
          if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

          const paidQ = await sql`
            SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents
            FROM debt_payments
            WHERE debt_id = ${debtId} AND profile_id = ${profileId}
          `;

          return sendJson(res, 200, { ok: true, debt: mapDebtRow({ ...rows[0], paid_cents: paidQ.rows[0].paid_cents }) });
        } catch (e) {
          return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
        }
      }

      if (req.method === "DELETE") {
        await sql`DELETE FROM debts WHERE id = ${debtId} AND profile_id = ${profileId}`;
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    // /api/debts/:id/payments
    if (segments[2] === "payments") {
      const exists = await sql`
        SELECT id
        FROM debts
        WHERE id = ${debtId} AND profile_id = ${profileId}
        LIMIT 1
      `;
      if (!exists.rows[0]) return sendJson(res, 404, { ok: false, error: "Debt not found" });

      if (segments.length === 3) {
        if (req.method === "GET") {
          const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 100) || 100));
          const { rows } = await sql`
            SELECT id, debt_id, amount_cents, occurred_at, note, created_at
            FROM debt_payments
            WHERE debt_id = ${debtId} AND profile_id = ${profileId}
            ORDER BY occurred_at DESC, created_at DESC
            LIMIT ${limit}
          `;
          return sendJson(res, 200, { ok: true, payments: rows.map(mapPaymentRow) });
        }

        if (req.method === "POST") {
          try {
            const body = PaymentCreateBody.parse(await readJson(req));
            const occurredAt = new Date(body.occurredAt);
            if (Number.isNaN(occurredAt.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });

            const id = body.id ?? crypto.randomUUID();

            const { rows } = await sql`
              INSERT INTO debt_payments (id, profile_id, debt_id, amount_cents, occurred_at, note)
              VALUES (${id}, ${profileId}, ${debtId}, ${body.amountCents}, ${occurredAt.toISOString()}, ${body.note ?? null})
              RETURNING id, debt_id, amount_cents, occurred_at, note, created_at
            `;

            await refreshDebtStatus(profileId, debtId);

            return sendJson(res, 200, { ok: true, payment: mapPaymentRow(rows[0]) });
          } catch (e) {
            if (isPgUniqueViolation(e)) return sendJson(res, 409, { ok: false, error: "Payment id already exists" });
            return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
          }
        }

        return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
      }

      // /api/debts/:id/payments/:paymentId
      if (segments.length === 4) {
        const paymentId = segments[3];

        if (req.method === "PATCH") {
          try {
            const patch = PaymentPatchBody.parse(await readJson(req));

            let occurredIso = null;
            if (patch.occurredAt !== undefined) {
              const d = new Date(patch.occurredAt);
              if (Number.isNaN(d.getTime())) return sendJson(res, 400, { ok: false, error: "Invalid occurredAt" });
              occurredIso = d.toISOString();
            }

            const { rows } = await sql`
              UPDATE debt_payments
              SET
                amount_cents = COALESCE(${patch.amountCents ?? null}, amount_cents),
                occurred_at  = COALESCE(${occurredIso ?? null}, occurred_at),
                note         = ${patch.note === undefined ? sql`note` : patch.note}
              WHERE id = ${paymentId} AND debt_id = ${debtId} AND profile_id = ${profileId}
              RETURNING id, debt_id, amount_cents, occurred_at, note, created_at
            `;

            if (!rows[0]) return sendJson(res, 404, { ok: false, error: "Not found" });

            await refreshDebtStatus(profileId, debtId);

            return sendJson(res, 200, { ok: true, payment: mapPaymentRow(rows[0]) });
          } catch (e) {
            return sendJson(res, 400, { ok: false, error: String(e?.message ?? e) });
          }
        }

        if (req.method === "DELETE") {
          await sql`
            DELETE FROM debt_payments
            WHERE id = ${paymentId} AND debt_id = ${debtId} AND profile_id = ${profileId}
          `;

          await refreshDebtStatus(profileId, debtId);

          return sendJson(res, 200, { ok: true });
        }

        return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
      }
    }

    return sendJson(res, 404, { ok: false, error: "Not Found" });
  }

  return sendJson(res, 404, { ok: false, error: "Not Found" });
}

function mapTxRow(r) {
  return {
    id: r.id,
    direction: r.direction,
    amountCents: Number(r.amount_cents),
    currency: r.currency,
    category: r.category,
    note: r.note,
    occurredAt: r.occurred_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapBudgetRow(r) {
  const limitCents = Number(r.limit_cents);
  const spentCents = Number(r.spent_cents ?? 0);
  const remainingCents = Math.max(0, limitCents - spentCents);
  const percentUsed = limitCents > 0 ? Math.min(100, Math.round((spentCents / limitCents) * 100)) : 0;

  return {
    id: r.id,
    month: r.month,
    category: r.category,
    limitCents,
    currency: r.currency,
    spentCents,
    remainingCents,
    percentUsed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapDebtRow(r) {
  const principalCents = Number(r.principal_cents);
  const paidCents = Number(r.paid_cents ?? 0);
  const balanceCents = Math.max(0, principalCents - paidCents);

  return {
    id: r.id,
    direction: r.direction,
    counterparty: r.counterparty,
    title: r.title,
    note: r.note,
    principalCents,
    paidCents,
    balanceCents,
    currency: r.currency,
    startedAt: r.started_at,
    dueAt: r.due_at,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPaymentRow(r) {
  return {
    id: r.id,
    debtId: r.debt_id,
    amountCents: Number(r.amount_cents),
    occurredAt: r.occurred_at,
    note: r.note,
    createdAt: r.created_at,
  };
}

async function refreshDebtStatus(profileId, debtId) {
  const d = await sql`
    SELECT principal_cents
    FROM debts
    WHERE id = ${debtId} AND profile_id = ${profileId}
    LIMIT 1
  `;
  if (!d.rows[0]) return;

  const paidQ = await sql`
    SELECT COALESCE(SUM(amount_cents), 0) AS paid_cents
    FROM debt_payments
    WHERE debt_id = ${debtId} AND profile_id = ${profileId}
  `;

  const principal = Number(d.rows[0].principal_cents);
  const paid = Number(paidQ.rows[0].paid_cents);
  const status = paid >= principal && principal > 0 ? "closed" : "open";

  await sql`
    UPDATE debts
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${debtId} AND profile_id = ${profileId}
  `;
}