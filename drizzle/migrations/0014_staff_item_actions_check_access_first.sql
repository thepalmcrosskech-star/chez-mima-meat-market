CREATE OR REPLACE FUNCTION public.staff_remove_order_item(_item_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item public.order_items%ROWTYPE; v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_item FROM public.order_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable'; END IF;
  v_order := public.staff_lock_adjustable_order(v_item.order_id);
  IF v_item.item_status = 'removed' THEN RETURN; END IF;
  UPDATE public.order_items SET item_status = 'removed' WHERE id = _item_id;
  PERFORM public.recalculate_order_totals(v_order.id);
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id AND item_status <> 'removed') THEN
    PERFORM set_config('chezmima.staff_order_transition', 'true', true);
    UPDATE public.orders SET status = 'cancelled' WHERE id = v_order.id;
    INSERT INTO public.notifications (user_id, order_id, title, message)
    VALUES (v_order.user_id, v_order.id, 'Commande annulée ❌', 'Aucun des articles commandés n’est disponible. Votre commande a été annulée.');
  ELSE
    INSERT INTO public.notifications (user_id, order_id, title, message)
    VALUES (v_order.user_id, v_order.id, 'Article indisponible', v_item.product_name || ' n’est pas disponible et a été retiré de votre commande. Le total a été ajusté.');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_replace_order_item(_item_id uuid, _product_id uuid, _quantity_value numeric, _client_agreed boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item public.order_items%ROWTYPE; v_order public.orders%ROWTYPE; v_product public.products%ROWTYPE; v_new_total numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_item FROM public.order_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable'; END IF;
  v_order := public.staff_lock_adjustable_order(v_item.order_id);
  IF v_item.item_status = 'removed' THEN RAISE EXCEPTION 'Cet article a déjà été retiré'; END IF;
  SELECT * INTO v_product FROM public.products WHERE id = _product_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit de remplacement indisponible'; END IF;
  IF _quantity_value IS NULL OR _quantity_value <= 0 OR _quantity_value > 100
    OR (v_product.unit_type = 'piece' AND _quantity_value <> trunc(_quantity_value)) THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order.id AND product_id = _product_id AND id <> _item_id AND item_status <> 'removed') THEN
    RAISE EXCEPTION 'Ce produit est déjà dans la commande';
  END IF;
  v_new_total := round(v_product.price * _quantity_value, 2);
  IF v_new_total <> round(v_item.line_total, 2) AND NOT coalesce(_client_agreed, false) THEN
    RAISE EXCEPTION 'Le prix change : appelez le client et obtenez son accord avant de remplacer';
  END IF;
  UPDATE public.order_items SET
    original_product_name = coalesce(v_item.original_product_name, v_item.product_name),
    product_id = v_product.id, product_name = v_product.name, quantity_value = _quantity_value,
    quantity = _quantity_value::text || CASE WHEN v_product.unit_type = 'weight' THEN ' kg' ELSE ' x' END,
    item_status = 'replaced'
  WHERE id = _item_id;
  PERFORM public.recalculate_order_totals(v_order.id);
  INSERT INTO public.notifications (user_id, order_id, title, message)
  VALUES (v_order.user_id, v_order.id, 'Article remplacé', coalesce(v_item.original_product_name, v_item.product_name) || ' n’était pas disponible : remplacé par ' || v_product.name || '.');
END;
$function$;