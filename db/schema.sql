CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

CREATE TABLE IF NOT EXISTS profile_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_members_profile ON profile_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_members_user ON profile_members(user_id);

INSERT INTO profile_members (profile_id, user_id, role)
SELECT p.id, p.user_id, 'owner'
FROM profiles p
ON CONFLICT (profile_id, user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash', 'card', 'bank', 'savings', 'other')),
  currency text NOT NULL DEFAULT 'UAH',
  opening_balance_cents integer NOT NULL DEFAULT 0 CHECK (opening_balance_cents >= 0),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_profile ON accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_accounts_profile_default ON accounts(profile_id, is_default);

INSERT INTO accounts (id, profile_id, name, kind, currency, opening_balance_cents, is_default)
SELECT
  gen_random_uuid(),
  p.id,
  'Основний рахунок',
  'cash',
  'UAH',
  0,
  true
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM accounts a
  WHERE a.profile_id = p.id
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('income','expense')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'UAH',
  category text,
  note text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

UPDATE transactions t
SET account_id = a.id
FROM accounts a
WHERE t.profile_id = a.profile_id
  AND a.is_default = true
  AND t.account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_profile_occurred
  ON transactions(profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_profile_account
  ON transactions(profile_id, account_id);

CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month text NOT NULL,
  category text NOT NULL,
  limit_cents integer NOT NULL CHECK (limit_cents >= 0),
  currency text NOT NULL DEFAULT 'UAH',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, month, category)
);

CREATE INDEX IF NOT EXISTS idx_budgets_profile_month
  ON budgets(profile_id, month);

CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('i_owe','owed_to_me')),
  counterparty text NOT NULL,
  title text,
  note text,
  principal_cents integer NOT NULL CHECK (principal_cents >= 0),
  currency text NOT NULL DEFAULT 'UAH',
  started_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_profile_status
  ON debts(profile_id, status);

CREATE INDEX IF NOT EXISTS idx_debts_profile_started
  ON debts(profile_id, started_at DESC);

CREATE TABLE IF NOT EXISTS debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  occurred_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_debt_occurred
  ON debt_payments(debt_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_profile
  ON debt_payments(profile_id);