ALTER TABLE public.orders
  ADD COLUMN unavailable_policy text NOT NULL DEFAULT 'call' CHECK (unavailable_policy IN ('call','replace','remove_item')),
  ADD COLUMN availability_checked_at timestamptz,
  ADD COLUMN availability_checked_by uuid,
  ADD COLUMN payment_confirmed_at timestamptz,
  ADD COLUMN payment_confirmed_by uuid;

ALTER TABLE public.order_items
  ADD COLUMN item_status text NOT NULL DEFAULT 'ok' CHECK (item_status IN ('ok','replaced','removed')),
  ADD COLUMN original_product_name text;

CREATE OR REPLACE FUNCTION public.guard_order_updates()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_admin boolean := false;
  v_employee boolean := false;
  v_driver_transition boolean := current_setting('chezmima.driver_order_transition', true) = 'true';
  v_staff_transition boolean := current_setting('chezmima.staff_order_transition', true) = 'true';
  v_adjustment boolean := current_setting('chezmima.order_adjustment', true) = 'true';
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT public.has_admin_role(v_user_id) INTO v_admin;
    SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_user_id AND ur.role = 'employee') INTO v_employee;
  END IF;
  IF coalesce(auth.role(), '') = 'service_role' OR v_admin OR v_adjustment THEN RETURN NEW; END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR NEW.total_price IS DISTINCT FROM OLD.total_price
    OR NEW.delivery_address_id IS DISTINCT FROM OLD.delivery_address_id
    OR NEW.delivery_zone_id IS DISTINCT FROM OLD.delivery_zone_id
    OR NEW.delivery_address_snapshot IS DISTINCT FROM OLD.delivery_address_snapshot
    OR NEW.notes IS DISTINCT FROM OLD.notes OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.cash_bill_amount IS DISTINCT FROM OLD.cash_bill_amount OR NEW.cmi_order_id IS DISTINCT FROM OLD.cmi_order_id
    OR NEW.cmi_transaction_id IS DISTINCT FROM OLD.cmi_transaction_id OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
    OR NEW.assignment_attempts IS DISTINCT FROM OLD.assignment_attempts
    OR NEW.unavailable_policy IS DISTINCT FROM OLD.unavailable_policy
    OR NEW.payment_confirmed_at IS DISTINCT FROM OLD.payment_confirmed_at
    OR NEW.availability_checked_at IS DISTINCT FROM OLD.availability_checked_at THEN
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
$function$;

