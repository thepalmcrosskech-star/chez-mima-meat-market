
-- Add real-time location columns to driver_profiles
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone DEFAULT NULL;

-- Add driver_id to orders so we know which driver is assigned
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.driver_profiles(id) DEFAULT NULL;

-- Enable realtime on driver_profiles for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_profiles;
