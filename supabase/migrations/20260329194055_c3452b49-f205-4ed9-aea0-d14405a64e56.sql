
-- 1. Table de tracking GPS temps réel
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  heading DECIMAL(5,2),
  speed DECIMAL(6,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_driver_locations_driver ON public.driver_locations(driver_id);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- RLS: Drivers can upsert their own location
CREATE POLICY "Drivers can manage own location" ON public.driver_locations
FOR ALL TO authenticated
USING (
  driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid())
);

-- RLS: Admins can view all
CREATE POLICY "Admins can view all driver locations" ON public.driver_locations
FOR SELECT TO authenticated
USING (public.has_admin_role(auth.uid()));

-- RLS: Clients can view driver location for their active orders
CREATE POLICY "Clients can view driver of their orders" ON public.driver_locations
FOR SELECT TO authenticated
USING (
  driver_id IN (
    SELECT driver_id FROM public.orders 
    WHERE user_id = auth.uid() 
    AND driver_id IS NOT NULL 
    AND status IN ('confirmed','preparing','delivering')
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- 2. Table d'attribution des livraisons
CREATE TABLE public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  distance_to_shop DECIMAL(10,2),
  estimated_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- RLS: Drivers can view and update their assignments
CREATE POLICY "Drivers can view own assignments" ON public.delivery_assignments
FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Drivers can update own assignments" ON public.delivery_assignments
FOR UPDATE TO authenticated
USING (
  driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid())
);

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage all assignments" ON public.delivery_assignments
FOR ALL TO authenticated
USING (public.has_admin_role(auth.uid()));

-- RLS: Clients can view assignments for their orders
CREATE POLICY "Clients can view assignments for their orders" ON public.delivery_assignments
FOR SELECT TO authenticated
USING (
  order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;

-- 3. Table de notation des livreurs
CREATE TABLE public.driver_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, user_id)
);

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

-- RLS: Users can insert ratings for their own orders
CREATE POLICY "Users can create ratings for their orders" ON public.driver_ratings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
);

-- RLS: Drivers can view their ratings
CREATE POLICY "Drivers can view own ratings" ON public.driver_ratings
FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid())
);

-- RLS: Users can view their own ratings
CREATE POLICY "Users can view own ratings" ON public.driver_ratings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage all ratings" ON public.driver_ratings
FOR ALL TO authenticated
USING (public.has_admin_role(auth.uid()));

-- 4. Add columns to orders for assignment tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'unassigned';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assignment_attempts INTEGER DEFAULT 0;

-- Validation trigger for driver_ratings rating range
CREATE OR REPLACE FUNCTION public.validate_driver_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_driver_rating
BEFORE INSERT OR UPDATE ON public.driver_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_driver_rating();

-- Validation trigger for delivery_assignments status
CREATE OR REPLACE FUNCTION public.validate_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','accepted','rejected','expired','cancelled') THEN
    RAISE EXCEPTION 'Invalid assignment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_assignment_status
BEFORE INSERT OR UPDATE ON public.delivery_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_assignment_status();
