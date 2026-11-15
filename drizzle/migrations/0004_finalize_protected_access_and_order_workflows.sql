CREATE OR REPLACE FUNCTION public.has_admin_role(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN coalesce(auth.role(), '') = 'service_role' THEN EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = $1 AND ur.role = 'admin')
    WHEN auth.uid() IS NULL OR auth.uid() <> $1 THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = $1 AND ur.role = 'admin')
  END;
$$;
REVOKE ALL ON FUNCTION public.has_admin_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_role(uuid) TO anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR (v_user_id IS NOT NULL AND public.has_admin_role(v_user_id)) THEN RETURN NEW; END IF;
  IF v_user_id IS NULL OR OLD.id <> v_user_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.email IS DISTINCT FROM OLD.email OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Profile changes are not authorized'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_profile_updates ON public.profiles;
CREATE TRIGGER trg_guard_profile_updates BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_updates();

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role NOT IN ('user', 'driver', 'admin') THEN RAISE EXCEPTION 'Invalid user role'; END IF;
  DELETE FROM public.user_roles AS ur WHERE ur.user_id = NEW.id AND ur.role <> NEW.role;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, NEW.role) ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_profile_role_insert ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_user_roles();
DROP TRIGGER IF EXISTS trg_sync_profile_role_update ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_update AFTER UPDATE OF role ON public.profiles FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role) EXECUTE FUNCTION public.sync_profile_role_to_user_roles();

CREATE OR REPLACE FUNCTION public.guard_order_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_admin boolean := false; v_driver_transition boolean := current_setting('chezmima.driver_order_transition', true) = 'true';
BEGIN
  IF v_user_id IS NOT NULL THEN SELECT public.has_admin_role(v_user_id) INTO v_admin; END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR v_admin THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.subtotal IS DISTINCT FROM OLD.subtotal OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.total_price IS DISTINCT FROM OLD.total_price OR NEW.delivery_address_id IS DISTINCT FROM OLD.delivery_address_id
    OR NEW.delivery_zone_id IS DISTINCT FROM OLD.delivery_zone_id OR NEW.delivery_address_snapshot IS DISTINCT FROM OLD.delivery_address_snapshot
    OR NEW.notes IS DISTINCT FROM OLD.notes OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.cash_bill_amount IS DISTINCT FROM OLD.cash_bill_amount
    OR NEW.cmi_order_id IS DISTINCT FROM OLD.cmi_order_id OR NEW.cmi_transaction_id IS DISTINCT FROM OLD.cmi_transaction_id
    OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR NEW.assignment_attempts IS DISTINCT FROM OLD.assignment_attempts THEN
    RAISE EXCEPTION 'Order details can only be changed by an administrator';
  END IF;
  IF v_driver_transition AND EXISTS (SELECT 1 FROM public.driver_profiles dp WHERE dp.id = NEW.driver_id AND dp.user_id = v_user_id)
    AND ((OLD.status = 'ready' AND NEW.status = 'delivering' AND NEW.assignment_status = 'assigned')
      OR (OLD.status = 'delivering' AND NEW.status = 'delivered' AND OLD.driver_id = NEW.driver_id)) THEN RETURN NEW; END IF;
  IF v_user_id = OLD.user_id AND NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed')
    AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id AND NEW.assignment_status IS NOT DISTINCT FROM OLD.assignment_status THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Order update is not authorized';
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_order_updates ON public.orders;
CREATE TRIGGER trg_guard_order_updates BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_updates();

