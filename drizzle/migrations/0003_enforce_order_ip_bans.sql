CREATE OR REPLACE FUNCTION public.order_request_ips()
RETURNS inet[] LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE h jsonb; candidate text; result inet[] := ARRAY[]::inet[];
BEGIN
  h := nullif(current_setting('request.headers', true), '')::jsonb;
  FOR candidate IN SELECT trim(v) FROM regexp_split_to_table(concat_ws(',', h->>'cf-connecting-ip', h->>'x-forwarded-for', h->>'x-real-ip'), ',') AS v LOOP
    BEGIN
      IF candidate <> '' AND position('/' in candidate) = 0 THEN result := array_append(result, candidate::inet); END IF;
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.order_request_ips() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_request_ips() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_order_insert_ip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ips inet[] := public.order_request_ips(); banned text;
BEGIN
  IF cardinality(ips) = 0 THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Adresse IP non vérifiable : commande refusée';
  END IF;
  FOR banned IN SELECT ip_address FROM public.banned_ips LOOP
    BEGIN
      IF position('/' in banned) = 0 AND banned::inet = ANY(ips) THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Accès bloqué : cette adresse IP est bannie';
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_order_insert_ip() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_order_insert_ip() TO service_role;
CREATE TRIGGER trg_guard_order_insert_ip BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_insert_ip();