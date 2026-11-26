CREATE OR REPLACE FUNCTION public.get_public_product_rating_summary()
RETURNS TABLE(product_id uuid, average_rating numeric, review_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT r.product_id, avg(r.rating)::numeric, count(*)::integer FROM public.product_reviews r GROUP BY r.product_id
$$;
REVOKE ALL ON FUNCTION public.get_public_product_rating_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_rating_summary() TO anon, authenticated;