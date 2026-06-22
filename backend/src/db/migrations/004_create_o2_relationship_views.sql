DROP VIEW IF EXISTS o2.v_quality_filter_options;
DROP VIEW IF EXISTS o2.v_quality_denominators_unified;
DROP VIEW IF EXISTS o2.v_third_party_denominator;
DROP VIEW IF EXISTS o2.v_final_denominator;
DROP VIEW IF EXISTS o2.v_prefinal_denominator;
DROP VIEW IF EXISTS o2.v_endline_denominator;
DROP VIEW IF EXISTS o2.v_inline_denominator;
DROP VIEW IF EXISTS o2.v_quality_defects_unified;
DROP VIEW IF EXISTS o2.v_scan_qty;
DROP VIEW IF EXISTS o2.v_fact_third_party;
DROP VIEW IF EXISTS o2.v_fact_final;
DROP VIEW IF EXISTS o2.v_fact_prefinal;
DROP VIEW IF EXISTS o2.v_fact_endline;
DROP VIEW IF EXISTS o2.v_fact_inline;
DROP VIEW IF EXISTS o2.v_dim_date;
DROP VIEW IF EXISTS o2.v_dim_factory;
DROP VIEW IF EXISTS o2.v_dim_department;
DROP VIEW IF EXISTS o2.v_dim_defect;
DROP VIEW IF EXISTS o2.v_dim_so;

CREATE OR REPLACE FUNCTION o2.clean_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(value), '')
$$;

CREATE OR REPLACE FUNCTION o2.so_fact_key(so_no_doc text, so_year text, so_no text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    CASE
      WHEN o2.clean_text(so_year) IS NOT NULL AND o2.clean_text(so_no) IS NOT NULL
        THEN o2.clean_text(so_year) || o2.clean_text(so_no)
      ELSE NULL
    END,
    o2.clean_text(so_no_doc)
  )
$$;

CREATE OR REPLACE VIEW o2.v_dim_so AS
WITH so_base AS (
  SELECT DISTINCT ON (o2.so_fact_key(so_no_doc, so_year, so_no))
    o2.so_fact_key(so_no_doc, so_year, so_no) AS so_no_doc,
    o2.clean_text(so_no_doc) AS source_so_no_doc,
    o2.clean_text(so_no) AS so_no,
    o2.clean_text(so_year) AS so_year,
    o2.customer_display_name(cust_name) AS customer,
    o2.clean_text(cust_code) AS cust_code,
    o2.clean_text(style_code) AS style_code,
    o2.clean_text(style_ref) AS style_ref,
    shipment_date
  FROM o2.raw_mt_so_base
  WHERE o2.so_fact_key(so_no_doc, so_year, so_no) IS NOT NULL
  ORDER BY o2.so_fact_key(so_no_doc, so_year, so_no), shipment_date DESC NULLS LAST, imported_at DESC
),
mt_so AS (
  SELECT DISTINCT ON (btrim(so_no_doc))
    btrim(so_no_doc) AS so_no_doc,
    o2.customer_display_name(brand) AS brand_customer,
    o2.clean_text(style_ref) AS mt_style_ref,
    shipment_date AS mt_shipment_date
  FROM o2.raw_mt_so
  WHERE o2.clean_text(so_no_doc) IS NOT NULL
  ORDER BY btrim(so_no_doc), shipment_date DESC NULLS LAST, imported_at DESC
)
SELECT
  COALESCE(sb.so_no_doc, ms.so_no_doc) AS so_no_doc,
  sb.so_no,
  sb.so_year,
  COALESCE(ms.brand_customer, sb.customer, 'Unknown Customer') AS customer,
  sb.cust_code,
  sb.style_code,
  COALESCE(sb.style_ref, ms.mt_style_ref) AS style_ref,
  COALESCE(sb.shipment_date, ms.mt_shipment_date) AS shipment_date
FROM so_base sb
FULL OUTER JOIN mt_so ms ON ms.so_no_doc = sb.so_no_doc;

COMMENT ON FUNCTION o2.so_fact_key(text, text, text) IS
  'Canonical SO relationship key for the imported PBIX export. raw_mt_so_base.so_no_doc includes an OU prefix in this workbook; fact tables and raw_mt_so use so_year || so_no.';

