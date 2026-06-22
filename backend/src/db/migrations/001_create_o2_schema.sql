CREATE SCHEMA IF NOT EXISTS o2;

DROP VIEW IF EXISTS o2.v_quality_filter_options;
DROP VIEW IF EXISTS o2.v_quality_defects_unified;

CREATE TABLE IF NOT EXISTS o2.raw_bridge_so_line (
  id bigserial PRIMARY KEY,
  so_no_doc text,
  fac_line text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_data_3party (
  id bigserial PRIMARY KEY,
  "date" date,
  line text,
  style text,
  so_no text,
  color text,
  audit text,
  total numeric,
  percent numeric,
  code text,
  defect_qty numeric,
  fac_line text,
  st text,
  so_year text,
  so_no_doc text,
  week text,
  inspect_qty numeric,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_data_endline (
  id bigserial PRIMARY KEY,
  so_no_doc text,
  fac_line text,
  total_inspect numeric,
  job_date date,
  location_code text,
  defect_code text,
  line_name text,
  so_no text,
  so_year text,
  good_qty numeric,
  order_qty numeric,
  defect_point numeric,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_data_final (
  id bigserial PRIMARY KEY,
  factory text,
  "date" date,
  so_year text,
  so_no text,
  style_no text,
  pro_type text,
  cust_code text,
  sewing_line_no text,
  type_of_inspection text,
  inspected_by text,
  order_quantity_pcs numeric,
  total_garment_inspected numeric,
  result text,
  total_defect_found numeric,
  defect_rate numeric,
  defect_code text,
  defect_desc text,
  defect_qty numeric,
  so_no_doc text,
  fac_line text,
  color text,
  customer_brand text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_data_fn_fg (
  id bigserial PRIMARY KEY,
  bu_id text,
  step text,
  so_no_doc text,
  cust_name text,
  style_code text,
  sam_prod numeric,
  trx_date date,
  qty numeric,
  total_min numeric,
  factory text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_data_inline (
  id bigserial PRIMARY KEY,
  total_inspect numeric,
  job_date date,
  id_bu text,
  line_no text,
  so_no text,
  so_year text,
  defect_desc_eng text,
  cnt_failed numeric,
  fac_line text,
  defect_code text,
  so_no_doc text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_data_prefinal (
  id bigserial PRIMARY KEY,
  location_code text,
  line_name text,
  job_date date,
  so_no text,
  so_year text,
  defect_codes text,
  fac_line text,
  total_defects numeric,
  defect_descs text,
  so_no_doc text,
  order_qty numeric,
  total_inspect numeric,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_defect_qty (
  id bigserial PRIMARY KEY,
  parameter text,
  parameter_fields text,
  parameter_order numeric,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_defect_rate (
  id bigserial PRIMARY KEY,
  defect_rate text,
  defect_rate_fields text,
  defect_rate_order numeric,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_mt_defect (
  id bigserial PRIMARY KEY,
  defect_code text,
  defect_grp_code text,
  defect_desc_thai text,
  defect_desc_eng text,
  defect_desc_vi text,
  defect_grp_problem text,
  type_top text,
  type_bottom text,
  color text,
  active text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_mt_department (
  id bigserial PRIMARY KEY,
  location_code text,
  line_name text,
  sub_department text,
  department_head text,
  fac_line text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_mt_factory (
  id bigserial PRIMARY KEY,
  factory text,
  "index" numeric,
  bu text,
  factoryg text,
  factory_fi text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_mt_so (
  id bigserial PRIMARY KEY,
  so_no_doc text,
  brand text,
  style_ref text,
  shipment_date date,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_mt_so_base (
  id bigserial PRIMARY KEY,
  ou_code text,
  so_year text,
  so_no text,
  so_no_doc text,
  sea_code text,
  cus_season text,
  order_type text,
  style_code text,
  style_ref text,
  gmt_type text,
  score numeric,
  score_gmt numeric,
  sam numeric,
  sam_gmt numeric,
  post_status text,
  exc_rate numeric,
  vi text,
  shipment_date date,
  cust_code text,
  cust_name text,
  brand_code text,
  brand_name text,
  so_no_doc_ref text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_refresh_date (
  id bigserial PRIMARY KEY,
  refresh_date date,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS o2.raw_sort_table (
  id bigserial PRIMARY KEY,
  sort_name text,
  sort_order_value2 numeric,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_bridge_so_line_so_no_doc ON o2.raw_bridge_so_line (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_bridge_so_line_fac_line ON o2.raw_bridge_so_line (fac_line);

CREATE INDEX IF NOT EXISTS idx_raw_data_3party_date ON o2.raw_data_3party ("date");
CREATE INDEX IF NOT EXISTS idx_raw_data_3party_fac_line ON o2.raw_data_3party (fac_line);
CREATE INDEX IF NOT EXISTS idx_raw_data_3party_so_no_doc ON o2.raw_data_3party (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_data_3party_code ON o2.raw_data_3party (code);

CREATE INDEX IF NOT EXISTS idx_raw_data_endline_job_date ON o2.raw_data_endline (job_date);
CREATE INDEX IF NOT EXISTS idx_raw_data_endline_location_code ON o2.raw_data_endline (location_code);
CREATE INDEX IF NOT EXISTS idx_raw_data_endline_fac_line ON o2.raw_data_endline (fac_line);
CREATE INDEX IF NOT EXISTS idx_raw_data_endline_so_no_doc ON o2.raw_data_endline (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_data_endline_defect_code ON o2.raw_data_endline (defect_code);

CREATE INDEX IF NOT EXISTS idx_raw_data_final_date ON o2.raw_data_final ("date");
CREATE INDEX IF NOT EXISTS idx_raw_data_final_factory ON o2.raw_data_final (factory);
CREATE INDEX IF NOT EXISTS idx_raw_data_final_customer_brand ON o2.raw_data_final (customer_brand);
CREATE INDEX IF NOT EXISTS idx_raw_data_final_fac_line ON o2.raw_data_final (fac_line);
CREATE INDEX IF NOT EXISTS idx_raw_data_final_so_no_doc ON o2.raw_data_final (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_data_final_defect_code ON o2.raw_data_final (defect_code);

CREATE INDEX IF NOT EXISTS idx_raw_data_fn_fg_trx_date ON o2.raw_data_fn_fg (trx_date);
CREATE INDEX IF NOT EXISTS idx_raw_data_fn_fg_cust_name ON o2.raw_data_fn_fg (cust_name);
CREATE INDEX IF NOT EXISTS idx_raw_data_fn_fg_factory ON o2.raw_data_fn_fg (factory);
CREATE INDEX IF NOT EXISTS idx_raw_data_fn_fg_so_no_doc ON o2.raw_data_fn_fg (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_data_fn_fg_style_code ON o2.raw_data_fn_fg (style_code);

CREATE INDEX IF NOT EXISTS idx_raw_data_inline_job_date ON o2.raw_data_inline (job_date);
CREATE INDEX IF NOT EXISTS idx_raw_data_inline_id_bu ON o2.raw_data_inline (id_bu);
CREATE INDEX IF NOT EXISTS idx_raw_data_inline_fac_line ON o2.raw_data_inline (fac_line);
CREATE INDEX IF NOT EXISTS idx_raw_data_inline_so_no_doc ON o2.raw_data_inline (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_data_inline_defect_code ON o2.raw_data_inline (defect_code);

CREATE INDEX IF NOT EXISTS idx_raw_data_prefinal_job_date ON o2.raw_data_prefinal (job_date);
CREATE INDEX IF NOT EXISTS idx_raw_data_prefinal_location_code ON o2.raw_data_prefinal (location_code);
CREATE INDEX IF NOT EXISTS idx_raw_data_prefinal_fac_line ON o2.raw_data_prefinal (fac_line);
CREATE INDEX IF NOT EXISTS idx_raw_data_prefinal_so_no_doc ON o2.raw_data_prefinal (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_data_prefinal_defect_codes ON o2.raw_data_prefinal (defect_codes);

CREATE INDEX IF NOT EXISTS idx_raw_mt_defect_defect_code ON o2.raw_mt_defect (defect_code);
CREATE INDEX IF NOT EXISTS idx_raw_mt_department_location_code ON o2.raw_mt_department (location_code);
CREATE INDEX IF NOT EXISTS idx_raw_mt_department_fac_line ON o2.raw_mt_department (fac_line);
CREATE INDEX IF NOT EXISTS idx_raw_mt_factory_factory ON o2.raw_mt_factory (factory);
CREATE INDEX IF NOT EXISTS idx_raw_mt_factory_bu ON o2.raw_mt_factory (bu);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_so_no_doc ON o2.raw_mt_so (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_shipment_date ON o2.raw_mt_so (shipment_date);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_base_so_no_doc ON o2.raw_mt_so_base (so_no_doc);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_base_cust_name ON o2.raw_mt_so_base (cust_name);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_base_style_code ON o2.raw_mt_so_base (style_code);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_base_style_ref ON o2.raw_mt_so_base (style_ref);
CREATE INDEX IF NOT EXISTS idx_raw_mt_so_base_shipment_date ON o2.raw_mt_so_base (shipment_date);

CREATE OR REPLACE VIEW o2.v_quality_defects_unified AS
WITH so_base_unique AS (
  SELECT DISTINCT ON (so_no_doc)
    so_no_doc,
    so_no,
    so_year,
    cust_code,
    cust_name,
    style_code,
    style_ref,
    brand_name,
    shipment_date
  FROM o2.raw_mt_so_base
  WHERE NULLIF(so_no_doc, '') IS NOT NULL
  ORDER BY so_no_doc, shipment_date DESC NULLS LAST, imported_at DESC
),
defect_unique AS (
  SELECT DISTINCT ON (defect_code)
    defect_code,
    defect_desc_eng
  FROM o2.raw_mt_defect
  WHERE NULLIF(defect_code, '') IS NOT NULL
  ORDER BY defect_code, imported_at DESC
)
SELECT
  'Inline'::text AS inspection_stage,
  i.job_date AS inspection_date,
  NULLIF(i.id_bu, '') AS factory,
  NULLIF(sb.cust_name, '') AS customer,
  NULLIF(i.so_no_doc, '') AS so_no_doc,
  NULLIF(i.so_no, '') AS so_no,
  NULLIF(i.so_year, '') AS so_year,
  COALESCE(NULLIF(sb.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(i.fac_line, ''), NULLIF(i.line_no, '')) AS fac_line,
  NULLIF(i.defect_code, '') AS defect_code,
  COALESCE(NULLIF(i.defect_desc_eng, ''), NULLIF(d.defect_desc_eng, '')) AS defect_desc_eng,
  COALESCE(i.cnt_failed, 0)::numeric AS defect_qty,
  NULL::numeric AS inspected_qty,
  COALESCE(i.total_inspect, 0)::numeric AS process_checks,
  'raw_data_inline'::text AS source_table
FROM o2.raw_data_inline i
LEFT JOIN so_base_unique sb ON sb.so_no_doc = i.so_no_doc
LEFT JOIN defect_unique d ON d.defect_code = i.defect_code

UNION ALL

SELECT
  'Endline'::text AS inspection_stage,
  e.job_date AS inspection_date,
  NULLIF(e.location_code, '') AS factory,
  NULLIF(sb.cust_name, '') AS customer,
  NULLIF(e.so_no_doc, '') AS so_no_doc,
  NULLIF(e.so_no, '') AS so_no,
  NULLIF(e.so_year, '') AS so_year,
  COALESCE(NULLIF(sb.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(e.fac_line, ''), NULLIF(e.line_name, '')) AS fac_line,
  NULLIF(e.defect_code, '') AS defect_code,
  NULLIF(d.defect_desc_eng, '') AS defect_desc_eng,
  COALESCE(e.defect_point, 0)::numeric AS defect_qty,
  COALESCE(e.total_inspect, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  'raw_data_endline'::text AS source_table
FROM o2.raw_data_endline e
LEFT JOIN so_base_unique sb ON sb.so_no_doc = e.so_no_doc
LEFT JOIN defect_unique d ON d.defect_code = e.defect_code

UNION ALL

SELECT
  'Pre Final'::text AS inspection_stage,
  p.job_date AS inspection_date,
  NULLIF(p.location_code, '') AS factory,
  NULLIF(sb.cust_name, '') AS customer,
  NULLIF(p.so_no_doc, '') AS so_no_doc,
  NULLIF(p.so_no, '') AS so_no,
  NULLIF(p.so_year, '') AS so_year,
  COALESCE(NULLIF(sb.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(p.fac_line, ''), NULLIF(p.line_name, '')) AS fac_line,
  NULLIF(p.defect_codes, '') AS defect_code,
  COALESCE(NULLIF(p.defect_descs, ''), NULLIF(d.defect_desc_eng, '')) AS defect_desc_eng,
  COALESCE(p.total_defects, 0)::numeric AS defect_qty,
  COALESCE(p.total_inspect, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  'raw_data_prefinal'::text AS source_table
FROM o2.raw_data_prefinal p
LEFT JOIN so_base_unique sb ON sb.so_no_doc = p.so_no_doc
LEFT JOIN defect_unique d ON d.defect_code = p.defect_codes

UNION ALL

SELECT
  'Final'::text AS inspection_stage,
  f."date" AS inspection_date,
  NULLIF(f.factory, '') AS factory,
  COALESCE(NULLIF(sb.cust_name, ''), NULLIF(f.customer_brand, ''), NULLIF(f.cust_code, '')) AS customer,
  NULLIF(f.so_no_doc, '') AS so_no_doc,
  NULLIF(f.so_no, '') AS so_no,
  NULLIF(f.so_year, '') AS so_year,
  COALESCE(NULLIF(f.style_no, ''), NULLIF(sb.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(f.fac_line, ''), NULLIF(f.sewing_line_no, '')) AS fac_line,
  NULLIF(f.defect_code, '') AS defect_code,
  COALESCE(NULLIF(f.defect_desc, ''), NULLIF(d.defect_desc_eng, '')) AS defect_desc_eng,
  COALESCE(f.defect_qty, f.total_defect_found, 0)::numeric AS defect_qty,
  COALESCE(f.total_garment_inspected, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  'raw_data_final'::text AS source_table
FROM o2.raw_data_final f
LEFT JOIN so_base_unique sb ON sb.so_no_doc = f.so_no_doc
LEFT JOIN defect_unique d ON d.defect_code = f.defect_code

UNION ALL

SELECT
  'Third Party'::text AS inspection_stage,
  t."date" AS inspection_date,
  CASE
    WHEN t.fac_line ~ '^[A-Za-z0-9]+[-_]' THEN regexp_replace(t.fac_line, '[-_].*$', '')
    ELSE NULL
  END AS factory,
  NULLIF(sb.cust_name, '') AS customer,
  NULLIF(t.so_no_doc, '') AS so_no_doc,
  NULLIF(t.so_no, '') AS so_no,
  NULLIF(t.so_year, '') AS so_year,
  COALESCE(NULLIF(t.style, ''), NULLIF(sb.style_code, ''), NULLIF(sb.style_ref, '')) AS style,
  COALESCE(NULLIF(t.fac_line, ''), NULLIF(t.line, '')) AS fac_line,
  NULLIF(t.code, '') AS defect_code,
  COALESCE(NULLIF(d.defect_desc_eng, ''), NULLIF(t.code, '')) AS defect_desc_eng,
  COALESCE(t.defect_qty, 0)::numeric AS defect_qty,
  COALESCE(t.inspect_qty, t.total, 0)::numeric AS inspected_qty,
  NULL::numeric AS process_checks,
  'raw_data_3party'::text AS source_table
FROM o2.raw_data_3party t
LEFT JOIN so_base_unique sb ON sb.so_no_doc = t.so_no_doc
LEFT JOIN defect_unique d ON d.defect_code = t.code;

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
