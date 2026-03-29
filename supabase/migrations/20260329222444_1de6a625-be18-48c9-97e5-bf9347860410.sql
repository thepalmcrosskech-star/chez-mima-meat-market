-- Allow clients to cancel their own orders (only pending/confirmed)
CREATE POLICY "Users can cancel their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status IN ('pending', 'confirmed')
)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'cancelled'
);