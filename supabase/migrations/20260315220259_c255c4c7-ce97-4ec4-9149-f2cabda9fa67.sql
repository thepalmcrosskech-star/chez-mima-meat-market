
DROP POLICY "Anyone can read active products" ON public.products;
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT TO public USING (true);
