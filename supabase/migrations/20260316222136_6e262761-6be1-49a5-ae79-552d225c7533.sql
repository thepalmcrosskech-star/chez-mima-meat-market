
-- Add payment columns to orders table
ALTER TABLE public.orders
ADD COLUMN payment_method text NOT NULL DEFAULT 'cash',
ADD COLUMN payment_status text NOT NULL DEFAULT 'pending',
ADD COLUMN cash_bill_amount integer NULL,
ADD COLUMN cmi_order_id text NULL,
ADD COLUMN cmi_transaction_id text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.payment_method IS 'cash or card';
COMMENT ON COLUMN public.orders.payment_status IS 'pending, authorized, captured, failed, refunded';
COMMENT ON COLUMN public.orders.cash_bill_amount IS 'Bill denomination in MAD for cash payments (e.g. 50, 100, 200)';
COMMENT ON COLUMN public.orders.cmi_order_id IS 'CMI payment gateway order reference';
COMMENT ON COLUMN public.orders.cmi_transaction_id IS 'CMI transaction ID after authorization';
