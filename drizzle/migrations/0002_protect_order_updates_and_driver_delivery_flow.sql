CREATE OR REPLACE FUNCTION public.guard_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_admin boolean := false;
  v_driver_transition boolean := current_setting('chezmima.driver_order_transition', true) = 'true';
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT public.has_admin_role(v_user_id) INTO v_admin;
  END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR v_admin THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.total_price IS DISTINCT FROM OLD.total_price
    OR NEW.delivery_address_id IS DISTINCT FROM OLD.delivery_address_id
    OR NEW.delivery_zone_id IS DISTINCT FROM OLD.delivery_zone_id
    OR NEW.delivery_address_snapshot IS DISTINCT FROM OLD.delivery_address_snapshot
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.cash_bill_amount IS DISTINCT FROM OLD.cash_bill_amount
    OR NEW.cmi_order_id IS DISTINCT FROM OLD.cmi_order_id
    OR NEW.cmi_transaction_id IS DISTINCT FROM OLD.cmi_transaction_id
    OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
    OR NEW.assignment_attempts IS DISTINCT FROM OLD.assignment_attempts THEN
    RAISE EXCEPTION 'Order details can only be changed by an administrator';
  END IF;

  IF v_driver_transition AND EXISTS (
    SELECT 1 FROM public.driver_profiles dp
    WHERE dp.id = NEW.driver_id AND dp.user_id = v_user_id
  ) AND NEW.status IN ('delivering', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF v_user_id = OLD.user_id
    AND NEW.status = 'cancelled'
    AND OLD.status IN ('pending', 'confirmed')
    AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id
    AND NEW.assignment_status IS NOT DISTINCT FROM OLD.assignment_status THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Order update is not authorized';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_updates ON public.orders;
CREATE TRIGGER trg_guard_order_updates
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_updates();

DROP POLICY IF EXISTS "Drivers can update orders assigned to them" ON public.orders;

CREATE OR REPLACE FUNCTION public.respond_to_driver_assignment(_order_id uuid, _response text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_driver_id uuid;
  v_assignment public.delivery_assignments%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _response NOT IN ('accepted', 'rejected', 'expired') THEN RAISE EXCEPTION 'Invalid response'; END IF;

  SELECT dp.id INTO v_driver_id FROM public.driver_profiles AS dp WHERE dp.user_id = v_user_id;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Driver profile not found'; END IF;

  SELECT * INTO v_assignment FROM public.delivery_assignments AS da
  WHERE da.order_id = _order_id AND da.driver_id = v_driver_id AND da.status = 'pending'
  ORDER BY da.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending assignment not found'; END IF;
  IF _response = 'expired' AND v_assignment.expires_at > now() THEN RAISE EXCEPTION 'Assignment has not expired'; END IF;
  IF _response = 'accepted' AND (v_assignment.expires_at IS NOT NULL AND v_assignment.expires_at <= now()) THEN RAISE EXCEPTION 'Assignment has expired'; END IF;

  SELECT * INTO v_order FROM public.orders AS o WHERE o.id = _order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'ready' OR v_order.delivery_mode = 'pickup' THEN RAISE EXCEPTION 'Order is not ready for driver delivery'; END IF;

  UPDATE public.delivery_assignments SET status = _response, responded_at = now() WHERE id = v_assignment.id;
  IF _response <> 'accepted' THEN RETURN _response; END IF;

  PERFORM set_config('chezmima.driver_order_transition', 'true', true);
  UPDATE public.orders SET status = 'delivering', driver_id = v_driver_id, assignment_status = 'assigned' WHERE id = _order_id;
  UPDATE public.driver_profiles SET status = 'busy' WHERE id = v_driver_id;
  INSERT INTO public.notifications (user_id, order_id, title, message, is_read)
  VALUES (v_order.user_id, _order_id, 'Livreur en route !', 'Votre livreur est en route vers vous. Suivez votre commande en temps réel.', false);
  RETURN 'accepted';
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_driver_assignment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_driver_assignment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_driver_delivery(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_driver_id uuid;
  v_customer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT dp.id INTO v_driver_id FROM public.driver_profiles AS dp WHERE dp.user_id = v_user_id;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Driver profile not found'; END IF;

  SELECT o.user_id INTO v_customer_id FROM public.orders AS o
  WHERE o.id = _order_id AND o.driver_id = v_driver_id AND o.status = 'delivering'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active delivery not found'; END IF;

  UPDATE public.delivery_assignments SET delivered_at = now()
  WHERE order_id = _order_id AND driver_id = v_driver_id AND status = 'accepted' AND delivered_at IS NULL;
  PERFORM set_config('chezmima.driver_order_transition', 'true', true);
  UPDATE public.orders SET status = 'delivered' WHERE id = _order_id;
  UPDATE public.driver_profiles SET status = 'available' WHERE id = v_driver_id;
  INSERT INTO public.notifications (user_id, order_id, title, message, is_read)
  VALUES (v_customer_id, _order_id, 'Commande livrée', 'Votre commande a été livrée. Bon appétit !', false);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_driver_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_driver_delivery(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_driver_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR (v_user_id IS NOT NULL AND public.has_admin_role(v_user_id)) THEN
    RETURN NEW;
  END IF;
  IF v_user_id IS NULL OR OLD.user_id <> v_user_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type
    OR NEW.license_plate IS DISTINCT FROM OLD.license_plate
    OR NEW.rating IS DISTINCT FROM OLD.rating
    OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Driver profile update is not authorized';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('available', 'offline') OR EXISTS (
      SELECT 1 FROM public.orders AS o WHERE o.driver_id = OLD.id AND o.status = 'delivering'
    ) THEN
      RAISE EXCEPTION 'Driver availability cannot be changed during an active delivery';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_profile_updates ON public.driver_profiles;
CREATE TRIGGER trg_guard_driver_profile_updates
BEFORE UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_driver_profile_updates();