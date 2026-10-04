/*
# Auth + multi-user schema for PrestaControl

1. New Tables
- `profiles` — links each auth.users user to a role (admin or colaborador) and display name
  - id (uuid, PK, references auth.users)
  - email (text, unique)
  - display_name (text)
  - role (text: 'admin' or 'colaborador', default 'colaborador')
  - created_at (timestamptz)
- `clients` — clients created by users
  - id (uuid, PK)
  - user_id (uuid, FK auth.users, defaults to auth.uid())
  - name (text)
  - phone (text)
  - notes (text)
  - created_at (date)
- `loans` — loans tied to clients
  - id (uuid, PK)
  - user_id (uuid, FK auth.users, defaults to auth.uid())
  - client_id (uuid, FK clients)
  - capital (numeric)
  - start_date (date)
  - interest_rate (numeric)
  - modality (text)
  - frequency (text)
  - term_length (int)
  - payment_method (text)
  - status (text, default 'activa')
  - created_at (date)
  - note (text)
- `payments` — payments for loans
  - id (uuid, PK)
  - user_id (uuid, FK auth.users, defaults to auth.uid())
  - loan_id (uuid, FK loans)
  - date (date)
  - amount (numeric)
  - method (text)
  - concept (text)
  - imputation (text)
  - to_interest (numeric)
  - to_capital (numeric)
  - note (text)
  - receipt_no (text)
  - remaining_capital (numeric)
  - remaining_interest (numeric)

2. Security
- RLS enabled on all tables.
- Colaboradores can CRUD their own data (user_id = auth.uid()).
- Admins can read ALL data (all users) but only mutate their own.
- A SECURITY DEFINER function `is_admin()` checks the caller's role.
- Auto-create profile on signup via trigger.

3. Important Notes
- The first user to register must be promoted to admin manually via SQL:
  UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
- Colaboradores see only their own clients/loans/payments.
- Admins see everything (for oversight) but can only modify their own rows.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  role text NOT NULL DEFAULT 'colaborador' CHECK (role IN ('admin', 'colaborador')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- is_admin helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text DEFAULT '',
  notes text DEFAULT '',
  created_at date DEFAULT CURRENT_DATE
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_own_or_admin" ON clients;
CREATE POLICY "clients_select_own_or_admin"
ON clients FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "clients_insert_own" ON clients;
CREATE POLICY "clients_insert_own"
ON clients FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_update_own" ON clients;
CREATE POLICY "clients_update_own"
ON clients FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_delete_own" ON clients;
CREATE POLICY "clients_delete_own"
ON clients FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Loans table
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  capital numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  interest_rate numeric NOT NULL DEFAULT 0,
  modality text NOT NULL DEFAULT 'solo_interes',
  frequency text NOT NULL DEFAULT 'mensual',
  term_length int NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'efectivo',
  status text NOT NULL DEFAULT 'activa',
  created_at date DEFAULT CURRENT_DATE,
  note text DEFAULT ''
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans_select_own_or_admin" ON loans;
CREATE POLICY "loans_select_own_or_admin"
ON loans FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "loans_insert_own" ON loans;
CREATE POLICY "loans_insert_own"
ON loans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "loans_update_own" ON loans;
CREATE POLICY "loans_update_own"
ON loans FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "loans_delete_own" ON loans;
CREATE POLICY "loans_delete_own"
ON loans FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'efectivo',
  concept text NOT NULL DEFAULT 'interes',
  imputation text NOT NULL DEFAULT 'auto',
  to_interest numeric NOT NULL DEFAULT 0,
  to_capital numeric NOT NULL DEFAULT 0,
  note text DEFAULT '',
  receipt_no text DEFAULT '',
  remaining_capital numeric NOT NULL DEFAULT 0,
  remaining_interest numeric NOT NULL DEFAULT 0
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own_or_admin" ON payments;
CREATE POLICY "payments_select_own_or_admin"
ON payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "payments_insert_own" ON payments;
CREATE POLICY "payments_insert_own"
ON payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_update_own" ON payments;
CREATE POLICY "payments_update_own"
ON payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_delete_own" ON payments;
CREATE POLICY "payments_delete_own"
ON payments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_client_id ON loans(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
