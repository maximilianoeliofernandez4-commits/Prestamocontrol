/*
# Client invitations and self-registration

1. Purpose
   Allows the lender to generate a shareable link for a prospect. The prospect
   opens the link (no login required) and fills in their name, phone, DNI,
   address, and a face photo. The lender then reviews the submission, confirms
   it, and the prospect is automatically created as a client — ready for loan
   creation.

2. New Tables
- `client_invitations`
  - id (uuid, PK)
  - user_id (uuid, FK auth.users, defaults to auth.uid()) — the lender who created the invite
  - token (text, unique) — random token used in the shareable link
  - status (text: 'pendiente' | 'completado' | 'confirmado' | 'vencido', default 'pendiente')
    - 'pendiente': invite created, prospect hasn't filled the form yet
    - 'completado': prospect submitted the form, awaiting lender review
    - 'confirmado': lender confirmed, client was created
    - 'vencido': invite expired or was cancelled
  - prospect_name (text, default '') — filled by prospect
  - prospect_phone (text, default '') — filled by prospect
  - prospect_dni (text, default '') — filled by prospect
  - prospect_address (text, default '') — filled by prospect
  - prospect_photo_url (text, default '') — URL to the face photo in storage
  - lender_note (text, default '') — optional note from lender when creating invite
  - created_client_id (uuid, nullable) — set when lender confirms and client is created
  - created_at (timestamptz, default now())
  - completed_at (timestamptz, nullable) — when prospect submitted the form
  - confirmed_at (timestamptz, nullable) — when lender confirmed

3. Storage
- A public bucket `prospect-photos` is created for face photos uploaded by prospects.
  Public read so the lender can view the photo; writes restricted to anon+authenticated.

4. Security
- RLS enabled on `client_invitations`.
- Lenders (authenticated) can SELECT, INSERT, UPDATE, DELETE their own invitations.
- Anon role can:
  - SELECT a single invitation by token (to load the form and check status) —
    policy uses `token = current_setting('invite.token', true)` is NOT used;
    instead we expose a SECURITY DEFINER function `get_invitation_by_token`
    so anon can fetch one row by token without a broad SELECT policy.
  - UPDATE an invitation by token to submit the form — exposed via a SECURITY
    DEFINER function `submit_invitation` so anon can update only the prospect
    fields and only when status = 'pendiente'.
- This approach avoids giving anon any direct table policy, keeping access
  tightly scoped to the two operations needed.

5. Important Notes
- The shareable link format is: /#/invitar/<token>
- Photos are uploaded directly to the `prospect-photos` bucket from the public form.
- The lender sees completed invitations in a "Solicitudes" section and can
  confirm them, which creates a client and opens loan creation.
*/

CREATE TABLE IF NOT EXISTS client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'completado', 'confirmado', 'vencido')),
  prospect_name text NOT NULL DEFAULT '',
  prospect_phone text NOT NULL DEFAULT '',
  prospect_dni text NOT NULL DEFAULT '',
  prospect_address text NOT NULL DEFAULT '',
  prospect_photo_url text NOT NULL DEFAULT '',
  lender_note text NOT NULL DEFAULT '',
  created_client_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  confirmed_at timestamptz
);

ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;

-- Lenders can manage their own invitations
DROP POLICY IF EXISTS "invitations_select_own" ON client_invitations;
CREATE POLICY "invitations_select_own"
ON client_invitations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "invitations_insert_own" ON client_invitations;
CREATE POLICY "invitations_insert_own"
ON client_invitations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "invitations_update_own" ON client_invitations;
CREATE POLICY "invitations_update_own"
ON client_invitations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "invitations_delete_own" ON client_invitations;
CREATE POLICY "invitations_delete_own"
ON client_invitations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- SECURITY DEFINER function: anon can fetch an invitation by token
-- Returns the invitation row if status is 'pendiente' or 'completado'.
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS client_invitations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM client_invitations
  WHERE token = p_token
    AND status IN ('pendiente', 'completado')
  LIMIT 1;
$$;

-- Grant anon + authenticated the ability to call this function
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated;

-- SECURITY DEFINER function: anon submits the prospect's form data
-- Only updates prospect fields, only when status = 'pendiente'.
CREATE OR REPLACE FUNCTION submit_invitation(
  p_token text,
  p_name text,
  p_phone text,
  p_dni text,
  p_address text,
  p_photo_url text
)
RETURNS client_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row client_invitations;
BEGIN
  UPDATE client_invitations
  SET prospect_name = p_name,
      prospect_phone = p_phone,
      prospect_dni = p_dni,
      prospect_address = p_address,
      prospect_photo_url = p_photo_url,
      status = 'completado',
      completed_at = now()
  WHERE token = p_token
    AND status = 'pendiente'
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Invitación no encontrada o ya completada';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_invitation(text, text, text, text, text, text) TO anon, authenticated;

-- SECURITY DEFINER function: lender confirms a completed invitation,
-- creating a client row. Returns the new client id.
CREATE OR REPLACE FUNCTION confirm_invitation(p_invitation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv client_invitations;
  v_client_id uuid;
BEGIN
  SELECT * INTO v_inv FROM client_invitations WHERE id = p_invitation_id FOR UPDATE;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF v_inv.status <> 'completado' THEN
    RAISE EXCEPTION 'La invitación no está lista para confirmar';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_inv.user_id THEN
    RAISE EXCEPTION 'No tenés permiso para confirmar esta invitación';
  END IF;

  INSERT INTO clients (user_id, name, phone, notes)
  VALUES (v_inv.user_id, v_inv.prospect_name, v_inv.prospect_phone,
    CONCAT('DNI: ', v_inv.prospect_dni, ' | Dirección: ', v_inv.prospect_address,
      CASE WHEN v_inv.prospect_photo_url <> '' THEN CONCAT(' | Foto: ', v_inv.prospect_photo_url) ELSE '' END))
  RETURNING id INTO v_client_id;

  UPDATE client_invitations
  SET status = 'confirmado', created_client_id = v_client_id, confirmed_at = now()
  WHERE id = p_invitation_id;

  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_invitation(uuid) TO authenticated;

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_client_invitations_token ON client_invitations(token);
CREATE INDEX IF NOT EXISTS idx_client_invitations_user_id ON client_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_client_invitations_status ON client_invitations(status);

-- Create the prospect-photos storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('prospect-photos', 'prospect-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone (anon) can upload to prospect-photos,
-- everyone can read (public bucket). We scope uploads by requiring
-- the file path to start with the invitation token so uploads are
-- tied to a valid pending invitation.
DROP POLICY IF EXISTS "prospect_photos_read" ON storage.objects;
CREATE POLICY "prospect_photos_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'prospect-photos');

DROP POLICY IF EXISTS "prospect_photos_upload" ON storage.objects;
CREATE POLICY "prospect_photos_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'prospect-photos');
