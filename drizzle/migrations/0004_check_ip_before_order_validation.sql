CREATE OR REPLACE FUNCTION public.assert_order_ip_allowed()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ips inet[] := public.order_request_ips(); banned text;
BEGIN
  IF cardinality(ips) = 0 THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Adresse IP non vérifiable : commande refusée'; END IF;
  FOR banned IN SELECT ip_address FROM public.banned_ips LOOP
    BEGIN
      IF position('/' in banned) = 0 AND banned::inet = ANY(ips) THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Accès bloqué : cette adresse IP est bannie';
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.assert_order_ip_allowed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_order_ip_allowed() TO service_role;
CREATE OR REPLACE FUNCTION public.guard_order_insert_ip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.assert_order_ip_allowed();
  RETURN NEW;
END $$;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.create_customer_order(jsonb,text,uuid,uuid,text,timestamptz,text,integer)'::regprocedure) INTO definition;
 IF position('PERFORM public.assert_order_ip_allowed();' in definition) = 0 THEN
   definition := replace(definition, 'IF v_user_id IS NULL THEN RAISE EXCEPTION ''Authentication required''; END IF;', 'IF v_user_id IS NULL THEN RAISE EXCEPTION ''Authentication required''; END IF;' || E'\n  PERFORM public.assert_order_ip_allowed();');
   IF position('PERFORM public.assert_order_ip_allowed();' in definition) = 0 THEN RAISE EXCEPTION 'Order function entry point not found'; END IF;
   EXECUTE definition;
 END IF;
END $$;