COMMENT ON VIEW o2.v_dim_so IS
  'SO dimension uses the canonical fact-compatible SO key. Customer display prioritizes raw_mt_so.brand because the PBIX dashboard customer slicer uses brand labels such as Travis Mathew, while raw_mt_so_base.cust_name can contain legal/customer names.';

CREATE INDEX IF NOT EXISTS idx_o2_mt_so_base_so_fact_key
  ON o2.raw_mt_so_base (o2.so_fact_key(so_no_doc, so_year, so_no));
CREATE INDEX IF NOT EXISTS idx_o2_mt_so_so_no_doc_clean
  ON o2.raw_mt_so (o2.clean_text(so_no_doc));
CREATE INDEX IF NOT EXISTS idx_o2_mt_defect_defect_code_clean
  ON o2.raw_mt_defect (o2.clean_text(defect_code));
CREATE INDEX IF NOT EXISTS idx_o2_bridge_so_line_so_no_doc_clean
  ON o2.raw_bridge_so_line (o2.clean_text(so_no_doc));
CREATE INDEX IF NOT EXISTS idx_o2_department_fac_line_clean
  ON o2.raw_mt_department (o2.clean_text(fac_line));
CREATE INDEX IF NOT EXISTS idx_o2_department_location_line_clean
  ON o2.raw_mt_department (o2.clean_text(location_code), o2.clean_text(line_name));
CREATE INDEX IF NOT EXISTS idx_o2_factory_source_codes_clean
  ON o2.raw_mt_factory (o2.clean_text(factory), o2.clean_text(factory_fi), o2.clean_text(factoryg));

CREATE INDEX IF NOT EXISTS idx_o2_data_inline_relationship_keys
  ON o2.raw_data_inline (job_date, o2.clean_text(so_no_doc), o2.clean_text(defect_code), o2.clean_text(id_bu), o2.clean_text(fac_line));
CREATE INDEX IF NOT EXISTS idx_o2_data_inline_location_line_clean
  ON o2.raw_data_inline (o2.clean_text(id_bu), o2.clean_text(line_no));

CREATE INDEX IF NOT EXISTS idx_o2_data_endline_relationship_keys
  ON o2.raw_data_endline (job_date, o2.clean_text(so_no_doc), o2.clean_text(defect_code), o2.clean_text(location_code), o2.clean_text(fac_line));
CREATE INDEX IF NOT EXISTS idx_o2_data_endline_location_line_clean
  ON o2.raw_data_endline (o2.clean_text(location_code), o2.clean_text(line_name));

CREATE INDEX IF NOT EXISTS idx_o2_data_prefinal_relationship_keys
  ON o2.raw_data_prefinal (job_date, o2.clean_text(so_no_doc), o2.clean_text(defect_codes), o2.clean_text(location_code), o2.clean_text(fac_line));
CREATE INDEX IF NOT EXISTS idx_o2_data_prefinal_location_line_clean
  ON o2.raw_data_prefinal (o2.clean_text(location_code), o2.clean_text(line_name));

CREATE INDEX IF NOT EXISTS idx_o2_data_final_relationship_keys
  ON o2.raw_data_final ("date", o2.clean_text(so_no_doc), o2.clean_text(defect_code), o2.clean_text(factory), o2.clean_text(fac_line));

CREATE INDEX IF NOT EXISTS idx_o2_data_3party_relationship_keys
  ON o2.raw_data_3party ("date", o2.clean_text(so_no_doc), o2.clean_text(code), o2.clean_text(fac_line));

CREATE INDEX IF NOT EXISTS idx_o2_data_fn_fg_relationship_keys
  ON o2.raw_data_fn_fg (trx_date, o2.clean_text(so_no_doc), o2.clean_text(factory), o2.clean_text(step));

CREATE OR REPLACE VIEW o2.v_dim_defect AS
SELECT DISTINCT ON (btrim(defect_code))
  btrim(defect_code) AS defect_code,
  COALESCE(o2.clean_text(defect_desc_eng), 'Unknown Defect') AS defect_desc_eng,
  o2.clean_text(defect_grp_code) AS defect_grp_code,
  o2.clean_text(defect_grp_problem) AS defect_grp_problem,
  o2.clean_text(type_top) AS type_top,
  o2.clean_text(type_bottom) AS type_bottom,
  o2.clean_text(color) AS color,
  o2.clean_text(active) AS active
