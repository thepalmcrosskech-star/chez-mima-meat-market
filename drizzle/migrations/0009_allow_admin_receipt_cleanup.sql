CREATE POLICY "Admins can delete private order receipts" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'order-receipts' AND public.has_admin_role(auth.uid()));