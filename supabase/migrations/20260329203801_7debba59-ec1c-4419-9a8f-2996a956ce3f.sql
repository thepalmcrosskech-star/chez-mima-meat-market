
UPDATE delivery_assignments 
SET status = 'expired', responded_at = now() 
WHERE driver_id = '10b33783-7b2e-4d24-a01a-05d4ad57a63a' AND status = 'pending';

INSERT INTO delivery_assignments (order_id, driver_id, status, expires_at, distance_to_shop, estimated_duration)
VALUES (
  '146554bc-c21a-4e20-8c6c-df2394222211',
  '10b33783-7b2e-4d24-a01a-05d4ad57a63a',
  'pending',
  now() + interval '180 seconds',
  0.17,
  5
);
