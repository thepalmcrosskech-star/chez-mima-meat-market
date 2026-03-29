DROP POLICY IF EXISTS "Drivers can view customer profiles for assigned orders" ON public.profiles;

CREATE OR REPLACE FUNCTION public.can_driver_view_customer_profile(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_assignments da
    JOIN public.orders o ON o.id = da.order_id
    JOIN public.driver_profiles dp ON dp.id = da.driver_id
    WHERE dp.user_id = auth.uid()
      AND da.status IN ('pending', 'accepted')
      AND o.user_id = _customer_id
  );
$$;

CREATE POLICY "Drivers can view customer profiles for assigned orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_driver_view_customer_profile(id));