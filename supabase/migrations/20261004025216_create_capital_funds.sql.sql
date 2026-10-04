/*
# Create capital_funds table — personal capital fund tracking

1. New Tables
- `capital_funds`
  - id (uuid, PK)
  - user_id (uuid, FK auth.users, defaults to auth.uid())
  - amount (numeric, the amount added or withdrawn)
  - type (text: 'aporte' or 'retiro' — whether money was added to or withdrawn from the fund)
  - date (date, when the movement happened)
  - note (text, optional description)
  - created_at (timestamptz)

2. Security
- Enable RLS on `capital_funds`.
- Owner-scoped CRUD: each authenticated user can only access their own fund movements.
- user_id defaults to auth.uid() so inserts from the frontend succeed without passing it.
- Admins can read all users' fund movements for oversight.

3. Important Notes
- This table tracks the user's PERSONAL capital fund — money they set aside for lending.
- Each row is a movement (aporte = adding money, retiro = withdrawing money).
- The current fund balance is computed by summing aportes minus retiros.
- This is separate from loan capital — it's the lender's own wallet/fund tracker.
*/

CREATE TABLE IF NOT EXISTS capital_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'aporte' CHECK (type IN ('aporte', 'retiro')),
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE capital_funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capital_funds_select_own_or_admin" ON capital_funds;
CREATE POLICY "capital_funds_select_own_or_admin"
ON capital_funds FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "capital_funds_insert_own" ON capital_funds;
CREATE POLICY "capital_funds_insert_own"
ON capital_funds FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "capital_funds_update_own" ON capital_funds;
CREATE POLICY "capital_funds_update_own"
ON capital_funds FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "capital_funds_delete_own" ON capital_funds;
CREATE POLICY "capital_funds_delete_own"
ON capital_funds FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capital_funds_user_id ON capital_funds(user_id);
CREATE INDEX IF NOT EXISTS idx_capital_funds_date ON capital_funds(date);
