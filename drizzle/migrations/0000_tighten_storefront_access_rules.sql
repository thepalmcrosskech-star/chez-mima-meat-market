DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
CREATE POLICY "Authenticated users can read categories" ON public.categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read reviews" ON public.product_reviews;
CREATE POLICY "Authenticated users can read reviews" ON public.product_reviews FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view banner images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;