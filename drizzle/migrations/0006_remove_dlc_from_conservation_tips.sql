WITH cleaned AS (
  SELECT
    id,
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  conservation_tips,
                  '\s*,?\s*sans dépasser la (DLC|date limite|date indiquée)',
                  '',
                  'gi'
                ),
                '\s+avant la (DLC|date limite|date indiquée)',
                '',
                'gi'
              ),
              '\s+jusqu[''’]à la (DLC|date limite|date indiquée)',
              '',
              'gi'
            ),
            '\s+et respectez la (DLC|date limite|date indiquée)',
            '',
            'gi'
          ),
          '\s*,?\s*(selon|en suivant) la (DLC|date limite|date indiquée)',
          '',
          'gi'
        ),
        '\s*(Suivez|Respectez) toute date limite plus courte( sur l’étiquette)?\.',
        '',
        'gi'
      ),
      '\s{2,}',
      ' ',
      'g'
    ) AS tips
  FROM public.products
  WHERE conservation_tips IS NOT NULL
)
UPDATE public.products AS p
SET conservation_tips = NULLIF(BTRIM(c.tips), '')
FROM cleaned AS c
WHERE p.id = c.id
  AND p.conservation_tips IS DISTINCT FROM NULLIF(BTRIM(c.tips), '');