FROM o2.raw_mt_defect
WHERE o2.clean_text(defect_code) IS NOT NULL
ORDER BY btrim(defect_code), imported_at DESC;

CREATE OR REPLACE VIEW o2.v_dim_department AS
SELECT DISTINCT ON (
  COALESCE(o2.clean_text(location_code), ''),
  COALESCE(o2.clean_text(line_name), ''),
  COALESCE(o2.clean_text(fac_line), '')
)
  o2.clean_text(location_code) AS location_code,
  o2.clean_text(line_name) AS line_name,
  o2.clean_text(fac_line) AS fac_line,
  o2.clean_text(sub_department) AS sub_department,
  o2.clean_text(department_head) AS department_head
FROM o2.raw_mt_department
ORDER BY
  COALESCE(o2.clean_text(location_code), ''),
  COALESCE(o2.clean_text(line_name), ''),
  COALESCE(o2.clean_text(fac_line), ''),
  imported_at DESC;

CREATE OR REPLACE VIEW o2.v_dim_factory AS
WITH source_codes AS (
  SELECT
    o2.clean_text(factory) AS factory_source_code,
    o2.clean_text(factory) AS factory_display,
    o2.clean_text(bu) AS bu,
    o2.clean_text(factoryg) AS factory_group,
    o2.clean_text(factory_fi) AS factory_fi,
    1 AS priority
  FROM o2.raw_mt_factory
  UNION ALL
  SELECT
    o2.clean_text(factory_fi) AS factory_source_code,
    o2.clean_text(factory) AS factory_display,
    o2.clean_text(bu) AS bu,
    o2.clean_text(factoryg) AS factory_group,
    o2.clean_text(factory_fi) AS factory_fi,
    2 AS priority
  FROM o2.raw_mt_factory
  UNION ALL
  SELECT
    o2.clean_text(factoryg) AS factory_source_code,
    o2.clean_text(factory) AS factory_display,
    o2.clean_text(bu) AS bu,
    o2.clean_text(factoryg) AS factory_group,
    o2.clean_text(factory_fi) AS factory_fi,
    3 AS priority
  FROM o2.raw_mt_factory
)
SELECT DISTINCT ON (factory_source_code)
  factory_source_code,
  factory_display,
  bu,
  factory_group,
  factory_fi
FROM source_codes
WHERE factory_source_code IS NOT NULL
ORDER BY factory_source_code, priority;

COMMENT ON VIEW o2.v_dim_factory IS
  'Factory mapping uses raw_mt_factory.factory as dashboard display. factory_fi maps NYG1/NYG2/NYG4 source codes back to G1/G2/G4; factoryg is kept as a lower-priority source-code alias.';

CREATE OR REPLACE VIEW o2.v_dim_date AS
WITH bounds AS (
  SELECT MIN(dt)::date AS min_date, MAX(dt)::date AS max_date
  FROM (
    SELECT job_date AS dt FROM o2.raw_data_inline
    UNION ALL SELECT job_date FROM o2.raw_data_endline
    UNION ALL SELECT job_date FROM o2.raw_data_prefinal
    UNION ALL SELECT "date" FROM o2.raw_data_final
    UNION ALL SELECT "date" FROM o2.raw_data_3party
    UNION ALL SELECT trx_date FROM o2.raw_data_fn_fg
    UNION ALL SELECT shipment_date FROM o2.raw_mt_so_base
  ) dates
  WHERE dt IS NOT NULL
)
SELECT
  generated_date::date AS date,
  EXTRACT(day FROM generated_date)::int AS day,
  to_char(generated_date, 'FMDay') AS day_name,
  EXTRACT(month FROM generated_date)::int AS month_number,
  to_char(generated_date, 'Mon') AS month_name,
  to_char(generated_date, 'IYYY-"W"IW') AS iso_week,
  EXTRACT(isoyear FROM generated_date)::int AS iso_year,
  EXTRACT(year FROM generated_date)::int AS year
