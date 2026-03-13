CREATE POLICY "Drivers can view orders assigned to them"
ON public.orders
FOR SELECT
TO authenticated
USING (driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()));