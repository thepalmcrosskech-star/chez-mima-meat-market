CREATE OR REPLACE FUNCTION public.pos_reverse_sale(_sale_id uuid, _refund_id uuid, _articles_refunded numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  o public.store_loyalty_transactions%ROWTYPE;
  prev public.store_loyalty_transactions%ROWTYPE;
  paid_total numeric;
  done_amt numeric;
  done_earned integer;
  done_used integer;
  tgt_earned integer;
  tgt_used integer;
  e integer;
  us integer;
BEGIN
  IF _refund_id IS NULL OR _sale_id IS NULL THEN
    RAISE EXCEPTION 'Identifiants obligatoires';
  END IF;

  SELECT * INTO o FROM public.store_loyalty_transactions WHERE source_sale_id = _sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente fidélité introuvable';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('promo:' || o.user_id::text));

  SELECT * INTO prev FROM public.store_loyalty_transactions WHERE refund_id = _refund_id;
  IF FOUND THEN
    IF prev.reverses_id IS DISTINCT FROM o.id OR prev.articles_total <> -_articles_refunded THEN
      RAISE EXCEPTION 'Ce remboursement a déjà été enregistré avec d''autres valeurs';
    END IF;
    RETURN jsonb_build_object(
      'balance', greatest(public.loyalty_balance_for(o.user_id), 0),
      'earned', prev.points_earned,
      'used', prev.points_used
    );
  END IF;

  IF _articles_refunded IS NULL
    OR _articles_refunded::text IN ('NaN', 'Infinity', '-Infinity')
    OR _articles_refunded <= 0
    OR _articles_refunded <> round(_articles_refunded, 2) THEN
    RAISE EXCEPTION 'Montant remboursé invalide';
  END IF;

  -- The till refunds the cash amount paid after the loyalty discount.
  paid_total := o.articles_total - o.points_used / 5.0;

  SELECT
    coalesce(-sum(articles_total), 0),
    coalesce(-sum(points_earned), 0),
    coalesce(-sum(points_used), 0)
  INTO done_amt, done_earned, done_used
  FROM public.store_loyalty_transactions
  WHERE reverses_id = o.id;

  IF done_amt + _articles_refunded > paid_total THEN
    RAISE EXCEPTION 'Le remboursement dépasse la vente d''origine';
  END IF;

  tgt_earned := floor(o.points_earned * (done_amt + _articles_refunded) / paid_total)::integer;
  tgt_used := floor(o.points_used * (done_amt + _articles_refunded) / paid_total)::integer;

  IF done_amt + _articles_refunded = paid_total THEN
    tgt_earned := o.points_earned;
    tgt_used := o.points_used;
  END IF;

  e := tgt_earned - done_earned;
  us := tgt_used - done_used;

  INSERT INTO public.store_loyalty_transactions(
    user_id, staff_id, channel, receipt_reference, articles_total,
    points_used, points_earned, request_id, refund_id, reverses_id
  )
  VALUES(
    o.user_id, NULL, 'pos_refund', 'REFUND:' || _refund_id::text,
    -_articles_refunded, -us, -e, _refund_id, _refund_id, o.id
  );

  RETURN jsonb_build_object(
    'balance', greatest(public.loyalty_balance_for(o.user_id), 0),
    'earned', -e,
    'used', -us
  );
END
$function$;

-- Preserve the append-only ledger: compensate affected full cancellations
-- instead of changing their original sale or refund rows.
WITH affected AS (
  SELECT
    o.id,
    o.user_id,
    o.points_used - coalesce(-sum(r.points_used), 0) AS missing_used,
    o.points_earned - coalesce(-sum(r.points_earned), 0) AS missing_earned
  FROM public.store_loyalty_transactions o
  JOIN public.store_loyalty_transactions r ON r.reverses_id = o.id
  WHERE o.source_sale_id IS NOT NULL
  GROUP BY o.id, o.user_id, o.articles_total, o.points_used, o.points_earned
  HAVING coalesce(-sum(r.articles_total), 0) = o.articles_total - o.points_used / 5.0
    AND (
      coalesce(-sum(r.points_used), 0) <> o.points_used
      OR coalesce(-sum(r.points_earned), 0) <> o.points_earned
    )
), corrections AS (
  SELECT *, gen_random_uuid() AS correction_id
  FROM affected
  WHERE missing_used <> 0 OR missing_earned <> 0
)
INSERT INTO public.store_loyalty_transactions(
  user_id, staff_id, staff_label, channel, receipt_reference,
  articles_total, points_used, points_earned, request_id, refund_id, reverses_id
)
SELECT
  user_id, NULL, 'Correction annulation complète', 'pos_refund_correction',
  'CORRECTION:' || correction_id::text, 0, -missing_used, -missing_earned,
  correction_id, correction_id, id
FROM corrections;

REVOKE ALL ON FUNCTION public.pos_reverse_sale(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_reverse_sale(uuid, uuid, numeric) TO service_role;