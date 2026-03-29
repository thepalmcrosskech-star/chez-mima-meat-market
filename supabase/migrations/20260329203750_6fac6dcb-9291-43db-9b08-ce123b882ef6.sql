
CREATE POLICY "Drivers can view customer profiles for assigned orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT o.user_id FROM orders o
    JOIN delivery_assignments da ON da.order_id = o.id
    JOIN driver_profiles dp ON da.driver_id = dp.id
    WHERE dp.user_id = auth.uid()
    AND da.status IN ('pending', 'accepted')
  )
);
