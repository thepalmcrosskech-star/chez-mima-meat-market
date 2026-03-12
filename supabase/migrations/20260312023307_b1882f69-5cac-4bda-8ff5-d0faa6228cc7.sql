
-- 1. Trigger to force role='user' on INSERT (prevent privilege escalation)
CREATE OR REPLACE FUNCTION public.enforce_user_role_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.role := 'user';
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_user_role_on_profiles_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_role_on_insert();

-- 2. Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_admin_role(auth.uid()));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO public USING (has_admin_role(auth.uid()));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO public USING (auth.uid() = id);
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO public USING (auth.uid() = id);

-- categories
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
DROP POLICY IF EXISTS "Only admins can manage categories" ON public.categories;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Only admins can manage categories" ON public.categories FOR ALL TO public USING (has_admin_role(auth.uid()));

-- delivery_zones
DROP POLICY IF EXISTS "Anyone can read active zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Only admins can manage delivery zones" ON public.delivery_zones;
CREATE POLICY "Anyone can read active zones" ON public.delivery_zones FOR SELECT TO public USING ((is_active = true) OR has_admin_role(auth.uid()));
CREATE POLICY "Only admins can manage delivery zones" ON public.delivery_zones FOR ALL TO public USING (has_admin_role(auth.uid()));

-- user_addresses
DROP POLICY IF EXISTS "Admins can view all addresses" ON public.user_addresses;
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.user_addresses;
CREATE POLICY "Admins can view all addresses" ON public.user_addresses FOR SELECT TO public USING (has_admin_role(auth.uid()));
CREATE POLICY "Users can manage their own addresses" ON public.user_addresses FOR ALL TO public USING (auth.uid() = user_id);

-- orders
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL TO public USING (has_admin_role(auth.uid()));
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO public USING (auth.uid() = user_id);

-- order_items
DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL TO public USING (has_admin_role(auth.uid()));
CREATE POLICY "Users can create order items for their orders" ON public.order_items FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT TO public USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

-- messages
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read messages they received" ON public.messages;
CREATE POLICY "Admins can manage all messages" ON public.messages FOR ALL TO public USING (has_admin_role(auth.uid()));
CREATE POLICY "Users can read messages they received" ON public.messages FOR SELECT TO public USING (auth.uid() = receiver_id);

-- app_settings
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Only admins can manage app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "Only admins can manage app settings" ON public.app_settings FOR ALL TO public USING (has_admin_role(auth.uid()));

-- driver_profiles
DROP POLICY IF EXISTS "Admins can manage all driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can update their own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers can view their own profile" ON public.driver_profiles;
CREATE POLICY "Admins can manage all driver profiles" ON public.driver_profiles FOR ALL TO authenticated USING (has_admin_role(auth.uid()));
CREATE POLICY "Drivers can update their own profile" ON public.driver_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Drivers can view their own profile" ON public.driver_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- product_reviews
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can create their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.product_reviews;
CREATE POLICY "Admins can manage all reviews" ON public.product_reviews FOR ALL TO authenticated USING (has_admin_role(auth.uid()));
CREATE POLICY "Anyone can read reviews" ON public.product_reviews FOR SELECT TO public USING (true);
CREATE POLICY "Users can create their own reviews" ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reviews" ON public.product_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- products
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
DROP POLICY IF EXISTS "Only admins can manage products" ON public.products;
CREATE POLICY "Anyone can read active products" ON public.products FOR SELECT TO public USING ((is_active = true) OR has_admin_role(auth.uid()));
CREATE POLICY "Only admins can manage products" ON public.products FOR ALL TO public USING (has_admin_role(auth.uid()));
