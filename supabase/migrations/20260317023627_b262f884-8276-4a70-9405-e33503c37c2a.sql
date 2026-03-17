CREATE POLICY "Drivers can update orders assigned to them"
ON public.orders
FOR UPDATE
TO authenticated
USING (driver_id IN (
  SELECT id FROM driver_profiles WHERE user_id = auth.uid()
))
WITH CHECK (driver_id IN (
  SELECT id FROM driver_profiles WHERE user_id = auth.uid()
));