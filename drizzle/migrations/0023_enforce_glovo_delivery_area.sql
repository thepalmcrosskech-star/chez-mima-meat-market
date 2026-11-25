CREATE OR REPLACE FUNCTION public.is_in_delivery_area(_lat numeric, _lng numeric)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $f$
DECLARE pts numeric[][] := ARRAY[[31.65125,-8.08223],[31.66179,-8.06435],[31.66850,-8.04199],[31.67176,-8.02187],[31.67042,-8.00175],[31.66563,-7.98163],[31.65796,-7.96375],[31.64837,-7.95704],[31.64166,-7.94363],[31.63399,-7.94698],[31.63879,-7.95257],[31.63687,-7.96151],[31.63016,-7.97381],[31.62345,-7.97045],[31.61482,-7.96822],[31.60428,-7.96933],[31.59948,-7.96375],[31.60140,-7.95480],[31.59852,-7.95145],[31.59661,-7.94363],[31.58510,-7.93357],[31.57264,-7.92574],[31.57264,-7.93021],[31.58031,-7.93915],[31.59469,-7.95257],[31.59373,-7.95704],[31.58606,-7.95436],[31.58510,-7.95927],[31.58894,-7.96598],[31.59277,-7.96933],[31.59373,-7.97828],[31.55922,-7.97716],[31.55922,-7.98387],[31.56114,-7.99616],[31.57072,-8.00175],[31.57743,-8.00622],[31.57168,-8.01069],[31.56401,-8.01405],[31.56018,-8.01964],[31.57552,-8.01964],[31.57743,-8.02411],[31.57360,-8.02970],[31.57072,-8.03640],[31.57552,-8.04087],[31.57072,-8.04870],[31.56593,-8.05093],[31.56018,-8.05876],[31.56593,-8.06323],[31.57552,-8.05764],[31.58510,-8.05876],[31.59661,-8.05876],[31.60428,-8.06435],[31.60907,-8.06994],[31.61770,-8.07217],[31.61866,-8.08111],[31.63112,-8.08447]]; n int := array_length(pts,1); i int; j int; inside boolean := false;
BEGIN
  IF _lat IS NULL OR _lng IS NULL THEN RETURN false; END IF;
  j := n;
  FOR i IN 1..n LOOP
    IF (pts[i][1] > _lat) <> (pts[j][1] > _lat)
       AND _lng < (pts[j][2]-pts[i][2])*(_lat-pts[i][1])/(pts[j][1]-pts[i][1]) + pts[i][2] THEN inside := NOT inside; END IF;
    j := i;
  END LOOP;
  RETURN inside;
END $f$;
REVOKE ALL ON FUNCTION public.is_in_delivery_area(numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_in_delivery_area(numeric,numeric) TO authenticated;
DO $d$
DECLARE def text; marker text := '    SELECT * INTO v_zone FROM public.delivery_zones AS z WHERE z.is_active = true AND z.radius_km IS NOT NULL';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p WHERE p.proname='create_customer_order' AND p.pronamespace='public'::regnamespace;
  IF position('is_in_delivery_area' in def) > 0 THEN RETURN; END IF;
  IF position(marker in def) = 0 THEN RAISE EXCEPTION 'marker not found'; END IF;
  def := replace(def, marker, '    IF NOT public.is_in_delivery_area(v_address.latitude, v_address.longitude) THEN RAISE EXCEPTION ''Address is outside the delivery area''; END IF;' || chr(10) || marker);
  EXECUTE def;
END $d$;