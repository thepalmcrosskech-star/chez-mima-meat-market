ALTER TABLE public.store_loyalty_transactions
  ALTER COLUMN staff_id DROP NOT NULL,
  ADD COLUMN source_sale_id uuid UNIQUE,
  ADD COLUMN refund_id uuid UNIQUE,
  ADD COLUMN reverses_id uuid REFERENCES public.store_loyalty_transactions(id),
  ADD COLUMN staff_label text,
  ADD COLUMN channel text NOT NULL DEFAULT 'app_staff';

CREATE OR REPLACE FUNCTION public.pos_find_loyalty_card(_query text)
RETURNS TABLE(token uuid, customer_name text, phone text, balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE q text:=trim(coalesce(_query,''));
BEGIN
  IF q ~* '^MIMA:[0-9a-f-]{36}$' THEN
    RETURN QUERY SELECT c.token,p.name,p.phone,greatest(public.loyalty_balance_for(c.user_id),0) FROM public.loyalty_cards c JOIN public.profiles p ON p.id=c.user_id WHERE c.token=substring(q from 6)::uuid;
  ELSIF public.normalize_loyalty_phone(q) IS NOT NULL THEN
    RETURN QUERY SELECT c.token,p.name,p.phone,greatest(public.loyalty_balance_for(c.user_id),0) FROM public.loyalty_cards c JOIN public.profiles p ON p.id=c.user_id WHERE public.normalize_loyalty_phone(p.phone)=public.normalize_loyalty_phone(q);
  ELSE RAISE EXCEPTION 'Scannez une carte Chez Mima ou saisissez un numéro mobile complet'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pos_check_spend(_token uuid, _points_used integer, _articles_total numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE u uuid; b integer;
BEGIN
  SELECT user_id INTO u FROM public.loyalty_cards WHERE token=_token;
  IF u IS NULL THEN RAISE EXCEPTION 'Carte inconnue'; END IF;
  b:=greatest(public.loyalty_balance_for(u),0);
  IF _points_used IS NULL OR _points_used<0 OR _points_used%50<>0 THEN RAISE EXCEPTION 'Les points s''utilisent par paquets de 50'; END IF;
  IF _articles_total IS NULL OR _articles_total<=0 OR _articles_total>100000 THEN RAISE EXCEPTION 'Montant du ticket invalide'; END IF;
  IF _points_used>b THEN RAISE EXCEPTION 'Solde de points insuffisant'; END IF;
  IF _points_used/5.0>=_articles_total THEN RAISE EXCEPTION 'La remise doit être inférieure au montant des articles'; END IF;
  RETURN jsonb_build_object('ok',true,'balance',b,'discount',_points_used/5.0,'to_pay',_articles_total-_points_used/5.0,'earned',floor((_articles_total-_points_used/5.0)/10)::integer);
END $$;

CREATE OR REPLACE FUNCTION public.pos_record_sale(_token uuid, _receipt text, _sale_id uuid, _articles_total numeric, _points_used integer, _staff_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE u uuid; r text:=upper(trim(coalesce(_receipt,''))); earned integer; old public.store_loyalty_transactions%ROWTYPE;
BEGIN
  IF _sale_id IS NULL THEN RAISE EXCEPTION 'Identifiant de vente obligatoire'; END IF;
  SELECT user_id INTO u FROM public.loyalty_cards WHERE token=_token;
  IF u IS NULL THEN RAISE EXCEPTION 'Carte inconnue'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('promo:'||u::text));
  SELECT * INTO old FROM public.store_loyalty_transactions WHERE source_sale_id=_sale_id;
  IF FOUND THEN
    IF old.user_id<>u OR old.receipt_reference<>r OR old.articles_total IS DISTINCT FROM _articles_total OR old.points_used IS DISTINCT FROM _points_used THEN RAISE EXCEPTION 'Cette vente a déjà été enregistrée avec d''autres valeurs'; END IF;
    RETURN jsonb_build_object('balance',greatest(public.loyalty_balance_for(u),0),'earned',old.points_earned,'used',old.points_used);
  END IF;
  IF length(r)<3 OR length(r)>80 THEN RAISE EXCEPTION 'Référence du ticket obligatoire (3 à 80 caractères)'; END IF;
  IF _articles_total IS NULL OR _articles_total::text IN ('NaN','Infinity','-Infinity') OR _articles_total<=0 OR _articles_total>100000 OR _articles_total<>round(_articles_total,2) THEN RAISE EXCEPTION 'Montant du ticket invalide'; END IF;
  IF _points_used IS NULL OR _points_used<0 OR _points_used%50<>0 THEN RAISE EXCEPTION 'Les points s''utilisent par paquets de 50'; END IF;
  IF _points_used>public.loyalty_balance_for(u) THEN RAISE EXCEPTION 'Solde de points insuffisant'; END IF;
  IF _points_used/5.0>=_articles_total THEN RAISE EXCEPTION 'La remise doit être inférieure au montant des articles'; END IF;
  IF EXISTS(SELECT 1 FROM public.store_loyalty_transactions WHERE receipt_reference=r) THEN RAISE EXCEPTION 'Ce ticket a déjà été enregistré'; END IF;
  earned:=floor((_articles_total-_points_used/5.0)/10)::integer;
  INSERT INTO public.store_loyalty_transactions(user_id,staff_id,staff_label,channel,receipt_reference,articles_total,points_used,points_earned,request_id,source_sale_id)
  VALUES(u,NULL,left(coalesce(_staff_label,''),80),'pos',r,_articles_total,_points_used,earned,_sale_id,_sale_id);
  RETURN jsonb_build_object('balance',greatest(public.loyalty_balance_for(u),0),'earned',earned,'used',_points_used);
END $$;

CREATE OR REPLACE FUNCTION public.pos_reverse_sale(_sale_id uuid, _refund_id uuid, _articles_refunded numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE o public.store_loyalty_transactions%ROWTYPE; prev public.store_loyalty_transactions%ROWTYPE;
  done_amt numeric; done_earned integer; done_used integer; tgt_earned integer; tgt_used integer; e integer; us integer;
BEGIN
  IF _refund_id IS NULL OR _sale_id IS NULL THEN RAISE EXCEPTION 'Identifiants obligatoires'; END IF;
  SELECT * INTO o FROM public.store_loyalty_transactions WHERE source_sale_id=_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente fidélité introuvable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('promo:'||o.user_id::text));
  SELECT * INTO prev FROM public.store_loyalty_transactions WHERE refund_id=_refund_id;
  IF FOUND THEN
    IF prev.reverses_id IS DISTINCT FROM o.id OR prev.articles_total<>-_articles_refunded THEN RAISE EXCEPTION 'Ce remboursement a déjà été enregistré avec d''autres valeurs'; END IF;
    RETURN jsonb_build_object('balance',greatest(public.loyalty_balance_for(o.user_id),0),'earned',prev.points_earned,'used',prev.points_used);
  END IF;
  IF _articles_refunded IS NULL OR _articles_refunded<=0 OR _articles_refunded<>round(_articles_refunded,2) THEN RAISE EXCEPTION 'Montant remboursé invalide'; END IF;
  SELECT coalesce(-sum(articles_total),0),coalesce(-sum(points_earned),0),coalesce(-sum(points_used),0) INTO done_amt,done_earned,done_used FROM public.store_loyalty_transactions WHERE reverses_id=o.id;
  IF done_amt+_articles_refunded>o.articles_total THEN RAISE EXCEPTION 'Le remboursement dépasse la vente d''origine'; END IF;
  tgt_earned:=floor(o.points_earned*(done_amt+_articles_refunded)/o.articles_total)::integer;
  tgt_used:=floor(o.points_used*(done_amt+_articles_refunded)/o.articles_total)::integer;
  IF done_amt+_articles_refunded=o.articles_total THEN tgt_earned:=o.points_earned; tgt_used:=o.points_used; END IF;
  e:=tgt_earned-done_earned; us:=tgt_used-done_used;
  INSERT INTO public.store_loyalty_transactions(user_id,staff_id,channel,receipt_reference,articles_total,points_used,points_earned,request_id,refund_id,reverses_id)
  VALUES(o.user_id,NULL,'pos_refund','REFUND:'||_refund_id::text,-_articles_refunded,-us,-e,_refund_id,_refund_id,o.id);
  RETURN jsonb_build_object('balance',greatest(public.loyalty_balance_for(o.user_id),0),'earned',-e,'used',-us);
END $$;

REVOKE ALL ON FUNCTION public.pos_find_loyalty_card(text), public.pos_check_spend(uuid,integer,numeric), public.pos_record_sale(uuid,text,uuid,numeric,integer,text), public.pos_reverse_sale(uuid,uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_find_loyalty_card(text), public.pos_check_spend(uuid,integer,numeric), public.pos_record_sale(uuid,text,uuid,numeric,integer,text), public.pos_reverse_sale(uuid,uuid,numeric) TO service_role;