ALTER TABLE public.products ADD COLUMN IF NOT EXISTS family text;

UPDATE public.products SET name = 'Freez fraise', family = 'Freez'
WHERE id = 'a2e3dacd-90a8-4f8d-b283-ffeaa57d83e6';

INSERT INTO public.products (name, description, price, unit_type, stock_quantity, category_id, image_url, is_active, product_info, family)
SELECT v.name, p.description, p.price, p.unit_type, p.stock_quantity, p.category_id, v.img, true, p.product_info, 'Freez'
FROM public.products p,
(VALUES
  ('Freez citron menthe', '/__l5e/assets-v1/65badf01-b295-4702-b74c-9856a4a319ba/freez-citron-menthe.jpg'),
  ('Freez lemonade mix', '/__l5e/assets-v1/5a1258a1-1142-48a1-99a0-a7579f4eeb86/freez-lemonade-mix.jpg'),
  ('Freez fruits rouges', '/__l5e/assets-v1/bcd33121-4297-409b-8596-9a882278ff65/freez-berry-mix.jpg'),
  ('Freez ananas coco', '/__l5e/assets-v1/a3fcfa08-545c-41c0-8c70-1fd95b3613b4/freez-ananas-coco.jpg')
) AS v(name, img)
WHERE p.id = 'a2e3dacd-90a8-4f8d-b283-ffeaa57d83e6'
  AND NOT EXISTS (SELECT 1 FROM public.products x WHERE x.name = v.name);