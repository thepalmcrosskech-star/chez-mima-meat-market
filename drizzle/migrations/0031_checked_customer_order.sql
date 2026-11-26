CREATE OR REPLACE FUNCTION public.create_customer_order_checked(
  _expected_prices jsonb, _items jsonb, _delivery_mode text, _delivery_address_id uuid DEFAULT NULL, _delivery_zone_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL, _scheduled_for timestamptz DEFAULT NULL, _payment_method text DEFAULT 'cash', _cash_bill_amount integer DEFAULT NULL,
  _promo_code text DEFAULT NULL, _loyalty_points integer DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(_expected_prices) <> 'array' OR jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_expected_prices) <> jsonb_array_length(_items) THEN RAISE EXCEPTION 'CATALOGUE_CHANGED'; END IF;
  -- Lock referenced products so prices cannot change between this check and order creation.
  PERFORM 1 FROM public.products p WHERE p.id IN (SELECT (e->>'product_id')::uuid FROM jsonb_array_elements(_expected_prices) e) FOR SHARE;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_items) AS item(product_id uuid)
    LEFT JOIN jsonb_to_recordset(_expected_prices) AS ex(product_id uuid, price numeric) ON ex.product_id = item.product_id
    LEFT JOIN public.products p ON p.id = item.product_id
    WHERE ex.product_id IS NULL OR p.id IS NULL OR p.is_active IS DISTINCT FROM true OR p.price IS DISTINCT FROM ex.price
  ) THEN RAISE EXCEPTION 'CATALOGUE_CHANGED'; END IF;
  RETURN public.create_customer_order(_items, _delivery_mode, _delivery_address_id, _delivery_zone_id, _notes, _scheduled_for,
    _payment_method, _cash_bill_amount, _promo_code, _loyalty_points);
END $$;
REVOKE ALL ON FUNCTION public.create_customer_order_checked(jsonb, jsonb, text, uuid, uuid, text, timestamptz, text, integer, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_order_checked(jsonb, jsonb, text, uuid, uuid, text, timestamptz, text, integer, text, integer) TO authenticated;