FROM bounds
CROSS JOIN generate_series(bounds.min_date, bounds.max_date, interval '1 day') AS generated_date;

CREATE OR REPLACE VIEW o2.v_fact_inline AS
WITH source_rows AS (
  SELECT
    i.id,
    'Inline'::text AS inspection_stage,
    i.job_date AS inspection_date,
    o2.clean_text(i.id_bu) AS factory_source_code,
    COALESCE(df.factory_display, o2.clean_text(i.id_bu), 'Unknown Factory') AS factory_display,
    COALESCE(ds.customer, 'Unknown Customer') AS customer,
    ds.cust_code,
    o2.clean_text(i.so_no_doc) AS so_no_doc,
    COALESCE(o2.clean_text(i.so_no), ds.so_no) AS so_no,
    COALESCE(o2.clean_text(i.so_year), ds.so_year) AS so_year,
    COALESCE(ds.style_code, ds.style_ref) AS style,
    ds.style_ref,
    COALESCE(o2.clean_text(i.fac_line), bl.fac_line, dep.fac_line, o2.clean_text(i.line_no), 'Unknown Line') AS fac_line,
    o2.clean_text(i.defect_code) AS defect_code,
    COALESCE(dd.defect_desc_eng, o2.clean_text(i.defect_desc_eng), o2.clean_text(i.defect_code), 'Unknown Defect') AS defect_desc_eng,
    CASE
      WHEN o2.clean_text(i.defect_code) IS NOT NULL THEN COALESCE(i.cnt_failed, 0)::numeric
      ELSE 0::numeric
    END AS defect_qty,
    NULL::numeric AS inspected_qty_raw,
    COALESCE(i.total_inspect, 0)::numeric AS process_checks_raw,
    concat_ws('|', 'inline', COALESCE(o2.clean_text(i.so_no_doc), 'row-' || i.id::text), COALESCE(o2.clean_text(i.fac_line), bl.fac_line, dep.fac_line, o2.clean_text(i.line_no), 'Unknown Line')) AS denominator_key
  FROM o2.raw_data_inline i
  LEFT JOIN o2.v_dim_so ds ON ds.so_no_doc = o2.clean_text(i.so_no_doc)
  LEFT JOIN o2.v_dim_defect dd ON dd.defect_code = o2.clean_text(i.defect_code)
  LEFT JOIN o2.v_dim_factory df ON df.factory_source_code = o2.clean_text(i.id_bu)
  LEFT JOIN LATERAL (
    SELECT o2.clean_text(b.fac_line) AS fac_line
    FROM o2.raw_bridge_so_line b
    WHERE o2.clean_text(b.so_no_doc) = o2.clean_text(i.so_no_doc)
    ORDER BY o2.clean_text(b.fac_line)
    LIMIT 1
  ) bl ON true
  LEFT JOIN LATERAL (
    SELECT d.fac_line
    FROM o2.v_dim_department d
    WHERE d.location_code = o2.clean_text(i.id_bu)
      AND d.line_name = o2.clean_text(i.line_no)
    ORDER BY d.fac_line
    LIMIT 1
  ) dep ON true
)
SELECT
  inspection_stage,
  inspection_date,
  EXTRACT(year FROM inspection_date)::int AS year,
  EXTRACT(month FROM inspection_date)::int AS month_number,
  to_char(inspection_date, 'Mon') AS month_name,
  to_char(inspection_date, 'IYYY-"W"IW') AS iso_week,
  factory_source_code,
  factory_display,
  factory_display AS factory,
  customer,
  cust_code,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  fac_line AS fac_line_normalized,
  defect_code,
  defect_desc_eng,
  defect_qty,
  inspected_qty_raw AS inspected_qty,
  process_checks_raw AS process_checks,
  denominator_key,
  'raw_data_inline'::text AS source_table
FROM source_rows;

