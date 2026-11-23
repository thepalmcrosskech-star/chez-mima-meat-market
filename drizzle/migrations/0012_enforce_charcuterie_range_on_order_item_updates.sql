CREATE TRIGGER trg_enforce_order_item_weight_on_update
BEFORE UPDATE OF quantity_value, product_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_pricing();