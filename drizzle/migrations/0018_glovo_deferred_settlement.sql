DO $migration$
DECLARE original text; updated text;
BEGIN
  SELECT pg_get_functiondef('public.update_staff_order_status(uuid,text)'::regprocedure) INTO original;
  updated := replace(original, E'  IF _new_status = ''delivering'' AND v_order.payment_method = ''cash'' AND v_order.payment_confirmed_at IS NULL THEN\n    RAISE EXCEPTION ''Confirmez la réception des espèces avant de remettre la commande'';\n  END IF;\n', '');
  IF updated = original THEN RAISE EXCEPTION 'Expected cash handoff guard not found'; END IF;
  EXECUTE updated;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.staff_confirm_payment(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_staff_access(auth.uid()) THEN RAISE EXCEPTION 'Accès comptoir requis'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.delivery_mode <> 'pickup' THEN RAISE EXCEPTION 'Glovo règle les livraisons par virement deux fois par mois : aucun encaissement au comptoir'; END IF;
  IF v_order.status <> 'ready' THEN RAISE EXCEPTION 'La commande doit être prête'; END IF;
  IF v_order.payment_method = 'card' THEN RAISE EXCEPTION 'Paiement par carte : règlement reçu ultérieurement'; END IF;
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET payment_confirmed_at = now(), payment_confirmed_by = auth.uid() WHERE id = _order_id;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.staff_confirm_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_confirm_payment(uuid) TO authenticated, service_role;