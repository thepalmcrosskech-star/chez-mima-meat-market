REVOKE ALL ON public.orders, public.order_items, public.profiles, public.user_addresses FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON public.orders, public.order_items, public.profiles, public.user_addresses FROM authenticated;
REVOKE DELETE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM authenticated;