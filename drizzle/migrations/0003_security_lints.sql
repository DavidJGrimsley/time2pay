-- 1. Fix mutable search_path on public.set_updated_at (Supabase lint 0011).
--    Recreating with `SET search_path` pins the function's lookup so a
--    malicious schema cannot shadow built-ins inside the trigger body.
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- 2. Lock down public.rls_auto_enable (Supabase lints 0028 / 0029).
--    SECURITY DEFINER functions exposed via PostgREST must not be callable
--    by anon or authenticated roles. Revoke EXECUTE so only service_role
--    and postgres (which retain default privileges) can invoke it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END;
$$;
--> statement-breakpoint

-- 3. Explicit RLS policies on Mercury tables (Supabase lint 0008).
--    All write paths go through service_role-equivalent server routes,
--    which bypass RLS. These policies define the read surface for end
--    users querying via PostgREST with their own JWT.

-- mercury_credentials: never expose ciphertext / vault_secret_id directly.
-- The `+api.ts` route returns a sanitized status; clients have no need to
-- query the underlying row. Explicit deny-all makes the intent obvious to
-- the linter and to any future reader.
DROP POLICY IF EXISTS mercury_credentials_no_direct_access ON public.mercury_credentials;
--> statement-breakpoint
CREATE POLICY mercury_credentials_no_direct_access ON public.mercury_credentials
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);
--> statement-breakpoint

-- mercury_credential_history: users may inspect their own rotation log
-- (vault_secret_id is opaque without vault.decrypted_secrets access, which
-- authenticated users do not have).
DROP POLICY IF EXISTS mercury_credential_history_select_own ON public.mercury_credential_history;
--> statement-breakpoint
CREATE POLICY mercury_credential_history_select_own ON public.mercury_credential_history
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);
--> statement-breakpoint

-- mercury_credential_events: users may inspect their own credential audit
-- trail (created / rotated / tested / deleted / ar_probed events).
DROP POLICY IF EXISTS mercury_credential_events_select_own ON public.mercury_credential_events;
--> statement-breakpoint
CREATE POLICY mercury_credential_events_select_own ON public.mercury_credential_events
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);