CREATE OR REPLACE VIEW o2.v_fact_endline AS
WITH source_rows AS (
  SELECT
    e.id,
    'Endline'::text AS inspection_stage,
    e.job_date AS inspection_date,
    o2.clean_text(e.location_code) AS factory_source_code,
    COALESCE(df.factory_display, o2.clean_text(e.location_code), 'Unknown Factory') AS factory_display,
    COALESCE(ds.customer, 'Unknown Customer') AS customer,
    ds.cust_code,
    o2.clean_text(e.so_no_doc) AS so_no_doc,
    COALESCE(o2.clean_text(e.so_no), ds.so_no) AS so_no,
    COALESCE(o2.clean_text(e.so_year::text), ds.so_year) AS so_year,
    COALESCE(ds.style_code, ds.style_ref) AS style,
    ds.style_ref,
    COALESCE(o2.clean_text(e.fac_line), bl.fac_line, dep.fac_line, o2.clean_text(e.line_name), 'Unknown Line') AS fac_line,
    o2.clean_text(e.defect_code) AS defect_code,
    COALESCE(dd.defect_desc_eng, o2.clean_text(e.defect_code), 'Unknown Defect') AS defect_desc_eng,
    CASE
      WHEN o2.clean_text(e.defect_code) IS NOT NULL THEN COALESCE(e.defect_point, 0)::numeric
      ELSE 0::numeric
    END AS defect_qty,
    COALESCE(e.total_inspect, 0)::numeric AS inspected_qty_raw,
    NULL::numeric AS process_checks_raw,
    concat_ws('|', 'endline', e.job_date::text, COALESCE(o2.clean_text(e.so_no_doc), 'row-' || e.id::text), COALESCE(o2.clean_text(e.fac_line), bl.fac_line, dep.fac_line, o2.clean_text(e.line_name), 'Unknown Line')) AS denominator_key
  FROM o2.raw_data_endline e
  LEFT JOIN o2.v_dim_so ds ON ds.so_no_doc = o2.clean_text(e.so_no_doc)
  LEFT JOIN o2.v_dim_defect dd ON dd.defect_code = o2.clean_text(e.defect_code)
  LEFT JOIN o2.v_dim_factory df ON df.factory_source_code = o2.clean_text(e.location_code)
  LEFT JOIN LATERAL (
    SELECT o2.clean_text(b.fac_line) AS fac_line
    FROM o2.raw_bridge_so_line b
    WHERE o2.clean_text(b.so_no_doc) = o2.clean_text(e.so_no_doc)
    ORDER BY o2.clean_text(b.fac_line)
    LIMIT 1
  ) bl ON true
  LEFT JOIN LATERAL (
    SELECT d.fac_line
    FROM o2.v_dim_department d
    WHERE d.location_code = o2.clean_text(e.location_code)
      AND d.line_name = o2.clean_text(e.line_name)
    ORDER BY d.fac_line
    LIMIT 1
  ) dep ON true
)
SELECT
  inspection_stage,
  inspection_date,
  EXTRACT(year FROM inspection_date)::int AS year,
  EXTRACT(month FROM inspection_date)::int AS month_number,
  to_char(inspection_date, 'Mon') AS month_name,
  to_char(inspection_date, 'IYYY-"W"IW') AS iso_week,
  factory_source_code,
  factory_display,
  factory_display AS factory,
  customer,
  cust_code,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  fac_line AS fac_line_normalized,
  defect_code,
  defect_desc_eng,
  defect_qty,
  inspected_qty_raw AS inspected_qty,
  process_checks_raw AS process_checks,
  denominator_key,
  'raw_data_endline'::text AS source_table
FROM source_rows;

