CREATE OR REPLACE FUNCTION public.enforce_order_item_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  real_price numeric;
  product_category uuid;
  product_unit text;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT price, category_id, unit_type INTO real_price, product_category, product_unit FROM public.products WHERE id = NEW.product_id;
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
  IF product_category = '0e3b434d-9c58-4c08-b571-b40238a0c567'::uuid
    AND product_unit IN ('weight', 'kg')
    AND (NEW.quantity_value < 0.1 OR NEW.quantity_value > 0.5) THEN
    RAISE EXCEPTION 'Charcuterie quantity must be between 100 g and 500 g';
  END IF;
  RETURN NEW;
END;
$function$;