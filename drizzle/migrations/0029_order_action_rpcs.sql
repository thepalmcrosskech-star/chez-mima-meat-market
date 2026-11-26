-- Reverse: DROP FUNCTION public.admin_assign_order_driver(uuid, uuid); DROP FUNCTION public.cancel_my_order(uuid);
CREATE OR REPLACE FUNCTION public.admin_assign_order_driver(_order_id uuid, _driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_order public.orders%ROWTYPE; v_driver public.driver_profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_role(auth.uid()) THEN RAISE EXCEPTION 'Accès administrateur requis'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.delivery_mode = 'pickup' THEN RAISE EXCEPTION 'Une commande à retirer en boutique ne peut pas avoir de livreur'; END IF;
  IF v_order.status NOT IN ('confirmed','preparing','ready') THEN RAISE EXCEPTION 'Le livreur ne peut être changé que pour une commande confirmée, en préparation ou prête'; END IF;
  IF _driver_id IS NULL THEN
    UPDATE public.orders SET driver_id = NULL, assignment_status = NULL WHERE id = _order_id;
    RETURN;
  END IF;
  SELECT * INTO v_driver FROM public.driver_profiles WHERE id = _driver_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Livreur introuvable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_driver.user_id AND role = 'driver') THEN RAISE EXCEPTION 'Ce compte n''a plus le rôle livreur'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE driver_id = _driver_id AND status = 'delivering' AND id <> _order_id) THEN RAISE EXCEPTION 'Ce livreur a déjà une livraison en cours'; END IF;
  UPDATE public.orders SET driver_id = _driver_id, assignment_status = 'assigned' WHERE id = _order_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_my_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'Cette commande est déjà en préparation et ne peut plus être annulée'; END IF;
  UPDATE public.orders SET status = 'cancelled' WHERE id = _order_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_assign_order_driver(uuid,uuid), public.cancel_my_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_order_driver(uuid,uuid), public.cancel_my_order(uuid) TO authenticated;