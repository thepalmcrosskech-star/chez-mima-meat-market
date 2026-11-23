CREATE OR REPLACE FUNCTION public.has_staff_access(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN coalesce(auth.role(), '') = 'service_role' THEN EXISTS (
      SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = $1 AND ur.role IN ('admin', 'employee')
    )
    WHEN auth.uid() IS NULL OR auth.uid() <> $1 THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = $1 AND ur.role IN ('admin', 'employee')
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.has_staff_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_staff_access(uuid) TO authenticated, service_role;

ALTER TABLE public.orders
  ADD COLUMN receipt_photo_path text,
  ADD COLUMN receipt_uploaded_at timestamptz,
  ADD COLUMN receipt_uploaded_by uuid REFERENCES public.profiles(id),
  ADD COLUMN courier_called_at timestamptz,
  ADD COLUMN courier_called_by uuid REFERENCES public.profiles(id);

COMMENT ON COLUMN public.orders.receipt_photo_path IS 'Ticket de caisse interne, obligatoire avant le statut prête via le comptoir salarié.';
COMMENT ON COLUMN public.orders.courier_called_at IS 'Horodatage de l’appel manuel au coursier externe par le comptoir.';

CREATE OR REPLACE FUNCTION public.set_profile_role_as_admin(_target_user_id uuid, _new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE old_role text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_role(auth.uid()) THEN
    RAISE EXCEPTION 'Accès administrateur requis';
  END IF;
  IF _target_user_id IS NULL OR _new_role IS NULL OR _new_role NOT IN ('user', 'driver', 'admin', 'employee') THEN
    RAISE EXCEPTION 'Rôle invalide';
  END IF;
  PERFORM pg_advisory_xact_lock(73819402);
  SELECT role INTO old_role FROM public.user_roles WHERE user_id = _target_user_id LIMIT 1;
  IF old_role = 'admin' AND _new_role <> 'admin' AND (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'Le dernier administrateur doit être conservé';
  END IF;
  IF _new_role = 'driver' AND NOT EXISTS (SELECT 1 FROM public.driver_profiles WHERE user_id = _target_user_id) THEN
    RAISE EXCEPTION 'Créez d’abord le profil dans Livreurs';
  END IF;
  IF old_role = 'driver' AND _new_role <> 'driver' AND EXISTS (
    SELECT 1 FROM public.orders WHERE driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = _target_user_id)
      AND status NOT IN ('delivered', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Ce livreur a encore une livraison en cours';
  END IF;
  PERFORM set_config('app.authorized_role_change', 'true', true);
  UPDATE public.profiles SET role = _new_role WHERE id = _target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utilisateur introuvable'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role NOT IN ('user', 'driver', 'admin', 'employee') THEN
    RAISE EXCEPTION 'Invalid user role';
  END IF;
  DELETE FROM public.user_roles AS ur WHERE ur.user_id = NEW.id AND ur.role <> NEW.role;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, NEW.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_admin boolean := false;
  v_employee boolean := false;
  v_driver_transition boolean := current_setting('chezmima.driver_order_transition', true) = 'true';
  v_staff_transition boolean := current_setting('chezmima.staff_order_transition', true) = 'true';
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT public.has_admin_role(v_user_id) INTO v_admin;
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_user_id AND ur.role = 'employee'
    ) INTO v_employee;
  END IF;

  IF coalesce(auth.role(), '') = 'service_role' OR v_admin THEN RETURN NEW; END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR NEW.total_price IS DISTINCT FROM OLD.total_price
    OR NEW.delivery_address_id IS DISTINCT FROM OLD.delivery_address_id
    OR NEW.delivery_zone_id IS DISTINCT FROM OLD.delivery_zone_id
    OR NEW.delivery_address_snapshot IS DISTINCT FROM OLD.delivery_address_snapshot
    OR NEW.notes IS DISTINCT FROM OLD.notes OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.cash_bill_amount IS DISTINCT FROM OLD.cash_bill_amount OR NEW.cmi_order_id IS DISTINCT FROM OLD.cmi_order_id
    OR NEW.cmi_transaction_id IS DISTINCT FROM OLD.cmi_transaction_id OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
    OR NEW.assignment_attempts IS DISTINCT FROM OLD.assignment_attempts THEN
    RAISE EXCEPTION 'Order details can only be changed by an administrator';
  END IF;

  IF v_employee AND v_staff_transition
    AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id
    AND NEW.assignment_status IS NOT DISTINCT FROM OLD.assignment_status THEN
    RETURN NEW;
  END IF;

  IF v_driver_transition AND EXISTS (
    SELECT 1 FROM public.driver_profiles dp WHERE dp.id = NEW.driver_id AND dp.user_id = v_user_id
  ) AND (
    (OLD.status = 'ready' AND NEW.status = 'delivering' AND NEW.assignment_status = 'assigned')
    OR (OLD.status = 'delivering' AND NEW.status = 'delivered' AND OLD.driver_id = NEW.driver_id)
  ) THEN RETURN NEW; END IF;

  IF v_user_id = OLD.user_id AND NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed')
    AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id
    AND NEW.assignment_status IS NOT DISTINCT FROM OLD.assignment_status THEN RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Order update is not authorized';
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_order_receipt(_order_id uuid, _photo_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN
    RAISE EXCEPTION 'Accès comptoir requis';
  END IF;
  IF _photo_path IS NULL OR length(_photo_path) > 500
    OR _photo_path NOT LIKE (_order_id::text || '/%') OR position('..' IN _photo_path) > 0 THEN
    RAISE EXCEPTION 'Chemin de photo invalide';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status NOT IN ('confirmed', 'preparing', 'ready') THEN
    RAISE EXCEPTION 'Le ticket ne peut plus être joint à cette commande';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects WHERE bucket_id = 'order-receipts' AND name = _photo_path
  ) THEN
    RAISE EXCEPTION 'Photo du ticket introuvable';
  END IF;
  PERFORM set_config('chezmima.staff_order_transition', 'true', true);
  UPDATE public.orders SET
    receipt_photo_path = _photo_path,
    receipt_uploaded_at = now(),
    receipt_uploaded_by = auth.uid()
  WHERE id = _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_courier_called(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN
    RAISE EXCEPTION 'Accès comptoir requis';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.delivery_mode = 'pickup' OR v_order.status <> 'ready' THEN
    RAISE EXCEPTION 'La commande doit être prête et en livraison';
  END IF;
  IF v_order.receipt_photo_path IS NULL THEN
    RAISE EXCEPTION 'Ajoutez la photo du ticket avant l’appel au livreur';
  END IF;
  PERFORM set_config('chezmima.staff_order_transition', 'true', true);
  UPDATE public.orders SET courier_called_at = now(), courier_called_by = auth.uid() WHERE id = _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_staff_order_status(_order_id uuid, _new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_title text;
  v_message text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN
    RAISE EXCEPTION 'Accès comptoir requis';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  IF NOT (
    (v_order.status = 'pending' AND _new_status IN ('confirmed', 'cancelled')) OR
    (v_order.status = 'confirmed' AND _new_status IN ('preparing', 'cancelled')) OR
    (v_order.status = 'preparing' AND _new_status IN ('ready', 'cancelled')) OR
    (v_order.status = 'ready' AND v_order.delivery_mode = 'pickup' AND _new_status = 'delivered') OR
    (v_order.status = 'ready' AND v_order.delivery_mode <> 'pickup' AND _new_status = 'delivering') OR
    (v_order.status = 'delivering' AND _new_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Changement de statut non autorisé depuis le comptoir';
  END IF;

  IF _new_status = 'ready' AND v_order.receipt_photo_path IS NULL THEN
    RAISE EXCEPTION 'Ajoutez la photo du ticket de caisse avant de déclarer la commande prête';
  END IF;
  IF _new_status = 'delivering' AND v_order.courier_called_at IS NULL THEN
    RAISE EXCEPTION 'Enregistrez d’abord l’appel au livreur';
  END IF;

  PERFORM set_config('chezmima.staff_order_transition', 'true', true);
  UPDATE public.orders SET status = _new_status WHERE id = _order_id;

  v_title := CASE _new_status
    WHEN 'confirmed' THEN 'Commande confirmée ✅'
    WHEN 'preparing' THEN 'En préparation 🍖'
    WHEN 'ready' THEN 'Commande prête ! 🎉'
    WHEN 'delivering' THEN 'En livraison 🚚'
    WHEN 'delivered' THEN CASE WHEN v_order.delivery_mode = 'pickup' THEN 'Commande récupérée ✅' ELSE 'Commande livrée ✅' END
    WHEN 'cancelled' THEN 'Commande annulée ❌'
  END;
  v_message := CASE _new_status
    WHEN 'confirmed' THEN 'Votre commande a été confirmée et sera bientôt préparée.'
    WHEN 'preparing' THEN 'Votre commande est en cours de préparation.'
    WHEN 'ready' THEN CASE WHEN v_order.delivery_mode = 'pickup' THEN 'Votre commande est prête. Vous pouvez venir la récupérer en boucherie.' ELSE 'Votre commande est prête et va être confiée au livreur.' END
    WHEN 'delivering' THEN 'Votre commande est en route !'
    WHEN 'delivered' THEN CASE WHEN v_order.delivery_mode = 'pickup' THEN 'Votre commande a été récupérée. Merci !' ELSE 'Votre commande a été livrée. Bon appétit !' END
    WHEN 'cancelled' THEN 'Votre commande a été annulée.'
  END;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, order_id, title, message)
    VALUES (v_order.user_id, v_order.id, v_title, v_message);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_order_receipt(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_order_courier_called(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_staff_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_order_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_courier_called(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_order_status(uuid, text) TO authenticated;

CREATE POLICY "Staff can view application orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_staff_access(auth.uid()));
CREATE POLICY "Staff can update orders through guarded workflow" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_staff_access(auth.uid())) WITH CHECK (public.has_staff_access(auth.uid()));
CREATE POLICY "Staff can view application order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_staff_access(auth.uid()));
CREATE POLICY "Staff can view customer profiles with orders" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_staff_access(auth.uid()) AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = profiles.id)
  );
CREATE POLICY "Staff can view all catalogue products" ON public.products
  FOR SELECT TO authenticated USING (public.has_staff_access(auth.uid()));
CREATE POLICY "Staff can manage catalogue products" ON public.products
  FOR ALL TO authenticated USING (public.has_staff_access(auth.uid())) WITH CHECK (public.has_staff_access(auth.uid()));

CREATE POLICY "Staff can read private order receipts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'order-receipts' AND public.has_staff_access(auth.uid()));
CREATE POLICY "Staff can upload private order receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'order-receipts' AND public.has_staff_access(auth.uid())
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;