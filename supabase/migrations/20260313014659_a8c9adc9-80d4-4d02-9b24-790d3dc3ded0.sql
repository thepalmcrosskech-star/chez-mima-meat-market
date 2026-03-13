
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS radius_km numeric DEFAULT NULL;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS min_radius_km numeric DEFAULT 0;
ALTER TABLE public.delivery_zones ALTER COLUMN polygon DROP NOT NULL;
ALTER TABLE public.delivery_zones ALTER COLUMN polygon SET DEFAULT NULL;