CREATE OR REPLACE FUNCTION public.guard_driver_profile_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_system_transition boolean := current_setting('chezmima.driver_profile_transition', true) = 'true';
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR (v_user_id IS NOT NULL AND public.has_admin_role(v_user_id)) THEN RETURN NEW; END IF;
  IF v_user_id IS NULL OR OLD.user_id <> v_user_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type OR NEW.license_plate IS DISTINCT FROM OLD.license_plate
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Driver profile update is not authorized'; END IF;
  IF v_system_transition THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('busy', 'available') THEN RAISE EXCEPTION 'Invalid driver workflow status'; END IF;
    IF NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries AND NEW.total_deliveries <> coalesce(OLD.total_deliveries, 0) + 1 THEN RAISE EXCEPTION 'Invalid delivery count update'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries THEN RAISE EXCEPTION 'Driver ratings and totals are managed by the system'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status NOT IN ('available', 'offline') OR EXISTS (SELECT 1 FROM public.orders AS o WHERE o.driver_id = OLD.id AND o.status = 'delivering')) THEN
    RAISE EXCEPTION 'Driver availability cannot be changed during an active delivery';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_driver_profile_updates ON public.driver_profiles;
CREATE TRIGGER trg_guard_driver_profile_updates BEFORE UPDATE ON public.driver_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_driver_profile_updates();

CREATE OR REPLACE FUNCTION public.guard_delivery_assignment_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_admin boolean := false; v_driver_id uuid;
BEGIN
  IF v_user_id IS NOT NULL THEN SELECT public.has_admin_role(v_user_id) INTO v_admin; END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR v_admin THEN RETURN NEW; END IF;
  SELECT id INTO v_driver_id FROM public.driver_profiles WHERE user_id = v_user_id;
  IF v_driver_id IS NULL OR OLD.driver_id <> v_driver_id OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.distance_to_shop IS DISTINCT FROM OLD.distance_to_shop
    OR NEW.estimated_duration IS DISTINCT FROM OLD.estimated_duration THEN RAISE EXCEPTION 'Assignment update is not authorized'; END IF;
  IF current_setting('chezmima.assignment_transition', true) = 'true'
    AND ((NEW.status = OLD.status AND NEW.responded_at IS NOT DISTINCT FROM OLD.responded_at AND NEW.picked_up_at IS NOT DISTINCT FROM OLD.picked_up_at AND NEW.delivered_at IS NOT DISTINCT FROM OLD.delivered_at)
      OR (OLD.status = 'pending' AND NEW.status IN ('accepted', 'rejected', 'expired') AND NEW.responded_at IS NOT NULL AND NEW.picked_up_at IS NOT DISTINCT FROM OLD.picked_up_at AND NEW.delivered_at IS NOT DISTINCT FROM OLD.delivered_at)
      OR (OLD.status = 'accepted' AND NEW.status = OLD.status AND NEW.responded_at IS NOT DISTINCT FROM OLD.responded_at AND NEW.picked_up_at IS NOT NULL AND NEW.delivered_at IS NOT DISTINCT FROM OLD.delivered_at)
      OR (OLD.status = 'accepted' AND NEW.status = OLD.status AND NEW.responded_at IS NOT DISTINCT FROM OLD.responded_at AND NEW.picked_up_at IS NOT DISTINCT FROM OLD.picked_up_at AND NEW.delivered_at IS NOT NULL)) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Assignment workflow updates must use protected delivery actions';
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_delivery_assignment_updates ON public.delivery_assignments;
CREATE TRIGGER trg_guard_delivery_assignment_updates BEFORE UPDATE ON public.delivery_assignments FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_assignment_updates();
DROP POLICY IF EXISTS "Drivers can update own assignments" ON public.delivery_assignments;

