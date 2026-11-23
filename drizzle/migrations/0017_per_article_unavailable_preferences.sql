ALTER TABLE public.order_items ADD COLUMN unavailable_policy text CHECK (unavailable_policy IN ('replace', 'remove_item'));
COMMENT ON COLUMN public.order_items.unavailable_policy IS 'Customer choice per article; NULL preserves the legacy order-wide preference.';
COMMENT ON COLUMN public.orders.unavailable_policy IS 'DEPRECATED for new clients: use order_items.unavailable_policy; retained for legacy orders and clients.';
DO $migration$
DECLARE definition text; original text;
BEGIN
 SELECT pg_get_functiondef('public.create_customer_order(jsonb,text,uuid,uuid,text,timestamptz,text,integer)'::regprocedure) INTO original;
 definition := replace(original,
 '  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, quantity_value, unit_price, line_total)',
 '  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, quantity_value, unit_price, line_total, unavailable_policy)');
 definition := replace(definition,
 '    item.quantity_value, p.price, round(p.price * item.quantity_value, 2)',
 '    item.quantity_value, p.price, round(p.price * item.quantity_value, 2), coalesce(item.unavailable_policy, ''replace'')');
 definition := replace(definition, 'AS item(product_id uuid, quantity_value numeric)', 'AS item(product_id uuid, quantity_value numeric, unavailable_policy text)');
 definition := replace(definition, '  IF _delivery_mode NOT IN',
 '  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_items) AS item(unavailable_policy text) WHERE item.unavailable_policy IS NOT NULL AND item.unavailable_policy NOT IN (''replace'', ''remove_item'')) THEN RAISE EXCEPTION ''Invalid per-article unavailable preference''; END IF;
  IF _delivery_mode NOT IN');
 IF definition = original OR position('Invalid per-article unavailable preference' in definition) = 0 OR position('line_total, unavailable_policy)' in definition) = 0 OR position('coalesce(item.unavailable_policy' in definition) = 0 THEN RAISE EXCEPTION 'Unexpected order RPC definition'; END IF;
 EXECUTE definition;
 SELECT pg_get_functiondef('public.staff_replace_order_item(uuid,uuid,numeric,boolean)'::regprocedure) INTO original;
 definition := replace(original,
 '  IF v_item.item_status = ''removed'' THEN',
 '  IF v_item.unavailable_policy = ''remove_item'' THEN RAISE EXCEPTION ''Le client a demandé de retirer cet article, pas de le remplacer''; END IF;
  IF v_item.item_status = ''removed'' THEN');
 IF definition = original THEN RAISE EXCEPTION 'Unexpected replacement RPC definition'; END IF;
 EXECUTE definition;
END;
$migration$;
REVOKE ALL ON FUNCTION public.create_customer_order(jsonb,text,uuid,uuid,text,timestamptz,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb,text,uuid,uuid,text,timestamptz,text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.staff_replace_order_item(uuid,uuid,numeric,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_replace_order_item(uuid,uuid,numeric,boolean) TO authenticated;