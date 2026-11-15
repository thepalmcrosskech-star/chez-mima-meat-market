CREATE OR REPLACE FUNCTION public.set_profile_role_as_admin(_target_user_id uuid, _new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_role(auth.uid()) THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF _target_user_id IS NULL OR _new_role NOT IN ('user', 'driver') THEN RAISE EXCEPTION 'Invalid role change'; END IF;
  IF public.has_admin_role(_target_user_id) THEN RAISE EXCEPTION 'Administrator accounts cannot be changed here'; END IF;
  UPDATE public.profiles SET role = _new_role WHERE id = _target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_profile_role_as_admin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_role_as_admin(uuid, text) TO authenticated;

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (name, phone) ON TABLE public.profiles TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM authenticated;
GRANT UPDATE (status, driver_id, assignment_status) ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.order_items FROM authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.delivery_assignments FROM authenticated;
GRANT SELECT ON TABLE public.delivery_assignments TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.driver_ratings FROM authenticated;
GRANT SELECT ON TABLE public.driver_ratings TO authenticated;

REVOKE UPDATE ON TABLE public.driver_profiles FROM authenticated;
GRANT UPDATE (status, latitude, longitude, location_updated_at, vehicle_type, license_plate) ON TABLE public.driver_profiles TO authenticated;
GRANT INSERT, DELETE ON TABLE public.driver_profiles TO authenticated;

GRANT UPDATE (status, responded_at, picked_up_at, delivered_at) ON TABLE public.delivery_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.driver_locations TO authenticated;