
-- 1. Force status='pending' and validate pricing on order INSERT via trigger
CREATE OR REPLACE FUNCTION public.enforce_order_defaults_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.status := 'pending';
  IF NEW.subtotal <= 0 THEN
    RAISE EXCEPTION 'subtotal must be positive';
  END IF;
  IF NEW.total_price <= 0 THEN
    RAISE EXCEPTION 'total_price must be positive';
  END IF;
  IF NEW.delivery_fee < 0 THEN
    RAISE EXCEPTION 'delivery_fee cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_order_defaults
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_defaults_on_insert();
