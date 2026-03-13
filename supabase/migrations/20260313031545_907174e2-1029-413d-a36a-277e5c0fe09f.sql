
CREATE OR REPLACE FUNCTION public.enforce_order_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  real_price numeric;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT price INTO real_price FROM public.products WHERE id = NEW.product_id;
    IF real_price IS NULL THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
    NEW.unit_price := real_price;
    NEW.line_total := real_price * NEW.quantity_value;
  ELSE
    IF NEW.unit_price <= 0 OR NEW.line_total <= 0 THEN
      RAISE EXCEPTION 'Prices must be positive';
    END IF;
  END IF;
  IF NEW.quantity_value <= 0 THEN
    RAISE EXCEPTION 'quantity_value must be positive';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_order_item_pricing
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_item_pricing();
