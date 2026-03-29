CREATE POLICY "Drivers can view orders with pending assignments"
ON public.orders
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT da.order_id FROM delivery_assignments da
    JOIN driver_profiles dp ON da.driver_id = dp.id
    WHERE dp.user_id = auth.uid()
    AND da.status = 'pending'
  )
);