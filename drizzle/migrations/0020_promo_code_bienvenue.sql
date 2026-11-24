ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text, ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.guard_order_promo_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF (NEW.promo_code IS DISTINCT FROM OLD.promo_code OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
     AND coalesce(auth.role(),'') <> 'service_role'
     AND coalesce(current_setting('chezmima.order_adjustment', true),'') <> 'true' THEN
    RAISE EXCEPTION 'Promo fields cannot be changed';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_order_promo_fields ON public.orders;
CREATE TRIGGER guard_order_promo_fields BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_promo_fields();

CREATE OR REPLACE FUNCTION public.check_promo_code(_code text) RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF upper(trim(coalesce(_code,''))) <> 'BIENVENUE' THEN RAISE EXCEPTION 'Code promo invalide'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id = v_user AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Code réservé à la première commande';
  END IF;
  RETURN 10;
END; $$;
REVOKE ALL ON FUNCTION public.check_promo_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_promo_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_order_totals(_order_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE v_subtotal numeric(12,2);
BEGIN
  SELECT coalesce(round(sum(line_total), 2), 0) INTO v_subtotal
    FROM public.order_items WHERE order_id = _order_id AND item_status <> 'removed';
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET subtotal = v_subtotal,
    discount_amount = CASE WHEN promo_code = 'BIENVENUE' THEN round(v_subtotal * 0.10, 2) ELSE 0 END,
    total_price = v_subtotal - CASE WHEN promo_code = 'BIENVENUE' THEN round(v_subtotal * 0.10, 2) ELSE 0 END + delivery_fee
  WHERE id = _order_id;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;

DROP FUNCTION IF EXISTS public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer);

CREATE FUNCTION public.create_customer_order(_items jsonb, _delivery_mode text, _delivery_address_id uuid DEFAULT NULL::uuid, _delivery_zone_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone, _payment_method text DEFAULT 'cash'::text, _cash_bill_amount integer DEFAULT NULL::integer, _promo_code text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid(); v_order_id uuid; v_item_count integer; v_unique_item_count integer;
  v_subtotal numeric(12,2); v_delivery_fee numeric(12,2) := 0;
  v_address public.user_addresses%ROWTYPE; v_zone public.delivery_zones%ROWTYPE;
  v_store_lat numeric; v_store_lng numeric; v_distance numeric; v_snapshot jsonb; v_payment_method text;
  v_promo text; v_discount numeric(12,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM public.assert_order_ip_allowed();
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Invalid order items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_items) AS item(unavailable_policy text) WHERE item.unavailable_policy IS NOT NULL AND item.unavailable_policy NOT IN ('replace', 'remove_item')) THEN RAISE EXCEPTION 'Invalid per-article unavailable preference'; END IF;
  IF _delivery_mode NOT IN ('delivery', 'pickup') THEN RAISE EXCEPTION 'Invalid delivery mode'; END IF;
  IF length(coalesce(_notes, '')) > 1000 THEN RAISE EXCEPTION 'Order notes are too long'; END IF;
  IF _scheduled_for IS NOT NULL AND (_scheduled_for <= now() OR _scheduled_for > now() + interval '30 days') THEN RAISE EXCEPTION 'Invalid scheduled delivery time'; END IF;
  IF nullif(trim(coalesce(_promo_code, '')), '') IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('promo:' || v_user_id::text));
    PERFORM public.check_promo_code(_promo_code);
    v_promo := 'BIENVENUE';
  END IF;
  SELECT count(*), count(DISTINCT item.product_id) INTO v_item_count, v_unique_item_count FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric, unavailable_policy text);
  IF v_item_count = 0 OR v_item_count <> v_unique_item_count THEN RAISE EXCEPTION 'Invalid or duplicate order items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric, unavailable_policy text)
    WHERE item.product_id IS NULL OR item.quantity_value IS NULL OR item.quantity_value <= 0 OR item.quantity_value > 100) THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric, unavailable_policy text)
    LEFT JOIN public.products AS p ON p.id = item.product_id
    WHERE p.id IS NULL OR p.is_active IS DISTINCT FROM true OR p.price <= 0
      OR (p.unit_type = 'piece' AND item.quantity_value <> trunc(item.quantity_value))
      OR (p.category_id = '0e3b434d-9c58-4c08-b571-b40238a0c567'::uuid
          AND p.unit_type IN ('weight', 'kg')
          AND (item.quantity_value < 0.1 OR item.quantity_value > 0.5))) THEN RAISE EXCEPTION 'One or more products are unavailable or have invalid quantities'; END IF;
  SELECT round(sum(p.price * item.quantity_value), 2) INTO v_subtotal
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric, unavailable_policy text) JOIN public.products AS p ON p.id = item.product_id;
  IF v_promo = 'BIENVENUE' THEN v_discount := round(v_subtotal * 0.10, 2); END IF;
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
  IF _cash_bill_amount IS NOT NULL AND _cash_bill_amount < v_subtotal - v_discount + v_delivery_fee THEN RAISE EXCEPTION 'Cash amount is below the order total'; END IF;
  INSERT INTO public.orders (user_id, status, subtotal, delivery_fee, total_price, delivery_address_id, delivery_zone_id,
    delivery_address_snapshot, notes, delivery_mode, payment_method, payment_status, cash_bill_amount, scheduled_for, promo_code, discount_amount)
  VALUES (v_user_id, 'pending', v_subtotal, v_delivery_fee, v_subtotal - v_discount + v_delivery_fee,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE _delivery_address_id END,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE v_zone.id END, v_snapshot, nullif(_notes, ''), _delivery_mode,
    v_payment_method, 'pending', CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE _cash_bill_amount END, _scheduled_for, v_promo, v_discount)
  RETURNING id INTO v_order_id;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, quantity_value, unit_price, line_total, unavailable_policy)
  SELECT v_order_id, p.id, p.name, item.quantity_value::text || CASE WHEN p.unit_type = 'weight' THEN ' kg' ELSE ' x' END,
    item.quantity_value, p.price, round(p.price * item.quantity_value, 2), coalesce(item.unavailable_policy, 'replace')
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric, unavailable_policy text) JOIN public.products AS p ON p.id = item.product_id;
  RETURN v_order_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer, text) TO authenticated;