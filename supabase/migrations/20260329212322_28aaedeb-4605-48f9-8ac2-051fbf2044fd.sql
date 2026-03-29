
-- Fix infinite recursion: delivery_assignments SELECT policy references orders, 
-- and orders SELECT policy references delivery_assignments → loop.
-- Solution: use SECURITY DEFINER functions to break the cycle.

-- Function to check if user has pending assignments (used by orders policy)
CREATE OR REPLACE FUNCTION public.driver_has_pending_assignment_for_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_assignments da
    JOIN public.driver_profiles dp ON da.driver_id = dp.id
    WHERE dp.user_id = auth.uid()
      AND da.order_id = _order_id
      AND da.status = 'pending'
  );
$$;

-- Function to check if user owns the order (used by delivery_assignments policy)
CREATE OR REPLACE FUNCTION public.user_owns_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = _order_id
      AND user_id = auth.uid()
  );
$$;

-- Drop and recreate the problematic policies
DROP POLICY IF EXISTS "Drivers can view orders with pending assignments" ON public.orders;
CREATE POLICY "Drivers can view orders with pending assignments"
ON public.orders
FOR SELECT
TO authenticated
USING (public.driver_has_pending_assignment_for_order(id));

DROP POLICY IF EXISTS "Clients can view assignments for their orders" ON public.delivery_assignments;
CREATE POLICY "Clients can view assignments for their orders"
ON public.delivery_assignments
FOR SELECT
TO authenticated
USING (public.user_owns_order(order_id));
