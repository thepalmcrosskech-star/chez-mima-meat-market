
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

CREATE POLICY "Anyone can read public app settings"
  ON public.app_settings
  FOR SELECT
  TO public
  USING (
    key IN ('store_name', 'store_phone', 'store_address', 'store_hours', 'store_description', 'store_logo', 'store_currency', 'store_center_lat', 'store_center_lng')
    OR has_admin_role(auth.uid())
  );
