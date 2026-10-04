/*
# Fix administrator profile visibility

1. Purpose
- Replace the recursive profile read policy that can prevent the signed-in administrator from reading their own role.

2. Modified table
- `profiles`: the SELECT policy now uses the existing SECURITY DEFINER `is_admin()` helper instead of querying `profiles` from inside its own policy.

3. Security
- Authenticated users can read their own profile.
- Administrators can read all profiles for oversight.
- No write permissions are changed.

4. Important notes
- This is a non-destructive policy correction.
- Existing accounts, roles, and profile data remain unchanged.
*/

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;

CREATE POLICY "profiles_select_own_or_admin"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR is_admin());