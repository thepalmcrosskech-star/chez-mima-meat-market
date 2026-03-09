
-- Create product-images bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload/update/delete files
CREATE POLICY "Admins can manage product images"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'product-images' AND public.has_admin_role(auth.uid()))
WITH CHECK (bucket_id = 'product-images' AND public.has_admin_role(auth.uid()));

-- Allow public read access
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');
