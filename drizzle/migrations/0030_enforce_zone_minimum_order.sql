-- Reverse: re-run with the inserted minimum check line removed from create_customer_order.
DO $mig$
DECLARE def text := pg_get_functiondef('public.create_customer_order'::regproc);
  marker text := $m$IF NOT FOUND OR v_zone.id <> _delivery_zone_id THEN RAISE EXCEPTION 'Address is outside the selected delivery zone'; END IF;$m$;
  addition text := $a$
    IF v_subtotal < coalesce(v_zone.minimum_order, 0) THEN RAISE EXCEPTION 'Minimum de commande non atteint pour cette zone : % DH d''articles requis', v_zone.minimum_order; END IF;$a$;
BEGIN
  IF position('Minimum de commande non atteint' in def) > 0 THEN RETURN; END IF;
  IF position(marker in def) = 0 THEN RAISE EXCEPTION 'create_customer_order a changé : point d''insertion introuvable'; END IF;
  EXECUTE replace(def, marker, marker || addition);
END $mig$;