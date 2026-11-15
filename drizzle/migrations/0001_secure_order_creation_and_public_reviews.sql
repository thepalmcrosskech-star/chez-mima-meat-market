DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;

DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Anyone can read reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can read their own reviews" ON public.product_reviews;
CREATE POLICY "Users can read their own reviews" ON public.product_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE SELECT ON public.product_reviews FROM anon;

CREATE OR REPLACE FUNCTION public.get_public_product_ratings()
RETURNS TABLE (product_id uuid, rating integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pr.product_id, pr.rating
  FROM public.product_reviews AS pr;
$$;
REVOKE ALL ON FUNCTION public.get_public_product_ratings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_ratings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_product_reviews(_product_id uuid)
RETURNS TABLE (id uuid, product_id uuid, rating integer, comment text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pr.id, pr.product_id, pr.rating, pr.comment, pr.created_at
  FROM public.product_reviews AS pr
  WHERE pr.product_id = _product_id
  ORDER BY pr.created_at DESC NULLS LAST
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.get_public_product_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_reviews(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _items jsonb,
  _delivery_mode text,
  _delivery_address_id uuid DEFAULT NULL,
  _delivery_zone_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _scheduled_for timestamptz DEFAULT NULL,
  _payment_method text DEFAULT 'cash',
  _cash_bill_amount integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_item_count integer;
  v_unique_item_count integer;
  v_subtotal numeric(12,2);
  v_delivery_fee numeric(12,2) := 0;
  v_address public.user_addresses%ROWTYPE;
  v_zone public.delivery_zones%ROWTYPE;
  v_store_lat numeric;
  v_store_lng numeric;
  v_distance numeric;
  v_snapshot jsonb;
  v_payment_method text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Invalid order items';
  END IF;
  IF _delivery_mode NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid delivery mode';
  END IF;
  IF length(coalesce(_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Order notes are too long';
  END IF;
  IF _scheduled_for IS NOT NULL AND (_scheduled_for <= now() OR _scheduled_for > now() + interval '30 days') THEN
    RAISE EXCEPTION 'Invalid scheduled delivery time';
  END IF;

  SELECT count(*), count(DISTINCT item.product_id)
  INTO v_item_count, v_unique_item_count
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric);
  IF v_item_count = 0 OR v_item_count <> v_unique_item_count THEN
    RAISE EXCEPTION 'Invalid or duplicate order items';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric)
    WHERE item.product_id IS NULL OR item.quantity_value IS NULL OR item.quantity_value <= 0 OR item.quantity_value > 100
  ) THEN
    RAISE EXCEPTION 'Invalid item quantity';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric)
    LEFT JOIN public.products AS p ON p.id = item.product_id
    WHERE p.id IS NULL OR p.is_active IS DISTINCT FROM true OR p.price <= 0
  ) THEN
    RAISE EXCEPTION 'One or more products are unavailable';
  END IF;

  SELECT round(sum(p.price * item.quantity_value), 2)
  INTO v_subtotal
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric)
  JOIN public.products AS p ON p.id = item.product_id;

  IF _delivery_mode = 'pickup' THEN
    v_payment_method := 'on_site';
    v_snapshot := jsonb_build_object('pickup', true);
    IF _delivery_address_id IS NOT NULL OR _delivery_zone_id IS NOT NULL THEN
      RAISE EXCEPTION 'Pickup orders cannot include a delivery address';
    END IF;
  ELSE
    IF _payment_method <> 'cash' OR _delivery_address_id IS NULL THEN
      RAISE EXCEPTION 'Delivery requires a saved address and cash payment';
    END IF;
    IF _delivery_zone_id IS NULL THEN
      RAISE EXCEPTION 'Delivery zone is required';
    END IF;

    SELECT * INTO v_address FROM public.user_addresses
    WHERE id = _delivery_address_id AND user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Delivery address not found';
    END IF;

    SELECT coalesce((SELECT s.value #>> '{}' FROM public.app_settings AS s WHERE s.key = 'store_latitude'), '31.589020')::numeric,
           coalesce((SELECT s.value #>> '{}' FROM public.app_settings AS s WHERE s.key = 'store_longitude'), '-8.019172')::numeric
    INTO v_store_lat, v_store_lng;

    v_distance := 6371 * 2 * asin(sqrt(
      power(sin(radians(v_address.latitude - v_store_lat) / 2), 2) +
      cos(radians(v_store_lat)) * cos(radians(v_address.latitude)) *
      power(sin(radians(v_address.longitude - v_store_lng) / 2), 2)
    ));

    SELECT * INTO v_zone FROM public.delivery_zones AS z
    WHERE z.is_active = true AND z.radius_km IS NOT NULL
      AND v_distance >= coalesce(z.min_radius_km, 0)
      AND v_distance <= z.radius_km
    ORDER BY z.radius_km ASC
    LIMIT 1;
    IF NOT FOUND OR v_zone.id <> _delivery_zone_id THEN
      RAISE EXCEPTION 'Address is outside the selected delivery zone';
    END IF;

    v_delivery_fee := CASE
      WHEN v_zone.free_delivery_threshold IS NOT NULL AND v_subtotal >= v_zone.free_delivery_threshold THEN 0
      ELSE v_zone.delivery_fee
    END;
    v_payment_method := 'cash';
    v_snapshot := jsonb_build_object(
      'full_address', v_address.full_address,
      'latitude', v_address.latitude,
      'longitude', v_address.longitude,
      'label', v_address.label,
      'apartment', v_address.apartment,
      'instructions', v_address.instructions
    );
  END IF;

  IF v_payment_method = 'cash' AND _cash_bill_amount IS NOT NULL AND _cash_bill_amount < v_subtotal + v_delivery_fee THEN
    RAISE EXCEPTION 'Cash amount is below the order total';
  END IF;

  INSERT INTO public.orders (
    user_id, status, subtotal, delivery_fee, total_price, delivery_address_id,
    delivery_zone_id, delivery_address_snapshot, notes, delivery_mode,
    payment_method, payment_status, cash_bill_amount, scheduled_for
  ) VALUES (
    v_user_id, 'pending', v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE _delivery_address_id END,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE v_zone.id END,
    v_snapshot, nullif(_notes, ''), _delivery_mode, v_payment_method,
    CASE WHEN _delivery_mode = 'pickup' THEN 'pending_on_site' ELSE 'pending' END,
    CASE WHEN _delivery_mode = 'pickup' THEN NULL ELSE _cash_bill_amount END,
    _scheduled_for
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, quantity_value, unit_price, line_total)
  SELECT v_order_id, p.id, p.name,
    item.quantity_value::text || CASE WHEN p.unit_type = 'weight' THEN ' kg' ELSE ' x' END,
    item.quantity_value, p.price, round(p.price * item.quantity_value, 2)
  FROM jsonb_to_recordset(_items) AS item(product_id uuid, quantity_value numeric)
  JOIN public.products AS p ON p.id = item.product_id;

  RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, text, uuid, uuid, text, timestamptz, text, integer) TO authenticated;