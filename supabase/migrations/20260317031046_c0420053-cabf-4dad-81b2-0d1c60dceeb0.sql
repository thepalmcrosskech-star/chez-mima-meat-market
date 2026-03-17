
-- Update the public read policy to include opening/closing hours
DROP POLICY IF EXISTS "Anyone can read public app settings" ON public.app_settings;
CREATE POLICY "Anyone can read public app settings"
ON public.app_settings
FOR SELECT
TO public
USING (
  key = ANY (ARRAY[
    'store_name', 'store_phone', 'store_address', 'store_hours', 'store_description',
    'store_logo', 'store_currency', 'store_center_lat', 'store_center_lng',
    'store_latitude', 'store_longitude',
    'store_opening_hour', 'store_closing_hour'
  ])
  OR has_admin_role(auth.uid())
);
