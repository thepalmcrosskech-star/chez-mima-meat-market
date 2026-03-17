
-- Add scheduled delivery date to orders
ALTER TABLE public.orders ADD COLUMN scheduled_for timestamp with time zone NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.scheduled_for IS 'When the order should be prepared/delivered (next opening if ordered after hours)';