CREATE OR REPLACE FUNCTION public.respond_to_driver_assignment(_order_id uuid, _response text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_driver_id uuid; v_assignment public.delivery_assignments%ROWTYPE; v_order public.orders%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _response NOT IN ('accepted', 'rejected', 'expired') THEN RAISE EXCEPTION 'Invalid response'; END IF;
  SELECT dp.id INTO v_driver_id FROM public.driver_profiles AS dp WHERE dp.user_id = v_user_id;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Driver profile not found'; END IF;
  SELECT * INTO v_assignment FROM public.delivery_assignments AS da WHERE da.order_id = _order_id AND da.driver_id = v_driver_id AND da.status = 'pending' ORDER BY da.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending assignment not found'; END IF;
  IF _response = 'expired' AND v_assignment.expires_at > now() THEN RAISE EXCEPTION 'Assignment has not expired'; END IF;
  IF _response = 'accepted' AND v_assignment.expires_at IS NOT NULL AND v_assignment.expires_at <= now() THEN RAISE EXCEPTION 'Assignment has expired'; END IF;
  SELECT * INTO v_order FROM public.orders AS o WHERE o.id = _order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'ready' OR v_order.delivery_mode = 'pickup' THEN RAISE EXCEPTION 'Order is not ready for driver delivery'; END IF;
  PERFORM set_config('chezmima.assignment_transition', 'true', true);
  UPDATE public.delivery_assignments SET status = _response, responded_at = now() WHERE id = v_assignment.id;
  IF _response <> 'accepted' THEN RETURN _response; END IF;
  PERFORM set_config('chezmima.driver_profile_transition', 'true', true);
  PERFORM set_config('chezmima.driver_order_transition', 'true', true);
  UPDATE public.orders SET status = 'delivering', driver_id = v_driver_id, assignment_status = 'assigned' WHERE id = _order_id;
  UPDATE public.driver_profiles SET status = 'busy' WHERE id = v_driver_id;
  INSERT INTO public.notifications (user_id, order_id, title, message, is_read) VALUES (v_order.user_id, _order_id, 'Livreur en route !', 'Votre livreur est en route vers vous. Suivez votre commande en temps réel.', false);
  RETURN 'accepted';
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_driver_assignment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_driver_assignment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_driver_order_picked_up(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_driver_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO v_driver_id FROM public.driver_profiles WHERE user_id = v_user_id;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Driver profile not found'; END IF;
  PERFORM set_config('chezmima.assignment_transition', 'true', true);
  UPDATE public.delivery_assignments AS da SET picked_up_at = coalesce(da.picked_up_at, now()) FROM public.orders AS o
  WHERE da.order_id = _order_id AND da.driver_id = v_driver_id AND da.status = 'accepted' AND da.delivered_at IS NULL AND da.order_id = o.id AND o.driver_id = v_driver_id AND o.status = 'delivering';
  IF NOT FOUND THEN RAISE EXCEPTION 'Active delivery not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_driver_order_picked_up(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_driver_order_picked_up(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_driver_delivery(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_driver_id uuid; v_customer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT dp.id INTO v_driver_id FROM public.driver_profiles AS dp WHERE dp.user_id = v_user_id;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Driver profile not found'; END IF;
  SELECT o.user_id INTO v_customer_id FROM public.orders AS o WHERE o.id = _order_id AND o.driver_id = v_driver_id AND o.status = 'delivering' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active delivery not found'; END IF;
  PERFORM set_config('chezmima.assignment_transition', 'true', true);
  UPDATE public.delivery_assignments SET delivered_at = now() WHERE order_id = _order_id AND driver_id = v_driver_id AND status = 'accepted' AND delivered_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active assignment not found'; END IF;
  PERFORM set_config('chezmima.driver_profile_transition', 'true', true);
  PERFORM set_config('chezmima.driver_order_transition', 'true', true);
  UPDATE public.orders SET status = 'delivered' WHERE id = _order_id;
  UPDATE public.driver_profiles SET status = 'available', total_deliveries = coalesce(total_deliveries, 0) + 1 WHERE id = v_driver_id;
  INSERT INTO public.notifications (user_id, order_id, title, message, is_read) VALUES (v_customer_id, _order_id, 'Commande livrée', 'Votre commande a été livrée. Bon appétit !', false);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_driver_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_driver_delivery(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_driver_rating(_order_id uuid, _driver_id uuid, _rating integer, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid := auth.uid(); v_order_driver uuid; v_average numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'Rating must be between 1 and 5'; END IF;
  IF _comment IS NOT NULL AND length(_comment) > 1000 THEN RAISE EXCEPTION 'Comment is too long'; END IF;
  SELECT o.driver_id INTO v_order_driver FROM public.orders AS o WHERE o.id = _order_id AND o.user_id = v_user_id AND o.status = 'delivered';
  IF NOT FOUND OR v_order_driver IS DISTINCT FROM _driver_id THEN RAISE EXCEPTION 'Order is not eligible for rating'; END IF;
  INSERT INTO public.driver_ratings (order_id, driver_id, user_id, rating, comment) VALUES (_order_id, _driver_id, v_user_id, _rating, nullif(trim(_comment), ''));
  SELECT avg(dr.rating)::numeric INTO v_average FROM public.driver_ratings AS dr WHERE dr.driver_id = _driver_id;
  PERFORM set_config('chezmima.driver_profile_transition', 'true', true);
  UPDATE public.driver_profiles SET rating = v_average WHERE id = _driver_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_driver_rating(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_driver_rating(uuid, uuid, integer, text) TO authenticated;
DROP POLICY IF EXISTS "Users can create ratings for their orders" ON public.driver_ratings;

DROP POLICY IF EXISTS "Authenticated users can read reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can read their own reviews" ON public.product_reviews;
CREATE POLICY "Users can read their own reviews" ON public.product_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE SELECT ON public.product_reviews FROM anon;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
CREATE POLICY "Anyone can read active products" ON public.products FOR SELECT TO public USING (is_active = true OR public.has_admin_role(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM authenticated;
GRANT UPDATE (status) ON TABLE public.orders TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.delivery_assignments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.driver_ratings FROM authenticated;
GRANT UPDATE (status, responded_at, picked_up_at, delivered_at) ON TABLE public.delivery_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.driver_locations TO authenticated;
GRANT UPDATE (status, latitude, longitude, location_updated_at) ON TABLE public.driver_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _items jsonb, _delivery_mode text, _delivery_address_id uuid DEFAULT NULL,
  _delivery_zone_id uuid DEFAULT NULL, _notes text DEFAULT NULL,
  _scheduled_for timestamptz DEFAULT NULL, _payment_method text DEFAULT 'cash',
  _cash_bill_amount integer DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid(); v_order_id uuid; v_item_count integer; v_unique_item_count integer;
  v_subtotal numeric(12,2); v_delivery_fee numeric(12,2) := 0;
  v_address public.user_addresses%ROWTYPE; v_zone public.delivery_zones%ROWTYPE;
  v_store_lat numeric; v_store_lng numeric; v_distance numeric; v_snapshot jsonb; v_payment_method text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Invalid order items'; END IF;
  IF _delivery_mode NOT IN ('delivery', 'pickup') THEN RAISE EXCEPTION 'Invalid delivery mode'; END IF;
  IF length(coalesce(_notes, '')) > 1000 THEN RAISE EXCEPTION 'Order notes are too long'; END IF;
  IF _scheduled_for IS NOT NULL AND (_scheduled_for <= now() OR _scheduled_for > now() + interval '30 days') THEN RAISE EXCEPTION 'Invalid scheduled delivery time'; END IF;
  SELECT count(*), count(DISTINCT item.product_id) INTO v_item_count, v_unique_item_count FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric);
  IF v_item_count = 0 OR v_item_count <> v_unique_item_count THEN RAISE EXCEPTION 'Invalid or duplicate order items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric)
    WHERE item.product_id IS NULL OR item.quantity_value IS NULL OR item.quantity_value <= 0 OR item.quantity_value > 100) THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric)
    LEFT JOIN public.products AS p ON p.id = item.product_id
    WHERE p.id IS NULL OR p.is_active IS DISTINCT FROM true OR p.price <= 0
      OR (p.unit_type = 'piece' AND item.quantity_value <> trunc(item.quantity_value))) THEN RAISE EXCEPTION 'One or more products are unavailable or have invalid quantities'; END IF;
  SELECT round(sum(p.price * item.quantity_value), 2) INTO v_subtotal
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric) JOIN public.products AS p ON p.id = item.product_id;
  IF _delivery_mode = 'pickup' THEN
    v_payment_method := 'on_site'; v_snapshot := jsonb_build_object('pickup', true);
    IF _delivery_address_id IS NOT NULL OR _delivery_zone_id IS NOT NULL THEN RAISE EXCEPTION 'Pickup orders cannot include a delivery address'; END IF;
  ELSE
    IF _payment_method <> 'cash' OR _delivery_address_id IS NULL OR _delivery_zone_id IS NULL THEN RAISE EXCEPTION 'Delivery requires a saved address, a delivery zone, and cash payment'; END IF;
    SELECT * INTO v_address FROM public.user_addresses WHERE id = _delivery_address_id AND user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Delivery address not found'; END IF;
    SELECT coalesce((SELECT s.value #>> '{}' FROM public.app_settings AS s WHERE s.key = 'store_latitude'), '31.589020')::numeric,
           coalesce((SELECT s.value #>> '{}' FROM public.app_settings AS s WHERE s.key = 'store_longitude'), '-8.019172')::numeric INTO v_store_lat, v_store_lng;
    v_distance := 6371 * 2 * asin(sqrt(power(sin(radians(v_address.latitude - v_store_lat) / 2), 2)
      + cos(radians(v_store_lat)) * cos(radians(v_address.latitude)) * power(sin(radians(v_address.longitude - v_store_lng) / 2), 2)));
    SELECT * INTO v_zone FROM public.delivery_zones AS z WHERE z.is_active = true AND z.radius_km IS NOT NULL
      AND v_distance >= coalesce(z.min_radius_km, 0) AND v_distance <= z.radius_km ORDER BY z.radius_km ASC LIMIT 1;
    IF NOT FOUND OR v_zone.id <> _delivery_zone_id THEN RAISE EXCEPTION 'Address is outside the selected delivery zone'; END IF;
    v_delivery_fee := CASE WHEN v_zone.free_delivery_threshold IS NOT NULL AND v_subtotal >= v_zone.free_delivery_threshold THEN 0 ELSE v_zone.delivery_fee END;
    v_payment_method := 'cash';
    v_snapshot := jsonb_build_object('full_address', v_address.full_address, 'latitude', v_address.latitude, 'longitude', v_address.longitude,
      'label', v_address.label, 'apartment', v_address.apartment, 'instructions', v_address.instructions);
  END IF;
  IF _cash_bill_amount IS NOT NULL AND _cash_bill_amount < v_subtotal + v_delivery_fee THEN RAISE EXCEPTION 'Cash amount is below the order total'; END IF;
  INSERT INTO public.orders (user_id, status, subtotal, delivery_fee, total_price, delivery_address_id, delivery_zone_id,
    delivery_address_snapshot, notes, delivery_mode, payment_method, payment_status, cash_bill_amount, scheduled_for)
  VALUES (v_user_id, 'pending', v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE _delivery_address_id END,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE v_zone.id END, v_snapshot, nullif(_notes, ''), _delivery_mode,
    v_payment_method, 'pending', CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE _cash_bill_amount END, _scheduled_for)
  RETURNING id INTO v_order_id;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, quantity_value, unit_price, line_total)
  SELECT v_order_id, p.id, p.name, item.quantity_value::text || CASE WHEN p.unit_type = 'weight' THEN ' kg' ELSE ' x' END,
    item.quantity_value, p.price, round(p.price * item.quantity_value, 2)
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric) JOIN public.products AS p ON p.id = item.product_id;
  RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer) TO authenticated;