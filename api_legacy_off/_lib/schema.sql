-- Мінімальна схема для старту (A1)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_user_created_idx ON profiles(user_id, created_at);

-- A3: transactions (server-side)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UAH',

  category TEXT,
  note TEXT,

  occurred_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_profile_occurred_idx
  ON transactions(profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_profile_created_idx
  ON transactions(profile_id, created_at DESC);

-- A4: budgets (plan vs fact)
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  month TEXT NOT NULL,
  category TEXT NOT NULL,

  limit_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UAH',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS budgets_profile_month_category_uidx
  ON budgets(profile_id, month, category);

CREATE INDEX IF NOT EXISTS budgets_profile_month_idx
  ON budgets(profile_id, month DESC);

-- A5: debts + payments
-- direction:
--  - i_owe: я винен(на) комусь
--  - owed_to_me: мені винні
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  direction TEXT NOT NULL CHECK (direction IN ('i_owe', 'owed_to_me')),
  counterparty TEXT NOT NULL,

  title TEXT,
  note TEXT,

  principal_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UAH',

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS debts_profile_started_idx
  ON debts(profile_id, started_at DESC);

CREATE INDEX IF NOT EXISTS debts_profile_status_idx
  ON debts(profile_id, status);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,

  amount_cents BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,

  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS debt_payments_debt_occurred_idx
  ON debt_payments(debt_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS debt_payments_profile_occurred_idx
  ON debt_payments(profile_id, occurred_at DESC);