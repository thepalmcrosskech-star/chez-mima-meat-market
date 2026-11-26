GRANT DELETE ON public.notifications TO authenticated;
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cleanup_finished_order_notifications(_user uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.notifications n USING public.orders o
  WHERE n.user_id = _user AND n.order_id = o.id
    AND o.status IN ('delivered','cancelled')
    AND COALESCE(o.updated_at, o.created_at) < now() - interval '24 hours';
$$;

CREATE OR REPLACE FUNCTION public.cleanup_my_finished_order_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.cleanup_finished_order_notifications(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.cleanup_finished_order_notifications(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_my_finished_order_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_my_finished_order_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_cleanup_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cleanup_finished_order_notifications(NEW.user_id);
  RETURN NEW;
END $$;
CREATE TRIGGER cleanup_notifications_after_insert AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_cleanup_notifications();