CREATE OR REPLACE VIEW o2.v_fact_prefinal AS
WITH source_rows AS (
  SELECT
    p.id,
    'Pre Final'::text AS inspection_stage,
    p.job_date AS inspection_date,
    o2.clean_text(p.location_code) AS factory_source_code,
    COALESCE(df.factory_display, o2.clean_text(p.location_code), 'Unknown Factory') AS factory_display,
    COALESCE(ds.customer, 'Unknown Customer') AS customer,
    ds.cust_code,
    o2.clean_text(p.so_no_doc) AS so_no_doc,
    COALESCE(o2.clean_text(p.so_no), ds.so_no) AS so_no,
    COALESCE(o2.clean_text(p.so_year), ds.so_year) AS so_year,
    COALESCE(ds.style_code, ds.style_ref) AS style,
    ds.style_ref,
    COALESCE(o2.clean_text(p.fac_line), bl.fac_line, dep.fac_line, o2.clean_text(p.line_name), 'Unknown Line') AS fac_line,
    o2.clean_text(p.defect_codes) AS defect_code,
    COALESCE(dd.defect_desc_eng, o2.clean_text(p.defect_descs), o2.clean_text(p.defect_codes), 'Unknown Defect') AS defect_desc_eng,
    CASE
      WHEN o2.clean_text(p.defect_codes) IS NOT NULL THEN COALESCE(p.total_defects, 0)::numeric
      ELSE 0::numeric
    END AS defect_qty,
    COALESCE(p.total_inspect, 0)::numeric AS inspected_qty_raw,
    NULL::numeric AS process_checks_raw,
    concat_ws('|', 'prefinal', COALESCE(o2.clean_text(p.so_no_doc), 'row-' || p.id::text)) AS denominator_key
  FROM o2.raw_data_prefinal p
  LEFT JOIN o2.v_dim_so ds ON ds.so_no_doc = o2.clean_text(p.so_no_doc)
  LEFT JOIN o2.v_dim_defect dd ON dd.defect_code = o2.clean_text(p.defect_codes)
  LEFT JOIN o2.v_dim_factory df ON df.factory_source_code = o2.clean_text(p.location_code)
  LEFT JOIN LATERAL (
    SELECT o2.clean_text(b.fac_line) AS fac_line
    FROM o2.raw_bridge_so_line b
    WHERE o2.clean_text(b.so_no_doc) = o2.clean_text(p.so_no_doc)
    ORDER BY o2.clean_text(b.fac_line)
    LIMIT 1
  ) bl ON true
  LEFT JOIN LATERAL (
    SELECT d.fac_line
    FROM o2.v_dim_department d
    WHERE d.location_code = o2.clean_text(p.location_code)
      AND d.line_name = o2.clean_text(p.line_name)
    ORDER BY d.fac_line
    LIMIT 1
  ) dep ON true
)
SELECT
  inspection_stage,
  inspection_date,
  EXTRACT(year FROM inspection_date)::int AS year,
  EXTRACT(month FROM inspection_date)::int AS month_number,
  to_char(inspection_date, 'Mon') AS month_name,
  to_char(inspection_date, 'IYYY-"W"IW') AS iso_week,
  factory_source_code,
  factory_display,
  factory_display AS factory,
  customer,
  cust_code,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  fac_line AS fac_line_normalized,
  defect_code,
  defect_desc_eng,
  defect_qty,
  inspected_qty_raw AS inspected_qty,
  process_checks_raw AS process_checks,
  denominator_key,
  'raw_data_prefinal'::text AS source_table
FROM source_rows;