-- Customer chooses the order-wide policy on their own pending order.
CREATE OR REPLACE FUNCTION public.set_order_unavailable_policy(_order_id uuid, _policy text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _policy NOT IN ('call','replace','remove_item') THEN RAISE EXCEPTION 'Consigne invalide'; END IF;
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET unavailable_policy = _policy
   WHERE id = _order_id AND user_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable ou déjà prise en charge'; END IF;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_order_totals(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_subtotal numeric(12,2);
BEGIN
  SELECT coalesce(round(sum(line_total), 2), 0) INTO v_subtotal
    FROM public.order_items WHERE order_id = _order_id AND item_status <> 'removed';
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET subtotal = v_subtotal, total_price = v_subtotal + delivery_fee WHERE id = _order_id;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_lock_adjustable_order(_order_id uuid)
 RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status <> 'preparing' THEN RAISE EXCEPTION 'Commencez la préparation avant de modifier les articles'; END IF;
  IF v_order.availability_checked_at IS NOT NULL OR v_order.receipt_photo_path IS NOT NULL THEN
    RAISE EXCEPTION 'Les disponibilités sont déjà validées : les articles ne peuvent plus changer';
  END IF;
  RETURN v_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_remove_order_item(_item_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item public.order_items%ROWTYPE; v_order public.orders%ROWTYPE;
BEGIN
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
    product_id = v_product.id,
    product_name = v_product.name,
    quantity_value = _quantity_value,
    quantity = _quantity_value::text || CASE WHEN v_product.unit_type = 'weight' THEN ' kg' ELSE ' x' END,
    item_status = 'replaced'
  WHERE id = _item_id;
  PERFORM public.recalculate_order_totals(v_order.id);
  INSERT INTO public.notifications (user_id, order_id, title, message)
  VALUES (v_order.user_id, v_order.id, 'Article remplacé', coalesce(v_item.original_product_name, v_item.product_name) || ' n’était pas disponible : remplacé par ' || v_product.name || '.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_confirm_availability(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  v_order := public.staff_lock_adjustable_order(_order_id);
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET availability_checked_at = now(), availability_checked_by = auth.uid() WHERE id = _order_id;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_confirm_payment(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status <> 'ready' THEN RAISE EXCEPTION 'La commande doit être prête'; END IF;
  IF v_order.payment_method = 'card' THEN RAISE EXCEPTION 'Paiement par carte : règlement reçu ultérieurement'; END IF;
  IF v_order.delivery_mode <> 'pickup' AND v_order.courier_called_at IS NULL THEN
    RAISE EXCEPTION 'Enregistrez d’abord l’appel au livreur';
  END IF;
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET payment_confirmed_at = now(), payment_confirmed_by = auth.uid() WHERE id = _order_id;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;

-- Receipt only after the items are final.
CREATE OR REPLACE FUNCTION public.attach_order_receipt(_order_id uuid, _photo_path text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  IF _photo_path IS NULL OR length(_photo_path) > 500
    OR _photo_path NOT LIKE (_order_id::text || '/%') OR position('..' IN _photo_path) > 0 THEN
    RAISE EXCEPTION 'Chemin de photo invalide';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status NOT IN ('preparing', 'ready') THEN RAISE EXCEPTION 'Le ticket ne peut plus être joint à cette commande'; END IF;
  IF v_order.availability_checked_at IS NULL THEN RAISE EXCEPTION 'Validez d’abord les disponibilités des articles'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'order-receipts' AND name = _photo_path) THEN
    RAISE EXCEPTION 'Photo du ticket introuvable';
  END IF;
  PERFORM set_config('chezmima.staff_order_transition', 'true', true);
  UPDATE public.orders SET receipt_photo_path = _photo_path, receipt_uploaded_at = now(), receipt_uploaded_by = auth.uid() WHERE id = _order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_staff_order_status(_order_id uuid, _new_status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%ROWTYPE; v_title text; v_message text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  IF NOT (
    (v_order.status = 'pending' AND _new_status IN ('confirmed', 'cancelled')) OR
    (v_order.status = 'confirmed' AND _new_status IN ('preparing', 'cancelled')) OR
    (v_order.status = 'preparing' AND _new_status IN ('ready', 'cancelled')) OR
    (v_order.status = 'ready' AND v_order.delivery_mode = 'pickup' AND _new_status = 'delivered') OR
    (v_order.status = 'ready' AND v_order.delivery_mode <> 'pickup' AND _new_status = 'delivering') OR
    (v_order.status = 'delivering' AND _new_status = 'delivered')
  ) THEN RAISE EXCEPTION 'Changement de statut non autorisé depuis le comptoir'; END IF;

  IF _new_status = 'ready' AND v_order.availability_checked_at IS NULL THEN
    RAISE EXCEPTION 'Validez d’abord les disponibilités des articles';
  END IF;
  IF _new_status = 'ready' AND v_order.receipt_photo_path IS NULL THEN
    RAISE EXCEPTION 'Ajoutez la photo du ticket de caisse avant de déclarer la commande prête';
  END IF;
  IF _new_status = 'delivering' AND v_order.courier_called_at IS NULL THEN
    RAISE EXCEPTION 'Enregistrez d’abord l’appel au livreur';
  END IF;
  IF _new_status = 'delivering' AND v_order.payment_method = 'cash' AND v_order.payment_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirmez la réception des espèces avant de remettre la commande';
  END IF;
  IF _new_status = 'delivered' AND v_order.delivery_mode = 'pickup' AND v_order.payment_method <> 'card' AND v_order.payment_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirmez le règlement sur place avant de clôturer';
  END IF;

  PERFORM set_config('chezmima.staff_order_transition', 'true', true);
  UPDATE public.orders SET status = _new_status WHERE id = _order_id;

  v_title := CASE _new_status
    WHEN 'confirmed' THEN 'Commande acceptée ✅'
    WHEN 'preparing' THEN 'En préparation 🍖'
    WHEN 'ready' THEN 'Commande prête ! 🎉'
    WHEN 'delivering' THEN 'En livraison 🚚'
    WHEN 'delivered' THEN CASE WHEN v_order.delivery_mode = 'pickup' THEN 'Commande récupérée ✅' ELSE 'Commande livrée ✅' END
    WHEN 'cancelled' THEN 'Commande annulée ❌'
  END;
  v_message := CASE _new_status
    WHEN 'confirmed' THEN 'Votre commande a été acceptée et sera bientôt préparée.'
    WHEN 'preparing' THEN 'Votre commande est en cours de préparation.'
    WHEN 'ready' THEN CASE WHEN v_order.delivery_mode = 'pickup' THEN 'Votre commande est prête. Vous pouvez venir la récupérer en boucherie.' ELSE 'Votre commande est prête et va être confiée au livreur.' END
    WHEN 'delivering' THEN 'Votre commande est en route !'
    WHEN 'delivered' THEN CASE WHEN v_order.delivery_mode = 'pickup' THEN 'Votre commande a été récupérée. Merci !' ELSE 'Votre commande a été livrée. Bon appétit !' END
    WHEN 'cancelled' THEN 'Votre commande a été annulée.'
  END;
  IF v_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, order_id, title, message) VALUES (v_order.user_id, v_order.id, v_title, v_message);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.recalculate_order_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_lock_adjustable_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_unavailable_policy(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_remove_order_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_replace_order_item(uuid, uuid, numeric, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_confirm_availability(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_confirm_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_unavailable_policy(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_remove_order_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_replace_order_item(uuid, uuid, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_confirm_availability(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_confirm_payment(uuid) TO authenticated;