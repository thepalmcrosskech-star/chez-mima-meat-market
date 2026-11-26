CREATE OR REPLACE FUNCTION public.set_my_default_address(_address_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_addresses WHERE id = _address_id AND user_id = v_user) THEN RAISE EXCEPTION 'Adresse introuvable'; END IF;
  UPDATE public.user_addresses SET is_default = (id = _address_id) WHERE user_id = v_user;
END $$;

CREATE OR REPLACE FUNCTION public.delete_my_address(_address_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_user uuid := auth.uid(); v_was_default boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT coalesce(is_default, false) INTO v_was_default FROM public.user_addresses WHERE id = _address_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Adresse introuvable'; END IF;
  -- Past orders keep their stored address snapshot and coordinates; only the address-book link is cleared.
  PERFORM set_config('chezmima.order_adjustment', 'true', true);
  UPDATE public.orders SET delivery_address_id = NULL WHERE delivery_address_id = _address_id AND user_id = v_user;
  PERFORM set_config('chezmima.order_adjustment', 'false', true);
  DELETE FROM public.user_addresses WHERE id = _address_id AND user_id = v_user;
  IF v_was_default THEN
    UPDATE public.user_addresses SET is_default = true
    WHERE id = (SELECT id FROM public.user_addresses WHERE user_id = v_user ORDER BY created_at DESC LIMIT 1);
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_my_default_address(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_address(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_default_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_address(uuid) TO authenticated;