CREATE OR REPLACE VIEW o2.v_fact_final AS
WITH source_rows AS (
  SELECT
    f.id,
    'Final'::text AS inspection_stage,
    f."date" AS inspection_date,
    o2.clean_text(f.factory) AS factory_source_code,
    COALESCE(df.factory_display, o2.clean_text(f.factory), 'Unknown Factory') AS factory_display,
    COALESCE(o2.customer_display_name(f.customer_brand), ds.customer, o2.customer_display_name(f.cust_code), 'Unknown Customer') AS customer,
    COALESCE(ds.cust_code, o2.clean_text(f.cust_code)) AS cust_code,
    o2.clean_text(f.so_no_doc) AS so_no_doc,
    COALESCE(o2.clean_text(f.so_no), ds.so_no) AS so_no,
    COALESCE(o2.clean_text(f.so_year), ds.so_year) AS so_year,
    COALESCE(o2.clean_text(f.style_no), ds.style_code, ds.style_ref) AS style,
    ds.style_ref,
    COALESCE(o2.clean_text(f.fac_line), dep.fac_line, o2.clean_text(f.sewing_line_no), 'Unknown Line') AS fac_line,
    o2.clean_text(f.defect_code) AS defect_code,
    COALESCE(dd.defect_desc_eng, o2.clean_text(f.defect_desc), o2.clean_text(f.defect_code), 'Unknown Defect') AS defect_desc_eng,
    COALESCE(f.defect_qty, 0)::numeric AS defect_qty,
    COALESCE(f.total_garment_inspected, 0)::numeric AS inspected_qty_raw,
    NULL::numeric AS process_checks_raw,
    concat_ws(
      '|',
      'final',
      f."date"::text,
      COALESCE(o2.clean_text(f.sewing_line_no), o2.clean_text(f.fac_line), dep.fac_line, 'Unknown Line'),
      COALESCE(o2.clean_text(f.so_no_doc), 'row-' || f.id::text),
      COALESCE(f.order_quantity_pcs::text, 'Unknown Order Qty'),
      COALESCE(o2.clean_text(f.type_of_inspection), 'Unknown Inspection Type'),
      COALESCE(o2.clean_text(f.color), 'Unknown Color')
    ) AS denominator_key
  FROM o2.raw_data_final f
  LEFT JOIN o2.v_dim_so ds ON ds.so_no_doc = o2.clean_text(f.so_no_doc)
  LEFT JOIN o2.v_dim_defect dd ON dd.defect_code = o2.clean_text(f.defect_code)
  LEFT JOIN o2.v_dim_factory df ON df.factory_source_code = o2.clean_text(f.factory)
  LEFT JOIN LATERAL (
    SELECT d.fac_line
    FROM o2.v_dim_department d
    WHERE d.fac_line = o2.clean_text(f.fac_line)
    ORDER BY d.fac_line
    LIMIT 1
  ) dep ON true
)
SELECT
  inspection_stage,
  inspection_date,
  EXTRACT(year FROM inspection_date)::int AS year,
  EXTRACT(month FROM inspection_date)::int AS month_number,
  to_char(inspection_date, 'Mon') AS month_name,
  to_char(inspection_date, 'IYYY-"W"IW') AS iso_week,
  factory_source_code,
  factory_display,
  factory_display AS factory,
  customer,
  cust_code,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  fac_line,
  fac_line AS fac_line_normalized,
  defect_code,
  defect_desc_eng,
  defect_qty,
  inspected_qty_raw AS inspected_qty,
  process_checks_raw AS process_checks,
  denominator_key,
  'raw_data_final'::text AS source_table
FROM source_rows;

CREATE OR REPLACE VIEW o2.v_fact_third_party AS
WITH source_rows AS (
  SELECT
    t.id,
    'Third Party'::text AS inspection_stage,
    t."date" AS inspection_date,
    CASE
      WHEN COALESCE(o2.clean_text(t.fac_line), bl.fac_line) ~ '^[A-Za-z0-9]+[-_]'
        THEN regexp_replace(COALESCE(o2.clean_text(t.fac_line), bl.fac_line), '[-_].*$', '')
      ELSE NULL
    END AS factory_source_code_raw,
    COALESCE(o2.clean_text(t.fac_line), bl.fac_line, o2.clean_text(t.line), 'Unknown Line') AS resolved_line,
    COALESCE(ds.customer, 'Unknown Customer') AS customer,
    ds.cust_code,
    o2.clean_text(t.so_no_doc) AS so_no_doc,
    COALESCE(o2.clean_text(t.so_no), ds.so_no) AS so_no,
    COALESCE(o2.clean_text(t.so_year), ds.so_year) AS so_year,
    COALESCE(o2.clean_text(t.style), ds.style_code, ds.style_ref) AS style,
    ds.style_ref,
    o2.clean_text(t.code) AS defect_code,
    COALESCE(dd.defect_desc_eng, o2.clean_text(t.code), 'Unknown Defect') AS defect_desc_eng,
    COALESCE(t.defect_qty, 0)::numeric AS defect_qty,
    COALESCE(t.inspect_qty, t.total, 0)::numeric AS inspected_qty_raw,
    NULL::numeric AS process_checks_raw,
    concat_ws(
      '|',
      'thirdparty',
      t."date"::text,
      COALESCE(o2.clean_text(t.fac_line), bl.fac_line, 'Unknown Line'),
      COALESCE(o2.clean_text(t.so_no), 'row-' || t.id::text),
      COALESCE(o2.clean_text(t.style), 'Unknown Style'),
      COALESCE(o2.clean_text(t.color), 'Unknown Color')
    ) AS denominator_key
  FROM o2.raw_data_3party t
  LEFT JOIN o2.v_dim_so ds ON ds.so_no_doc = o2.clean_text(t.so_no_doc)
  LEFT JOIN o2.v_dim_defect dd ON dd.defect_code = o2.clean_text(t.code)
  LEFT JOIN LATERAL (
    SELECT o2.clean_text(b.fac_line) AS fac_line
    FROM o2.raw_bridge_so_line b
    WHERE o2.clean_text(b.so_no_doc) = o2.clean_text(t.so_no_doc)
    ORDER BY
      CASE
        WHEN o2.clean_text(t.fac_line) IS NOT NULL AND o2.clean_text(b.fac_line) = o2.clean_text(t.fac_line) THEN 0
        ELSE 1
      END,
      o2.clean_text(b.fac_line)
    LIMIT 1
  ) bl ON true
)
SELECT
  inspection_stage,
  inspection_date,
  EXTRACT(year FROM inspection_date)::int AS year,
  EXTRACT(month FROM inspection_date)::int AS month_number,
  to_char(inspection_date, 'Mon') AS month_name,
  to_char(inspection_date, 'IYYY-"W"IW') AS iso_week,
  factory_source_code_raw AS factory_source_code,
  COALESCE(df.factory_display, factory_source_code_raw, 'Unknown Factory') AS factory_display,
  COALESCE(df.factory_display, factory_source_code_raw, 'Unknown Factory') AS factory,
  customer,
  cust_code,
  so_no_doc,
  so_no,
  so_year,
  style,
  style_ref,
  resolved_line AS fac_line,
  resolved_line AS fac_line_normalized,
  defect_code,
  defect_desc_eng,
  defect_qty,
  inspected_qty_raw AS inspected_qty,
  process_checks_raw AS process_checks,
  denominator_key,
  'raw_data_3party'::text AS source_table
