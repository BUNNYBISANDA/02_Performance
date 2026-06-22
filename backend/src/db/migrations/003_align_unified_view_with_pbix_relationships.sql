CREATE OR REPLACE FUNCTION o2.customer_display_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL OR btrim(value) = '' THEN NULL
    WHEN regexp_replace(upper(value), '[^A-Z0-9]+', '', 'g') LIKE '%TRAVISMATHEW%' THEN 'Travis Mathew'
    WHEN regexp_replace(upper(value), '[^A-Z0-9]+', '', 'g') LIKE '%LULULEMON%' THEN 'lululemon'
    WHEN regexp_replace(upper(value), '[^A-Z0-9]+', '', 'g') LIKE '%FANATICS%' THEN 'Fanatics'
    WHEN regexp_replace(upper(value), '[^A-Z0-9]+', '', 'g') LIKE '%ADIDAS%' THEN 'Adidas'
    WHEN regexp_replace(upper(value), '[^A-Z0-9]+', '', 'g') LIKE '%NIKE%' THEN 'Nike'
    ELSE btrim(value)
  END
$$;

DROP VIEW IF EXISTS o2.v_quality_filter_options;
DROP VIEW IF EXISTS o2.v_quality_defects_unified;

CREATE OR REPLACE VIEW o2.v_quality_defects_unified AS
WITH so_base_unique AS (
  SELECT DISTINCT ON (btrim(so_no_doc))
    btrim(so_no_doc) AS so_no_doc,
    btrim(so_no) AS so_no,
    btrim(so_year) AS so_year,
    btrim(cust_code) AS cust_code,
    btrim(cust_name) AS cust_name,
    btrim(style_code) AS style_code,
    btrim(style_ref) AS style_ref,
    btrim(brand_name) AS brand_name,
    shipment_date
  FROM o2.raw_mt_so_base
  WHERE NULLIF(btrim(so_no_doc), '') IS NOT NULL
  ORDER BY btrim(so_no_doc), shipment_date DESC NULLS LAST, imported_at DESC
),
mt_so_unique AS (
  SELECT DISTINCT ON (btrim(so_no_doc))
    btrim(so_no_doc) AS so_no_doc,
    btrim(brand) AS brand,
    btrim(style_ref) AS style_ref,
    shipment_date
  FROM o2.raw_mt_so
  WHERE NULLIF(btrim(so_no_doc), '') IS NOT NULL
  ORDER BY btrim(so_no_doc), shipment_date DESC NULLS LAST, imported_at DESC
),
fn_fg_unique AS (
  SELECT DISTINCT ON (btrim(so_no_doc))
    btrim(so_no_doc) AS so_no_doc,
    btrim(cust_name) AS cust_name,
    btrim(style_code) AS style_code,
    o2.factory_display_name(factory) AS factory,
    trx_date
  FROM o2.raw_data_fn_fg
  WHERE NULLIF(btrim(so_no_doc), '') IS NOT NULL
  ORDER BY btrim(so_no_doc), trx_date DESC NULLS LAST, imported_at DESC
),
defect_unique AS (
  SELECT DISTINCT ON (btrim(defect_code))
    btrim(defect_code) AS defect_code,
    btrim(defect_desc_eng) AS defect_desc_eng
  FROM o2.raw_mt_defect
  WHERE NULLIF(btrim(defect_code), '') IS NOT NULL
  ORDER BY btrim(defect_code), imported_at DESC
)
SELECT
  'Inline'::text AS inspection_stage,
  i.job_date AS inspection_date,
  o2.factory_display_name(i.id_bu) AS factory,
  o2.customer_display_name(COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name)) AS customer,
  NULLIF(btrim(i.so_no_doc), '') AS so_no_doc,
  NULLIF(btrim(i.so_no), '') AS so_no,
  NULLIF(btrim(i.so_year), '') AS so_year,
  COALESCE(NULLIF(ms.style_ref, ''), NULLIF(sb.style_code, ''), NULLIF(ff.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(btrim(i.fac_line), ''), NULLIF(btrim(i.line_no), '')) AS fac_line,
  NULLIF(btrim(i.defect_code), '') AS defect_code,
  COALESCE(NULLIF(btrim(i.defect_desc_eng), ''), NULLIF(d.defect_desc_eng, '')) AS defect_desc_eng,
  CASE
    WHEN NULLIF(btrim(COALESCE(i.defect_code, i.defect_desc_eng, '')), '') IS NULL THEN 0::numeric
    ELSE COALESCE(i.cnt_failed, 0)::numeric
  END AS defect_qty,
  NULL::numeric AS inspected_qty,
  CASE
    WHEN NULLIF(btrim(COALESCE(i.defect_code, i.defect_desc_eng, '')), '') IS NULL THEN NULL::numeric
    ELSE COALESCE(i.total_inspect, 0)::numeric
  END AS process_checks,
  concat_ws('|', 'inline', NULLIF(btrim(i.so_no_doc), ''), COALESCE(NULLIF(btrim(i.fac_line), ''), NULLIF(btrim(i.line_no), ''))) AS denominator_key,
  'raw_data_inline'::text AS source_table,
  CASE
    WHEN ms.brand IS NOT NULL THEN 'mt_so'
    WHEN sb.brand_name IS NOT NULL OR sb.cust_name IS NOT NULL THEN 'mt_so_base'
    WHEN ff.cust_name IS NOT NULL THEN 'data_fn_fg'
    ELSE NULL
  END AS customer_source,
  COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name) AS raw_customer
