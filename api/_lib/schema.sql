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

-- A2: індекси для швидких вибірок по user_id
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