FROM source_rows sr
LEFT JOIN o2.v_dim_factory df ON df.factory_source_code = sr.factory_source_code_raw;

CREATE OR REPLACE VIEW o2.v_quality_defects_unified AS
SELECT * FROM o2.v_fact_inline
UNION ALL
SELECT * FROM o2.v_fact_endline
UNION ALL
SELECT * FROM o2.v_fact_prefinal
UNION ALL
SELECT * FROM o2.v_fact_final
UNION ALL
SELECT * FROM o2.v_fact_third_party;

CREATE OR REPLACE VIEW o2.v_quality_filter_options AS
SELECT DISTINCT
  customer,
  factory_display,
  factory,
  so_no_doc,
  so_no,
  style,
  style_ref,
  fac_line,
  defect_desc_eng,
  inspection_stage
FROM o2.v_quality_defects_unified;

CREATE OR REPLACE VIEW o2.v_scan_qty AS
SELECT
  fg.trx_date,
  EXTRACT(year FROM fg.trx_date)::int AS year,
  EXTRACT(month FROM fg.trx_date)::int AS month_number,
  to_char(fg.trx_date, 'Mon') AS month_name,
  to_char(fg.trx_date, 'IYYY-"W"IW') AS iso_week,
  COALESCE(ds.customer, o2.customer_display_name(fg.cust_name), 'Unknown Customer') AS customer,
  o2.clean_text(fg.factory) AS factory_source_code,
  COALESCE(df.factory_display, o2.clean_text(fg.factory), 'Unknown Factory') AS factory_display,
  o2.clean_text(fg.so_no_doc) AS so_no_doc,
  COALESCE(ds.style_code, o2.clean_text(fg.style_code), ds.style_ref) AS style,
  o2.clean_text(fg.step) AS step,
  CASE
    WHEN fg.step ILIKE '%SEW%' THEN 'SEW QTY'
    WHEN fg.step ILIKE '%FN%' THEN 'EN QTY'
    WHEN fg.step ILIKE '%FG%' THEN 'FG QTY'
    ELSE NULL
  END AS scan_qty_type,
  COALESCE(fg.qty, 0)::numeric AS qty
FROM o2.raw_data_fn_fg fg
LEFT JOIN o2.v_dim_so ds ON ds.so_no_doc = o2.clean_text(fg.so_no_doc)
LEFT JOIN o2.v_dim_factory df ON df.factory_source_code = o2.clean_text(fg.factory);