FROM o2.raw_data_inline i
LEFT JOIN mt_so_unique ms ON ms.so_no_doc = btrim(i.so_no_doc)
LEFT JOIN so_base_unique sb ON sb.so_no_doc = btrim(i.so_no_doc)
LEFT JOIN fn_fg_unique ff ON ff.so_no_doc = btrim(i.so_no_doc)
LEFT JOIN defect_unique d ON d.defect_code = btrim(i.defect_code)

UNION ALL

SELECT
  'Endline'::text AS inspection_stage,
  e.job_date AS inspection_date,
  o2.factory_display_name(e.location_code) AS factory,
  o2.customer_display_name(COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name)) AS customer,
  NULLIF(btrim(e.so_no_doc), '') AS so_no_doc,
  NULLIF(btrim(e.so_no), '') AS so_no,
  NULLIF(btrim(e.so_year::text), '') AS so_year,
  COALESCE(NULLIF(ms.style_ref, ''), NULLIF(sb.style_code, ''), NULLIF(ff.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(btrim(e.fac_line), ''), NULLIF(btrim(e.line_name), '')) AS fac_line,
  NULLIF(btrim(e.defect_code), '') AS defect_code,
  NULLIF(d.defect_desc_eng, '') AS defect_desc_eng,
  CASE
    WHEN NULLIF(btrim(e.defect_code), '') IS NULL THEN 0::numeric
    ELSE COALESCE(e.defect_point, 0)::numeric
  END AS defect_qty,
  COALESCE(e.total_inspect, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  concat_ws('|', 'endline', e.job_date::text, NULLIF(btrim(e.so_no_doc), ''), COALESCE(NULLIF(btrim(e.fac_line), ''), NULLIF(btrim(e.line_name), ''))) AS denominator_key,
  'raw_data_endline'::text AS source_table,
  CASE
    WHEN ms.brand IS NOT NULL THEN 'mt_so'
    WHEN sb.brand_name IS NOT NULL OR sb.cust_name IS NOT NULL THEN 'mt_so_base'
    WHEN ff.cust_name IS NOT NULL THEN 'data_fn_fg'
    ELSE NULL
  END AS customer_source,
  COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name) AS raw_customer
FROM o2.raw_data_endline e
LEFT JOIN mt_so_unique ms ON ms.so_no_doc = btrim(e.so_no_doc)
LEFT JOIN so_base_unique sb ON sb.so_no_doc = btrim(e.so_no_doc)
LEFT JOIN fn_fg_unique ff ON ff.so_no_doc = btrim(e.so_no_doc)
LEFT JOIN defect_unique d ON d.defect_code = btrim(e.defect_code)

UNION ALL

SELECT
  'Pre Final'::text AS inspection_stage,
  p.job_date AS inspection_date,
  o2.factory_display_name(p.location_code) AS factory,
  o2.customer_display_name(COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name)) AS customer,
  NULLIF(btrim(p.so_no_doc), '') AS so_no_doc,
  NULLIF(btrim(p.so_no), '') AS so_no,
  NULLIF(btrim(p.so_year), '') AS so_year,
  COALESCE(NULLIF(ms.style_ref, ''), NULLIF(sb.style_code, ''), NULLIF(ff.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(btrim(p.fac_line), ''), NULLIF(btrim(p.line_name), '')) AS fac_line,
  NULLIF(btrim(p.defect_codes), '') AS defect_code,
  COALESCE(NULLIF(d.defect_desc_eng, ''), NULLIF(btrim(p.defect_descs), '')) AS defect_desc_eng,
  CASE
    WHEN NULLIF(btrim(p.defect_codes), '') IS NULL THEN 0::numeric
    ELSE COALESCE(p.total_defects, 0)::numeric
  END AS defect_qty,
  CASE
    WHEN NULLIF(btrim(p.defect_codes), '') IS NULL THEN NULL::numeric
    ELSE COALESCE(p.total_inspect, 0)::numeric
  END AS inspected_qty,
  NULL::numeric AS process_checks,
  concat_ws('|', 'prefinal', p.job_date::text, NULLIF(btrim(p.so_no_doc), ''), COALESCE(NULLIF(btrim(p.fac_line), ''), NULLIF(btrim(p.line_name), ''))) AS denominator_key,
  'raw_data_prefinal'::text AS source_table,
  CASE
    WHEN ms.brand IS NOT NULL THEN 'mt_so'
    WHEN sb.brand_name IS NOT NULL OR sb.cust_name IS NOT NULL THEN 'mt_so_base'
    WHEN ff.cust_name IS NOT NULL THEN 'data_fn_fg'
    ELSE NULL
  END AS customer_source,
  COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name) AS raw_customer
