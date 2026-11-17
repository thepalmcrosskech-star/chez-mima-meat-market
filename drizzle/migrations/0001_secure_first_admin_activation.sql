CREATE TABLE public.admin_bootstrap (id boolean PRIMARY KEY DEFAULT true CHECK (id), email text NOT NULL, claimed_by uuid REFERENCES public.profiles(id), claimed_at timestamptz);
GRANT ALL ON public.admin_bootstrap TO service_role;
REVOKE ALL ON public.admin_bootstrap FROM anon, authenticated;
ALTER TABLE public.admin_bootstrap ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_first_admin() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reservation public.admin_bootstrap%ROWTYPE; verified_email text; verified_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
 SELECT * INTO reservation FROM public.admin_bootstrap WHERE id=true FOR UPDATE;
 IF NOT FOUND OR reservation.claimed_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') THEN RAISE EXCEPTION 'Activation administrateur indisponible'; END IF;
 SELECT email,email_confirmed_at INTO verified_email,verified_at FROM auth.users WHERE id=auth.uid();
 IF verified_at IS NULL OR lower(verified_email) IS DISTINCT FROM lower(reservation.email) THEN RAISE EXCEPTION 'Adresse administrateur non autorisée ou non confirmée'; END IF;
 PERFORM set_config('app.authorized_role_change','true',true);
 UPDATE public.profiles SET role='admin' WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Fiche utilisateur introuvable'; END IF;
 UPDATE public.admin_bootstrap SET claimed_by=auth.uid(),claimed_at=now() WHERE id=true;
END $$;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_profile_updates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user_id uuid:=auth.uid();
BEGIN
 IF NEW.role IS DISTINCT FROM OLD.role AND coalesce(auth.role(),'') <> 'service_role' AND coalesce(current_setting('app.authorized_role_change',true),'') <> 'true' THEN RAISE EXCEPTION 'Utilisez le changement de rôle sécurisé'; END IF;
 IF coalesce(current_setting('app.authorized_role_change',true),'')='true' OR coalesce(auth.role(),'')='service_role' OR (v_user_id IS NOT NULL AND public.has_admin_role(v_user_id)) THEN RETURN NEW; END IF;
 IF v_user_id IS NULL OR OLD.id<>v_user_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email OR NEW.role IS DISTINCT FROM OLD.role OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Profile changes are not authorized'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.set_profile_role_as_admin(_target_user_id uuid,_new_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_role text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_admin_role(auth.uid()) THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
 IF _target_user_id IS NULL OR _new_role IS NULL OR _new_role NOT IN ('user','driver','admin') THEN RAISE EXCEPTION 'Rôle invalide'; END IF;
 PERFORM pg_advisory_xact_lock(73819402);
 SELECT role INTO old_role FROM public.user_roles WHERE user_id=_target_user_id LIMIT 1;
 IF old_role='admin' AND _new_role<>'admin' AND (SELECT count(*) FROM public.user_roles WHERE role='admin')<=1 THEN RAISE EXCEPTION 'Le dernier administrateur doit être conservé'; END IF;
 IF _new_role='driver' AND NOT EXISTS(SELECT 1 FROM public.driver_profiles WHERE user_id=_target_user_id) THEN RAISE EXCEPTION 'Créez d’abord le profil dans Livreurs'; END IF;
 IF old_role='driver' AND _new_role<>'driver' AND EXISTS(SELECT 1 FROM public.orders WHERE driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id=_target_user_id) AND status NOT IN ('delivered','cancelled')) THEN RAISE EXCEPTION 'Ce livreur a encore une livraison en cours'; END IF;
 PERFORM set_config('app.authorized_role_change','true',true);
 UPDATE public.profiles SET role=_new_role WHERE id=_target_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Utilisateur introuvable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_profile_role_as_admin(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_profile_role_as_admin(uuid,text) TO authenticated;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING(auth.uid()=id) WITH CHECK(auth.uid()=id);