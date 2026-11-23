ALTER TABLE public.orders ALTER COLUMN unavailable_policy SET DEFAULT 'replace';
ALTER TABLE public.order_items ADD COLUMN ordered_quantity_value numeric;

CREATE OR REPLACE FUNCTION public.set_order_unavailable_policy(_order_id uuid, _policy text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _policy NOT IN ('replace','remove_item') THEN RAISE EXCEPTION 'Consigne invalide'; END IF;
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET unavailable_policy = _policy
   WHERE id = _order_id AND user_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable ou déjà prise en charge'; END IF;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_set_item_weight(_item_id uuid, _weight_kg numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item public.order_items%ROWTYPE; v_order public.orders%ROWTYPE; v_ordered numeric; v_tolerance constant numeric := 0.10;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_item FROM public.order_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable'; END IF;
  v_order := public.staff_lock_adjustable_order(v_item.order_id);
  IF v_item.item_status = 'removed' THEN RAISE EXCEPTION 'Cet article a déjà été retiré'; END IF;
  IF v_item.quantity NOT LIKE '%kg' THEN RAISE EXCEPTION 'Seuls les articles au poids peuvent être pesés'; END IF;
  v_ordered := coalesce(v_item.ordered_quantity_value, v_item.quantity_value);
  IF _weight_kg IS NULL OR _weight_kg <= 0 THEN RAISE EXCEPTION 'Poids invalide'; END IF;
  IF abs(_weight_kg - v_ordered) > v_ordered * v_tolerance + 0.0001 THEN
    RAISE EXCEPTION 'Écart trop important : entre % et % kg acceptés. Ajustez la pièce.',
      round(v_ordered * (1 - v_tolerance), 3), round(v_ordered * (1 + v_tolerance), 3);
  END IF;
  UPDATE public.order_items SET
    ordered_quantity_value = v_ordered,
    quantity_value = round(_weight_kg, 3),
    quantity = round(_weight_kg, 3)::text || ' kg',
    line_total = round(unit_price * round(_weight_kg, 3), 2)
  WHERE id = _item_id;
  PERFORM public.recalculate_order_totals(v_order.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_set_item_weight(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_item_weight(uuid, numeric) TO authenticated;