FROM o2.raw_data_prefinal p
LEFT JOIN mt_so_unique ms ON ms.so_no_doc = btrim(p.so_no_doc)
LEFT JOIN so_base_unique sb ON sb.so_no_doc = btrim(p.so_no_doc)
LEFT JOIN fn_fg_unique ff ON ff.so_no_doc = btrim(p.so_no_doc)
LEFT JOIN defect_unique d ON d.defect_code = btrim(p.defect_codes)

UNION ALL

SELECT
  'Final'::text AS inspection_stage,
  f."date" AS inspection_date,
  o2.factory_display_name(f.factory) AS factory,
  o2.customer_display_name(COALESCE(f.customer_brand, ms.brand, sb.brand_name, sb.cust_name, ff.cust_name, f.cust_code)) AS customer,
  NULLIF(btrim(f.so_no_doc), '') AS so_no_doc,
  NULLIF(btrim(f.so_no), '') AS so_no,
  NULLIF(btrim(f.so_year), '') AS so_year,
  COALESCE(NULLIF(btrim(f.style_no), ''), NULLIF(ms.style_ref, ''), NULLIF(sb.style_code, ''), NULLIF(ff.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(btrim(f.fac_line), ''), NULLIF(btrim(f.sewing_line_no), '')) AS fac_line,
  NULLIF(btrim(f.defect_code), '') AS defect_code,
  COALESCE(NULLIF(d.defect_desc_eng, ''), NULLIF(btrim(f.defect_desc), '')) AS defect_desc_eng,
  CASE
    WHEN NULLIF(btrim(COALESCE(f.defect_code, f.defect_desc, '')), '') IS NULL THEN 0::numeric
    ELSE COALESCE(f.defect_qty, f.total_defect_found, 0)::numeric
  END AS defect_qty,
  COALESCE(f.total_garment_inspected, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  concat_ws('|', 'final', f."date"::text, NULLIF(btrim(f.so_no_doc), ''), COALESCE(NULLIF(btrim(f.fac_line), ''), NULLIF(btrim(f.sewing_line_no), ''))) AS denominator_key,
  'raw_data_final'::text AS source_table,
  CASE
    WHEN f.customer_brand IS NOT NULL THEN 'data_final'
    WHEN ms.brand IS NOT NULL THEN 'mt_so'
    WHEN sb.brand_name IS NOT NULL OR sb.cust_name IS NOT NULL THEN 'mt_so_base'
    WHEN ff.cust_name IS NOT NULL THEN 'data_fn_fg'
    WHEN f.cust_code IS NOT NULL THEN 'data_final_cust_code'
    ELSE NULL
  END AS customer_source,
  COALESCE(f.customer_brand, ms.brand, sb.brand_name, sb.cust_name, ff.cust_name, f.cust_code) AS raw_customer
FROM o2.raw_data_final f
LEFT JOIN mt_so_unique ms ON ms.so_no_doc = btrim(f.so_no_doc)
LEFT JOIN so_base_unique sb ON sb.so_no_doc = btrim(f.so_no_doc)
LEFT JOIN fn_fg_unique ff ON ff.so_no_doc = btrim(f.so_no_doc)
LEFT JOIN defect_unique d ON d.defect_code = btrim(f.defect_code)

UNION ALL

SELECT
  'Third Party'::text AS inspection_stage,
  t."date" AS inspection_date,
  o2.factory_display_name(
    CASE
      WHEN COALESCE(NULLIF(btrim(t.fac_line), ''), bl.fac_line) ~ '^[A-Za-z0-9]+[-_]'
        THEN regexp_replace(COALESCE(NULLIF(btrim(t.fac_line), ''), bl.fac_line), '[-_].*$', '')
      ELSE ff.factory
    END
  ) AS factory,
  o2.customer_display_name(COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name)) AS customer,
  NULLIF(btrim(t.so_no_doc), '') AS so_no_doc,
  NULLIF(btrim(t.so_no), '') AS so_no,
  NULLIF(btrim(t.so_year), '') AS so_year,
  COALESCE(NULLIF(btrim(t.style), ''), NULLIF(ms.style_ref, ''), NULLIF(sb.style_code, ''), NULLIF(ff.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(btrim(t.fac_line), ''), bl.fac_line, NULLIF(btrim(t.line), '')) AS fac_line,
  NULLIF(btrim(t.code), '') AS defect_code,
  COALESCE(NULLIF(d.defect_desc_eng, ''), NULLIF(btrim(t.code), '')) AS defect_desc_eng,
  CASE
    WHEN NULLIF(btrim(t.code), '') IS NULL THEN 0::numeric
    ELSE COALESCE(t.defect_qty, 0)::numeric
  END AS defect_qty,
  COALESCE(t.inspect_qty, t.total, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  concat_ws('|', 'thirdparty', t."date"::text, NULLIF(btrim(t.so_no_doc), ''), NULLIF(btrim(t.color), ''), NULLIF(btrim(t.audit), ''), COALESCE(NULLIF(btrim(t.fac_line), ''), bl.fac_line)) AS denominator_key,
  'raw_data_3party'::text AS source_table,
  CASE
    WHEN ms.brand IS NOT NULL THEN 'mt_so'
    WHEN sb.brand_name IS NOT NULL OR sb.cust_name IS NOT NULL THEN 'mt_so_base'
    WHEN ff.cust_name IS NOT NULL THEN 'data_fn_fg'
    ELSE NULL
  END AS customer_source,
  COALESCE(ms.brand, sb.brand_name, sb.cust_name, ff.cust_name) AS raw_customer
FROM o2.raw_data_3party t
LEFT JOIN mt_so_unique ms ON ms.so_no_doc = btrim(t.so_no_doc)
LEFT JOIN so_base_unique sb ON sb.so_no_doc = btrim(t.so_no_doc)
LEFT JOIN fn_fg_unique ff ON ff.so_no_doc = btrim(t.so_no_doc)
LEFT JOIN defect_unique d ON d.defect_code = btrim(t.code)
LEFT JOIN LATERAL (
  SELECT btrim(b.fac_line) AS fac_line
  FROM o2.raw_bridge_so_line b
  WHERE btrim(b.so_no_doc) = btrim(t.so_no_doc)
  ORDER BY
    CASE
      WHEN NULLIF(btrim(t.fac_line), '') IS NOT NULL AND btrim(b.fac_line) = btrim(t.fac_line) THEN 0
      ELSE 1
    END,
    btrim(b.fac_line)
  LIMIT 1
) bl ON true;

CREATE OR REPLACE VIEW o2.v_quality_filter_options AS
SELECT DISTINCT
  customer,
  factory,
  so_no_doc,
  style,
  fac_line,
  defect_desc_eng,
  inspection_stage
FROM o2.v_quality_defects_unified;
